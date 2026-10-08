/**
 * Content check of a file uploaded to the public `orcamentos` bucket, run by
 * /api/v1/public/orcamento/upload-slot/confirm BEFORE it issues a 7-day link.
 *
 * Why: the uploader picks the stored content type (a signed upload URL cannot
 * bind it) and the bucket only checks that it is on the allowlist. Without
 * this, any bytes could be stored as `image/png` and shared through our
 * domain. Pure functions over the first bytes of the object, so it is cheap
 * and unit-tested.
 *
 * Per kind:
 *   png/jpeg/webp/pdf  fixed signature
 *   3mf                ZIP local header `PK\x03\x04`
 *   step               text starting with `ISO-10303-21;`
 *   stl                ASCII (`solid` + text) or binary whose size matches the
 *                      triangle count in the header (84 + 50 * n bytes)
 *   obj                plain text (no NUL, no markup) with OBJ statements
 */
import { KIND_MIME, type OrcamentoKind } from "@/lib/schemas/orcamento-upload";

/** How many leading bytes the confirm route reads. */
export const SNIFF_BYTES = 1024;

export type FileCheckResult = { ok: true } | { ok: false; reason: string };

function startsWith(bytes: Uint8Array, sig: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

function ascii(s: string): number[] {
  return Array.from(s, (c) => c.charCodeAt(0));
}

/** Leading text with UTF-8 BOM and leading whitespace removed. */
function leadingText(bytes: Uint8Array): string {
  let start = 0;
  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) start = 3;
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(start)).replace(/^\s+/, "");
}

/** Plain text: no NUL and almost no control characters outside tab/CR/LF. */
function looksLikeText(bytes: Uint8Array): boolean {
  let control = 0;
  for (const b of bytes) {
    if (b === 0) return false;
    if (b < 0x09 || (b > 0x0d && b < 0x20)) control += 1;
  }
  return control <= bytes.length * 0.01;
}

function looksLikeMarkup(text: string): boolean {
  return text.startsWith("<");
}

const OBJ_STATEMENT = /^(#|v|vt|vn|vp|f|l|p|o|g|s|mtllib|usemtl)(\s|$)/m;

export interface FileCheckInput {
  kind: OrcamentoKind;
  /** Content type stored on the object (response header of the read). */
  storedContentType: string | null;
  /** First bytes of the object (up to SNIFF_BYTES). */
  head: Uint8Array;
  /** Total object size in bytes, when known. */
  totalSize: number | null;
}

export function checkOrcamentoFile(input: FileCheckInput): FileCheckResult {
  const { kind, head, totalSize } = input;

  const stored = (input.storedContentType ?? "").split(";")[0]!.trim().toLowerCase();
  if (!(KIND_MIME[kind] as readonly string[]).includes(stored)) {
    return { ok: false, reason: `tipo gravado (${stored || "vazio"}) não corresponde a .${kind}` };
  }
  if (head.length === 0) return { ok: false, reason: "arquivo vazio" };

  switch (kind) {
    case "png":
      return startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        ? { ok: true }
        : { ok: false, reason: "não é um PNG" };
    case "jpeg":
      return startsWith(head, [0xff, 0xd8, 0xff]) ? { ok: true } : { ok: false, reason: "não é um JPEG" };
    case "webp":
      return startsWith(head, ascii("RIFF")) && startsWith(head, ascii("WEBP"), 8)
        ? { ok: true }
        : { ok: false, reason: "não é um WEBP" };
    case "pdf":
      return startsWith(head, ascii("%PDF-")) ? { ok: true } : { ok: false, reason: "não é um PDF" };
    case "3mf":
      return startsWith(head, [0x50, 0x4b, 0x03, 0x04])
        ? { ok: true }
        : { ok: false, reason: "não é um 3MF (pacote zip)" };
    case "step":
      return leadingText(head).startsWith("ISO-10303-21;")
        ? { ok: true }
        : { ok: false, reason: "não é um STEP (ISO-10303-21)" };
    case "stl": {
      // Binary STL: 80-byte header + uint32 triangle count + 50 bytes per triangle.
      // Some exporters write "solid" in the binary header, so test binary first.
      if (totalSize !== null && head.length >= 84) {
        const count = new DataView(head.buffer, head.byteOffset, head.byteLength).getUint32(80, true);
        if (count > 0 && 84 + count * 50 === totalSize) return { ok: true };
      }
      const text = leadingText(head);
      if (looksLikeText(head) && /^solid(\s|$)/i.test(text) && !looksLikeMarkup(text)) return { ok: true };
      return { ok: false, reason: "não é um STL (nem ASCII, nem binário com tamanho coerente)" };
    }
    case "obj": {
      const text = leadingText(head);
      if (looksLikeText(head) && !looksLikeMarkup(text) && OBJ_STATEMENT.test(text)) return { ok: true };
      return { ok: false, reason: "não é um OBJ" };
    }
  }
}

/** Total size from `Content-Range: bytes a-b/TOTAL` or, on a 200, `Content-Length`. */
export function totalSizeFromHeaders(status: number, headers: Headers): number | null {
  const range = headers.get("content-range");
  const fromRange = range ? /\/(\d+)\s*$/.exec(range)?.[1] : undefined;
  if (fromRange) return Number(fromRange);
  if (status === 200) {
    const len = headers.get("content-length");
    if (len && /^\d+$/.test(len)) return Number(len);
  }
  return null;
}

/**
 * Reads at most `max` bytes of a response body and cancels the rest, so a
 * server that ignores the Range header does not make us download 50 MB.
 */
export async function readHead(body: ReadableStream<Uint8Array> | null, max = SNIFF_BYTES): Promise<Uint8Array> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < max) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      size += value.length;
    }
  } finally {
    // Stop the transfer of the remaining bytes (resolves immediately if done).
    await reader.cancel();
  }
  const out = new Uint8Array(Math.min(size, max));
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.length, out.length - offset);
    out.set(chunk.subarray(0, take), offset);
    offset += take;
    if (offset >= out.length) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3MF: ZIP central directory
