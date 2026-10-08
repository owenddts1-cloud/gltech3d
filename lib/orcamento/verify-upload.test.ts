// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  ZIP_TAIL_BYTES,
  check3mfEntries,
  check3mfPackage,
  locateZipCentralDirectory,
  parseZipCentralDirectory,
} from "./file-check";
import { verifiedPathOf, verifyAndPublishUpload, type OrcamentoBucket } from "./verify-upload";

// ---------------------------------------------------------------------------
// Synthetic ZIP (stored, empty entries) built in-test — no fixture files.
// ---------------------------------------------------------------------------
function u16(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff];
}
function u32(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
}

function makeZip(names: string[], opts: { comment?: string; padding?: number } = {}): Uint8Array {
  const enc = new TextEncoder();
  const out: number[] = [];
  const offsets: number[] = [];
  for (const name of names) {
    offsets.push(out.length);
    const n = [...enc.encode(name)];
    out.push(...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0));
    out.push(...u32(0), ...u32(0), ...u32(0), ...u16(n.length), ...u16(0), ...n);
  }
  // Optional filler between data and directory (simulates big part content).
  for (let i = 0; i < (opts.padding ?? 0); i++) out.push(0);
  const cdStart = out.length;
  names.forEach((name, i) => {
    const n = [...enc.encode(name)];
    out.push(...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0));
    out.push(...u32(0), ...u32(0), ...u32(0), ...u16(n.length), ...u16(0), ...u16(0));
    out.push(...u16(0), ...u16(0), ...u32(0), ...u32(offsets[i]!), ...n);
  });
  const cdSize = out.length - cdStart;
  const comment = [...enc.encode(opts.comment ?? "")];
  out.push(...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(names.length), ...u16(names.length));
  out.push(...u32(cdSize), ...u32(cdStart), ...u16(comment.length), ...comment);
  return new Uint8Array(out);
}

const VALID_3MF = ["[Content_Types].xml", "_rels/.rels", "3D/3dmodel.model", "Metadata/thumbnail.png"];

function tailOf(file: Uint8Array): Uint8Array {
  return file.subarray(Math.max(0, file.length - ZIP_TAIL_BYTES));
}

const noRange = async () => new Uint8Array(0);

describe("ZIP central directory", () => {
  it("locates and lists the entries", () => {
    const zip = makeZip(VALID_3MF, { comment: "made by test" });
    const loc = locateZipCentralDirectory(tailOf(zip), zip.length);
    expect(loc.ok).toBe(true);
    if (!loc.ok) return;
    expect(loc.entries).toBe(4);
    const names = parseZipCentralDirectory(zip.subarray(loc.offset, loc.offset + loc.size), loc.entries);
    expect(names).toEqual(VALID_3MF);
  });

  it("refuses bytes without an EOCD", () => {
    const loc = locateZipCentralDirectory(new Uint8Array(100), 100);
    expect(loc.ok).toBe(false);
  });
});

