/**
 * Upload of the visitor's 3D model on the public quote page (/orcamento).
 *
 * The browser never chooses where the file lands: the server issues a signed
 * upload URL for a path it generates (`<issued-at>-<uuid>/<sanitised name>`),
 * the browser uploads with the token, and a second call turns that path into a
 * 7-day signed read link (the one the visitor sends on WhatsApp). Bucket, MIME
 * list and size limit must match migration 0085 — Storage enforces them too.
 *
 * WHAT A SIGNED UPLOAD URL CANNOT DO: bind the content type. supabase-js
 * `uploadToSignedUrl` sends a `File`/`Blob` as multipart and the part's type
 * comes from the uploader (its `contentType` option only applies to raw
 * bodies). So the MIME resolved here is what an honest browser uses, and the
 * confirm route re-checks the STORED type and the magic bytes before issuing a
 * link (lib/orcamento/file-check.ts).
 */
import { z } from "zod";

/** Private bucket created by migration 0085. */
export const ORCAMENTO_BUCKET = "orcamentos";

/** 50 MB, same as `storage.buckets.file_size_limit` in migration 0085. */
export const ORCAMENTO_MAX_BYTES = 50 * 1024 * 1024;

/** Validity of the read link sent to the shop on WhatsApp. */
export const ORCAMENTO_LINK_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * How long after the slot is issued the confirm route still issues a link.
 * Matches the validity of a Supabase signed upload URL (2 h): past that the
 * object was not uploaded by this visit's flow, and a link would only serve
 * whoever is reusing the path as file hosting.
 */
export const ORCAMENTO_CONFIRM_WINDOW_MS = 2 * 60 * 60 * 1000;

/** Tolerated clock skew between instances for an issuance time "in the future". */
const ISSUED_AT_SKEW_MS = 5 * 60 * 1000;

/**
 * Same list as `allowed_mime_types` in migration 0085. No
 * `application/octet-stream`: it accepts any bytes.
 */