// ---------------------------------------------------------------------------
//
// The `PK\x03\x04` signature only proves "some zip": any renamed .zip passed as
// a 3MF (pendência 19). A 3MF is an OPC package, so its central directory must
// list `[Content_Types].xml` and a 3D model part under `3D/` (the spec's
// canonical name is `3D/3dmodel.model`; the actual path is declared in
// `_rels/.rels`, so any `3D/*.model` is accepted).
//
// The central directory sits at the END of the file, located by the End Of
// Central Directory record (EOCD, last 22 bytes + up to 64 KiB of comment).
// The confirm route reads only that tail with a Range request.

/** EOCD (22 bytes) + the maximum zip comment (65535 bytes). */
export const ZIP_TAIL_BYTES = 22 + 0xffff;
/** A 3MF with a central directory larger than this is refused (no real one is close). */
export const MAX_CENTRAL_DIRECTORY_BYTES = 1024 * 1024;

const EOCD_SIG = 0x06054b50;
const CDH_SIG = 0x02014b50;

export type ZipDirectoryLocation =
  | { ok: true; offset: number; size: number; entries: number }
  | { ok: false; reason: string };

/**
 * Finds the EOCD in the last bytes of the file and returns where the central
 * directory is (absolute offset in the file). `totalSize` is the file size.
 */
export function locateZipCentralDirectory(tail: Uint8Array, totalSize: number): ZipDirectoryLocation {
  if (tail.length < 22) return { ok: false, reason: "arquivo curto demais para ser um zip" };
  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  for (let i = tail.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) !== EOCD_SIG) continue;
    const commentLen = view.getUint16(i + 20, true);
    // The comment must end exactly at the end of the file; otherwise this is
    // a stray signature inside the data.
    if (i + 22 + commentLen !== tail.length) continue;
    const entries = view.getUint16(i + 10, true);
    const size = view.getUint32(i + 12, true);
    const offset = view.getUint32(i + 16, true);
    if (entries === 0xffff || size === 0xffffffff || offset === 0xffffffff) {
      return { ok: false, reason: "zip64 não é aceito" };
    }
    const eocdAbs = totalSize - tail.length + i;
    if (offset + size > eocdAbs) return { ok: false, reason: "diretório central inconsistente" };
    if (size > MAX_CENTRAL_DIRECTORY_BYTES) return { ok: false, reason: "diretório central grande demais" };
    return { ok: true, offset, size, entries };
  }
  return { ok: false, reason: "fim do diretório central (EOCD) não encontrado" };
}

/** File names listed in a central directory (raw bytes of exactly that region). */
export function parseZipCentralDirectory(cd: Uint8Array, expectedEntries: number): string[] | null {
  const view = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const names: string[] = [];
  let p = 0;
  while (p + 46 <= cd.length && names.length < expectedEntries) {
    if (view.getUint32(p, true) !== CDH_SIG) return null;
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    if (p + 46 + nameLen > cd.length) return null;
    names.push(decoder.decode(cd.subarray(p + 46, p + 46 + nameLen)));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return names.length === expectedEntries ? names : null;
}

/** The 3MF parts that must be present. */
export function check3mfEntries(names: readonly string[]): FileCheckResult {
  const normalized = names.map((n) => n.replace(/\\/g, "/").replace(/^\/+/, ""));
  if (!normalized.includes("[Content_Types].xml")) {
    return { ok: false, reason: "3MF sem [Content_Types].xml" };
  }
  if (!normalized.some((n) => /^3D\/[^/]+\.model$/i.test(n))) {
    return { ok: false, reason: "3MF sem modelo 3D (3D/3dmodel.model)" };
  }
  return { ok: true };
}

/**
 * Whole 3MF content check from the file tail. `readRange` fetches an
 * arbitrary byte range when the central directory is not inside the tail
 * (only for archives with a huge directory; normally unused).
 */
export async function check3mfPackage(
  tail: Uint8Array,
  totalSize: number,
  readRange: (start: number, endInclusive: number) => Promise<Uint8Array>,
): Promise<FileCheckResult> {
  const loc = locateZipCentralDirectory(tail, totalSize);
  if (!loc.ok) return { ok: false, reason: loc.reason };

  const tailStart = totalSize - tail.length;
  let cd: Uint8Array;
  if (loc.offset >= tailStart) {
    cd = tail.subarray(loc.offset - tailStart, loc.offset - tailStart + loc.size);
  } else {
    cd = await readRange(loc.offset, loc.offset + loc.size - 1);
    if (cd.length !== loc.size) return { ok: false, reason: "não consegui ler o diretório central" };
  }

  const names = parseZipCentralDirectory(cd, loc.entries);
  if (!names) return { ok: false, reason: "diretório central corrompido" };
  return check3mfEntries(names);
}
