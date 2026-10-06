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
