/**
 * Layout math + small drawing helpers shared by the client-side PDFs
 * (product catalog today, filament catalog next). All units are mm.
 *
 * The math is pure (unit-tested); the `draw*` helpers take the jsPDF instance
 * so this module never imports jsPDF at runtime — it stays out of any bundle
 * until the generator itself is dynamically imported.
 */
import type { jsPDF } from "jspdf";
import type { PdfImageResult } from "./pdf-images";

export type Rgb = [number, number, number];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GridSpec {
  pageW: number;
  /** Left/right page margin. */
  margin: number;
  /** Y where the first row starts (below the header). */
  top: number;
  /** Y where the grid must end (above the footer). */
  bottom: number;
  cols: number;
  rows: number;
  /** Gap between cards, both axes. */
  gap: number;
}

/** Rect of the card at `index` (row-major) on a page laid out by `spec`. */
export function gridCellRect(index: number, spec: GridSpec): Rect {
  const w = (spec.pageW - spec.margin * 2 - spec.gap * (spec.cols - 1)) / spec.cols;
  const h = (spec.bottom - spec.top - spec.gap * (spec.rows - 1)) / spec.rows;
  const col = index % spec.cols;
  const row = Math.floor(index / spec.cols) % spec.rows;
  return { x: spec.margin + col * (w + spec.gap), y: spec.top + row * (h + spec.gap), w, h };
}

/** Number of pages needed for `count` items at `perPage` per page (min 1). */
export function pageCount(count: number, perPage: number): number {
  return Math.max(1, Math.ceil(count / Math.max(1, perPage)));
}

/** "object-fit: contain": largest rect with the image aspect, centered in `box`. */
export function containRect(imgW: number, imgH: number, box: Rect): Rect {
  if (imgW <= 0 || imgH <= 0 || box.w <= 0 || box.h <= 0) return { ...box, w: 0, h: 0 };
  const scale = Math.min(box.w / imgW, box.h / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

export interface ImageBoxStyle {
  /** Backdrop behind the photo (letterbox bars) and the placeholder fill. */
  frameRgb: Rgb;
  /** Placeholder label color. */
  mutedRgb: Rgb;
  radius?: number;
  placeholderLabel?: string;
}

/**
 * Draws a photo "contained" in `box`, or a placeholder when the image is
 * missing / failed to load. `alias` lets jsPDF embed the same photo once even
 * if it appears on several pages.
 */
export function drawImageBox(
  doc: jsPDF,
  result: PdfImageResult | undefined,
  box: Rect,
  style: ImageBoxStyle,
  alias?: string,
): void {
  const radius = style.radius ?? 2;
  doc.setFillColor(...style.frameRgb);
  doc.roundedRect(box.x, box.y, box.w, box.h, radius, radius, "F");

  if (result?.ok) {
    const r = containRect(result.image.width, result.image.height, box);
    if (r.w > 0 && r.h > 0) {
      doc.addImage(result.image.dataUrl, "JPEG", r.x, r.y, r.w, r.h, alias, "FAST");
      return;
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...style.mutedRgb);
  doc.text(style.placeholderLabel ?? "Sem foto", box.x + box.w / 2, box.y + box.h / 2, {
    align: "center",
    baseline: "middle",
  });
}

/** Truncates with an ellipsis so `text` fits `maxWidth` mm at the current font. */
export function fitText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (doc.getTextWidth(`${text.slice(0, mid).trimEnd()}…`) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo === 0 ? "…" : `${text.slice(0, lo).trimEnd()}…`;
}