export const ORCAMENTO_MIME_TYPES = [
  "model/stl",
  "application/sla",
  "application/vnd.ms-pki.stl",
  "model/3mf",
  "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
  "model/obj",
  "application/step",
  "model/step",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;

export type OrcamentoMime = (typeof ORCAMENTO_MIME_TYPES)[number];

export type OrcamentoKind = "stl" | "3mf" | "obj" | "step" | "png" | "jpeg" | "webp" | "pdf";

/** Kind -> MIME types acceptable for it. The first one is the default. */
export const KIND_MIME: Record<OrcamentoKind, readonly [OrcamentoMime, ...OrcamentoMime[]]> = {
  stl: ["model/stl", "application/sla", "application/vnd.ms-pki.stl"],
  "3mf": ["model/3mf", "application/vnd.ms-package.3dmanufacturing-3dmodel+xml"],
  obj: ["model/obj"],
  step: ["model/step", "application/step"],
  png: ["image/png"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  pdf: ["application/pdf"],
};

const EXTENSION_KIND: Record<string, OrcamentoKind> = {
  stl: "stl",
  "3mf": "3mf",
  obj: "obj",
  step: "step",
  stp: "step",
  png: "png",
  jpg: "jpeg",
  jpeg: "jpeg",
  webp: "webp",
  pdf: "pdf",
};

export const ORCAMENTO_ACCEPT = Object.keys(EXTENSION_KIND)
  .map((ext) => `.${ext}`)
  .join(",");

const UUID_V4 = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

/**
 * `<YYYYMMDDHHmm UTC>-<uuid v4>/<sanitised name>` — the only shape the confirm
 * endpoint accepts. Forging a recent stamp gains nothing: the path must also
 * hold an object, and only a slot issued by the server can create one.
 */
export const ORCAMENTO_PATH_RE = new RegExp(
  `^(\\d{12})-${UUID_V4}\\/[A-Za-z0-9_][A-Za-z0-9_.-]{0,119}$`,
);

export const orcamentoUploadSlotSchema = z
  .object({
    filename: z.string().trim().min(1).max(200),
    /** `File.type` as the browser reported it; may be empty. */
    contentType: z.string().trim().max(120).default(""),
    sizeBytes: z.number().int().positive().max(ORCAMENTO_MAX_BYTES),
  })
  .strict();

export const orcamentoConfirmSchema = z
  .object({
    path: z.string().max(200).regex(ORCAMENTO_PATH_RE),
  })
  .strict();

function extensionOf(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot + 1).toLowerCase();
}

/** File kind by extension, or null if the extension is not accepted. */
export function orcamentoKindOf(filename: string): OrcamentoKind | null {
  return EXTENSION_KIND[extensionOf(filename)] ?? null;
}

/**
 * MIME to upload with, or null if the file is not accepted. The extension
 * decides; a declared MIME is kept only if it is valid FOR THAT extension
 * (an `.stl` declared as `image/png` gets `model/stl`).
 */
export function resolveOrcamentoContentType(filename: string, declared: string): OrcamentoMime | null {
  const kind = orcamentoKindOf(filename);
  if (!kind) return null;
  const allowed = KIND_MIME[kind];
  const normalized = declared.trim().toLowerCase();
  const match = allowed.find((m) => m === normalized);
  return match ?? allowed[0];
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/** UTC `YYYYMMDDHHmm` — the issuance stamp that prefixes the slot folder. */
export function formatIssuedAt(date: Date): string {
  return (
    pad(date.getUTCFullYear(), 4) +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes())
  );
}

/** Issuance time encoded in a slot path, or null if the path is not a slot path. */
export function parseIssuedAt(path: string): Date | null {
  const m = ORCAMENTO_PATH_RE.exec(path);
  const stamp = m?.[1];
  if (!stamp) return null;
  const year = Number(stamp.slice(0, 4));
  const month = Number(stamp.slice(4, 6));
  const day = Number(stamp.slice(6, 8));
  const hour = Number(stamp.slice(8, 10));
  const minute = Number(stamp.slice(10, 12));
  const ms = Date.UTC(year, month - 1, day, hour, minute);
  const d = new Date(ms);
  // Reject impossible dates (month 13, day 32...) that Date.UTC would roll over.
  if (formatIssuedAt(d) !== stamp) return null;
  return d;
}

/**
 * Whether a slot path may still be confirmed: issued at most
 * ORCAMENTO_CONFIRM_WINDOW_MS ago (the stamp has minute precision, so up to one
 * extra minute), and not in the future beyond clock skew.
 */
export function isSlotFresh(path: string, now: Date): boolean {
  const issued = parseIssuedAt(path);
  if (!issued) return false;
  const age = now.getTime() - issued.getTime();
  return age >= -ISSUED_AT_SKEW_MS && age <= ORCAMENTO_CONFIRM_WINDOW_MS + 60_000;
}

/** Server-generated slot path for a file name. */
export function buildSlotPath(filename: string, uuid: string, now: Date): string {
  return `${formatIssuedAt(now)}-${uuid}/${safeOrcamentoFilename(filename)}`;
}

// Combining diacritical marks left after NFD, written escaped to keep the
// source ASCII.
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

const NAME_MAX = 120;

/**
 * File name safe to place after the server-generated folder. Truncation keeps
 * the extension: the confirm route decides the file kind by it.
 */
export function safeOrcamentoFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^A-Za-z0-9_.-]+/g, "-")
    .replace(/^[.-]+/, "");
  const ext = extensionOf(cleaned).replace(/[^a-z0-9]/g, "").slice(0, 10);
  if (cleaned.length === 0) return `modelo.${ext || "bin"}`;
  if (cleaned.length <= NAME_MAX) return cleaned;
  if (!ext) return cleaned.slice(0, NAME_MAX);
  const stem = cleaned.slice(0, cleaned.length - ext.length - 1).slice(0, NAME_MAX - ext.length - 1);
  return `${stem}.${ext}`;
}
