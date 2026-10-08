/**
 * Image pipeline for client-side PDFs (product catalog, filament catalog).
 *
 * Browser only: fetch → Blob → FileReader data URL → <img> → canvas downscale →
 * JPEG data URL, ready for `jsPDF.addImage`. Downscaling keeps the PDF small
 * (a 4000px phone photo becomes ≤ 800px, ~60–120 KB) and re-encoding to JPEG
 * normalizes PNG/WebP/AVIF, which jsPDF does not all handle.
 *
 * Failures (CORS, 404, decode error) never throw: they come back as
 * `{ ok: false, reason }` so the caller draws a placeholder and moves on.
 */

export interface PdfImage {
  /** `data:image/jpeg;base64,...` */
  dataUrl: string;
  /** Pixel size after downscale — only the aspect ratio matters to the PDF. */
  width: number;
  height: number;
}

export type PdfImageResult = { ok: true; image: PdfImage } | { ok: false; reason: string };

export const DEFAULT_PDF_IMAGE_MAX_PX = 800;
export const DEFAULT_PDF_IMAGE_QUALITY = 0.8;

/** Downscale (never upscale) so the longest side is at most `maxPx`. */
export function fitWithin(
  width: number,
  height: number,
  maxPx: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= maxPx) return { width, height };
  const scale = maxPx / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("FileReader returned a non-string result"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });
}

/**
 * Loads `url` and returns it as a downscaled JPEG data URL.
 * The image is painted over white first: JPEG has no alpha, and transparent
 * PNG areas would otherwise turn black.
 */
export async function loadImageAsJpegDataUrl(
  url: string,
  maxPx: number = DEFAULT_PDF_IMAGE_MAX_PX,
  quality: number = DEFAULT_PDF_IMAGE_QUALITY,
): Promise<PdfImageResult> {
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const blob = await res.blob();
    if (blob.type && !blob.type.startsWith("image/")) {
      return { ok: false, reason: `not an image (${blob.type})` };
    }

    // A data URL is same-origin for the canvas, so it is never tainted.
    const img = await decodeImage(await readBlobAsDataUrl(blob));
    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, maxPx);
    if (width === 0 || height === 0) return { ok: false, reason: "empty image" };

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, reason: "canvas 2d unavailable" };
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);

    return { ok: true, image: { dataUrl: canvas.toDataURL("image/jpeg", quality), width, height } };
  } catch (err) {
    // fetch() rejects with a bare TypeError on CORS/network failure.
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

export interface LoadPdfImagesOptions {
  maxPx?: number;
  quality?: number;
  /** Parallel downloads. Small on purpose: mobile + many photos. */
  concurrency?: number;
  /** Called after each image settles (success or failure). */
  onProgress?: (done: number, total: number) => void;
}

/** Unique, non-empty URLs in first-seen order. */
export function uniqueImageUrls(urls: ReadonlyArray<string | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const u of urls) {
    const t = u?.trim();
    if (t) seen.add(t);
  }
  return [...seen];
}

/**
 * Loads every distinct URL (bounded concurrency) and returns url → result.
 * Never rejects: each failure is a `{ ok: false }` entry.
 */
export async function loadPdfImages(
  urls: ReadonlyArray<string | null | undefined>,
  options: LoadPdfImagesOptions = {},
): Promise<Map<string, PdfImageResult>> {
  const list = uniqueImageUrls(urls);
  const results = new Map<string, PdfImageResult>();
  const total = list.length;
  const concurrency = Math.max(1, options.concurrency ?? 4);
  let next = 0;
  let done = 0;
  options.onProgress?.(0, total);

  const worker = async (): Promise<void> => {
    while (next < list.length) {
      const url = list[next++];
      if (url === undefined) return;
      results.set(url, await loadImageAsJpegDataUrl(url, options.maxPx, options.quality));
      done += 1;
      options.onProgress?.(done, total);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
  return results;
}