describe("3MF package check", () => {
  it("accepts a real 3MF layout", async () => {
    const zip = makeZip(VALID_3MF);
    expect(await check3mfPackage(tailOf(zip), zip.length, noRange)).toEqual({ ok: true });
  });

  it("refuses a plain zip renamed to .3mf", async () => {
    const zip = makeZip(["foto.jpg", "leia-me.txt"]);
    const r = await check3mfPackage(tailOf(zip), zip.length, noRange);
    expect(r.ok).toBe(false);
  });

  it("refuses a zip with content types but no model part", async () => {
    const zip = makeZip(["[Content_Types].xml", "_rels/.rels"]);
    const r = await check3mfPackage(tailOf(zip), zip.length, noRange);
    expect(r).toEqual({ ok: false, reason: "3MF sem modelo 3D (3D/3dmodel.model)" });
  });

  it("reads the directory with an extra range when it is outside the tail", async () => {
    const zip = makeZip(VALID_3MF, { padding: ZIP_TAIL_BYTES + 10 });
    // Tail too small to hold the directory: simulate a short tail read.
    const tail = zip.subarray(zip.length - 30);
    const readRange = vi.fn(async (s: number, e: number) => zip.subarray(s, e + 1));
    expect(await check3mfPackage(tail, zip.length, readRange)).toEqual({ ok: true });
    expect(readRange).toHaveBeenCalledTimes(1);
  });

  it("entry check accepts any 3D/*.model part and backslashes", () => {
    expect(check3mfEntries(["[Content_Types].xml", "3D\\Objects.model"]).ok).toBe(true);
    expect(check3mfEntries(["[Content_Types].xml", "3D/sub/x.model"]).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// verify-then-publish ordering
// ---------------------------------------------------------------------------
const PATH = "202610071230-0b8c7b1e-4c1d-4c9e-9a51-0f4b8f1c2d3e/peca.3mf";

function fakeBucket(objects: Map<string, { bytes: Uint8Array; type: string }>) {
  const calls: string[] = [];
  const bucket: OrcamentoBucket = {
    async copy(from, to) {
      calls.push(`copy ${from} -> ${to}`);
      if (objects.has(to)) return { error: { message: "The resource already exists" } };
      const obj = objects.get(from);
      if (!obj) return { error: { message: "Object not found" } };
      objects.set(to, { ...obj });
      return { error: null };
    },
    async remove(paths) {
      calls.push(`remove ${paths.join(",")}`);
      for (const p of paths) objects.delete(p);
      return { error: null };
    },
    async createSignedUrl(path, ttl) {
      calls.push(`sign ${path} ${ttl}`);
      if (!objects.has(path)) return { data: null, error: { message: "Object not found" } };
      return { data: { signedUrl: `https://storage.test/${path}?ttl=${ttl}` }, error: null };
    },
  };
  return { bucket, calls };
}

/** Serves byte ranges of the objects behind the fake signed URLs. */
function fakeFetch(objects: Map<string, { bytes: Uint8Array; type: string }>) {
  return vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
    const path = decodeURIComponent(new URL(url).pathname.slice(1));
    const obj = objects.get(path);
    if (!obj) return new Response(null, { status: 404 });
    const total = obj.bytes.length;
    const range = init.headers.Range ?? "";
    let start = 0;
    let end = total - 1;
    const suffix = /^bytes=-(\d+)$/.exec(range);
    const span = /^bytes=(\d+)-(\d+)$/.exec(range);
    if (suffix) start = Math.max(0, total - Number(suffix[1]));
    else if (span) {
      start = Number(span[1]);
      end = Math.min(total - 1, Number(span[2]));
    }
    const slice = obj.bytes.slice(start, end + 1);
    return new Response(slice, {
      status: 206,
      headers: { "content-type": obj.type, "content-range": `bytes ${start}-${end}/${total}` },
    });
  });
}

describe("verifyAndPublishUpload", () => {
  it("copies, removes the original, checks and signs the COPY", async () => {
    const objects = new Map([[PATH, { bytes: makeZip(VALID_3MF), type: "model/3mf" }]]);
    const { bucket, calls } = fakeBucket(objects);
    const r = await verifyAndPublishUpload({
      bucket,
      path: PATH,
      kind: "3mf",
      linkTtlSeconds: 604800,
      fetchFn: fakeFetch(objects),
    });
    expect(r).toMatchObject({ ok: true, verifiedPath: verifiedPathOf(PATH) });
    if (r.ok) expect(r.signedUrl).toContain("verified/");
    expect(calls[0]).toBe(`copy ${PATH} -> verified/${PATH}`);
    expect(calls[1]).toBe(`remove ${PATH}`);
    expect(calls.at(-1)).toBe(`sign verified/${PATH} 604800`);
    expect(objects.has(PATH)).toBe(false);
  });

  it("rejects a renamed zip and deletes the copy", async () => {
    const objects = new Map([[PATH, { bytes: makeZip(["a.txt"]), type: "model/3mf" }]]);
    const { bucket } = fakeBucket(objects);
    const r = await verifyAndPublishUpload({
      bucket,
      path: PATH,
      kind: "3mf",
      linkTtlSeconds: 60,
      fetchFn: fakeFetch(objects),
    });
    expect(r).toMatchObject({ ok: false, status: 422, code: "file_rejected" });
    expect(objects.size).toBe(0);
  });

  it("404 when nothing was uploaded", async () => {
    const objects = new Map<string, { bytes: Uint8Array; type: string }>();
    const { bucket } = fakeBucket(objects);
    const r = await verifyAndPublishUpload({ bucket, path: PATH, kind: "3mf", linkTtlSeconds: 60, fetchFn: fakeFetch(objects) });
    expect(r).toMatchObject({ ok: false, status: 404 });
  });

  it("a retry finds the verified copy, checks it AGAIN and re-signs it", async () => {
    const objects = new Map([[verifiedPathOf(PATH), { bytes: makeZip(VALID_3MF), type: "model/3mf" }]]);
    const { bucket } = fakeBucket(objects);
    const fetchFn = fakeFetch(objects);
    const r = await verifyAndPublishUpload({ bucket, path: PATH, kind: "3mf", linkTtlSeconds: 60, fetchFn });
    expect(r).toMatchObject({ ok: true, verifiedPath: verifiedPathOf(PATH) });
    // head + tail reads = the content check ran on the existing copy.
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("a retry whose existing copy is invalid is rejected and the copy deleted", async () => {
    const objects = new Map([[verifiedPathOf(PATH), { bytes: makeZip(["x.txt"]), type: "model/3mf" }]]);
    const { bucket } = fakeBucket(objects);
    const r = await verifyAndPublishUpload({ bucket, path: PATH, kind: "3mf", linkTtlSeconds: 60, fetchFn: fakeFetch(objects) });
    expect(r).toMatchObject({ ok: false, code: "file_rejected" });
    expect(objects.has(verifiedPathOf(PATH))).toBe(false);
  });

  it("a transient read failure after the copy also deletes the copy", async () => {
    const objects = new Map([[PATH, { bytes: makeZip(VALID_3MF), type: "model/3mf" }]]);
    const { bucket } = fakeBucket(objects);
    const fetchFn = vi.fn(async () => new Response(null, { status: 500 }));
    const r = await verifyAndPublishUpload({ bucket, path: PATH, kind: "3mf", linkTtlSeconds: 60, fetchFn });
    expect(r).toMatchObject({ ok: false, status: 502 });
    expect(objects.size).toBe(0);
  });

  it("a signing failure deletes the copy", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    const p = PATH.replace("peca.3mf", "foto.png");
    const objects = new Map([[p, { bytes: png, type: "image/png" }]]);
    const { bucket } = fakeBucket(objects);
    const realSign = bucket.createSignedUrl.bind(bucket);
    let calls = 0;
    bucket.createSignedUrl = async (path, ttl) => {
      calls += 1;
      // 1st = internal sniff link (ok); 2nd = the long link (fails).
      return calls === 1 ? realSign(path, ttl) : { data: null, error: { message: "boom" } };
    };
    const r = await verifyAndPublishUpload({ bucket, path: p, kind: "png", linkTtlSeconds: 60, fetchFn: fakeFetch(objects) });
    expect(r).toMatchObject({ ok: false, status: 500 });
    expect(objects.size).toBe(0);
  });

  it("a non-3mf kind only checks the head", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    const p = PATH.replace("peca.3mf", "foto.png");
    const objects = new Map([[p, { bytes: png, type: "image/png" }]]);
    const { bucket } = fakeBucket(objects);
    const fetchFn = fakeFetch(objects);
    const r = await verifyAndPublishUpload({ bucket, path: p, kind: "png", linkTtlSeconds: 60, fetchFn });
    expect(r.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
