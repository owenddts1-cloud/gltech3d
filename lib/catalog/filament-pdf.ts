/**
 * Filament catalog PDF (CRM → Filamentos → "Catálogo em PDF").
 *
 * Cover with the store contact + one card per filament (photo or color swatch,
 * title, material/line/brand, diameter·weight, temperatures, availability and,
 * only when asked, the price — the "sem preço" version goes to maker groups,
 * see docs/marketing/plano-de-vendas.md §4).
 *
 * Reuses the image pipeline (pdf-images.ts) and layout helpers (pdf-layout.ts)
 * of the products PDF. jsPDF is imported lazily, so it never enters a bundle
 * until the button is clicked.
 */
import type { FilamentAvailability } from "@/lib/filament-catalog/schemas";
import { formatNetWeight } from "@/lib/filament-catalog/title";
import { loadPdfImages, type PdfImageResult } from "./pdf-images";
import { drawImageBox, fitText, gridCellRect, pageCount, type GridSpec, type Rgb } from "./pdf-layout";

export interface FilamentPdfItem {
  id: string;
  name: string;
  images: string[];
  colorHex: string | null;
  colorName: string | null;
  materialId: string | null;
  materialName: string | null;
  line: string | null;
  brand: string | null;
  diameterMm: number;
  netWeightG: number | null;
  nozzleTempMin: number | null;
  nozzleTempMax: number | null;
  bedTempMin: number | null;
  bedTempMax: number | null;
  availability: FilamentAvailability;
  availabilityLabel: string;
  priceCents: number | null;
  isPublished: boolean;
}

export interface FilamentPdfOptions {
  title?: string;
  storeName?: string;
  /** Human-formatted store WhatsApp for the cover and footer, e.g. "(31) 99928-4834". */
  storeWhatsapp?: string;
  withPrice: boolean;
  theme: "light" | "dark";
  includeImages?: boolean;
  onImageProgress?: (done: number, total: number) => void;
}

export const DEFAULT_FILAMENT_PDF_TITLE = "Catálogo de Filamentos";

const W = 210;
const H = 297;
const MARGIN = 12;

/** 2 columns × 3 rows below a slim header, above the footer. */
export const FILAMENT_GRID: GridSpec = {
  pageW: W,
  margin: MARGIN,
  top: 30,
  bottom: H - 20,
  cols: 2,
  rows: 3,
  gap: 6,
};
export const FILAMENTS_PER_PAGE = FILAMENT_GRID.cols * FILAMENT_GRID.rows;
/** Photo strip height inside a card (mm). */
export const FILAMENT_CARD_IMAGE_H = 34;

export interface FilamentPdfSelection {
  onlyPublished: boolean;
  /** "" = every material. */
  materialId: string;
}

/** Which filaments go into the PDF, keeping the given (manual) order. */
export function selectFilamentsForPdf<T extends Pick<FilamentPdfItem, "isPublished" | "materialId">>(
  list: readonly T[],
  sel: FilamentPdfSelection,
): T[] {
  return list.filter((f) => (!sel.onlyPublished || f.isPublished) && (!sel.materialId || f.materialId === sel.materialId));
}

/** Total pages: cover + card pages. */
export function filamentPdfPageCount(count: number): number {
  return 1 + (count === 0 ? 1 : pageCount(count, FILAMENTS_PER_PAGE));
}

/** `#A6815C` → `[166, 129, 92]`; null for anything else. */
export function hexToRgb(hex: string | null | undefined): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m?.[1]) return null;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** PDF-safe temperature text (plain hyphen: Helvetica's WinAnsi has no en dash glyph guarantee). */
export function pdfTempRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min == null || max == null || min === max) return `${min ?? max}°C`;
  return `${min}-${max}°C`;
}

const AVAILABILITY_RGB: Record<FilamentAvailability, Rgb> = {
  em_estoque: [111, 127, 82],
  ultimas_unidades: [201, 138, 43],
  sob_encomenda: [166, 129, 92],
  esgotado: [180, 85, 63],
};

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function generateFilamentPdf(items: FilamentPdfItem[], options: FilamentPdfOptions): Promise<Blob> {
  const images: Map<string, PdfImageResult> =
    options.includeImages === false
      ? new Map()
      : await loadPdfImages(
          items.map((f) => f.images[0]),
          { onProgress: options.onImageProgress },
        );

  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF("p", "mm", "a4");

  const dark = options.theme === "dark";
  const bg: Rgb = dark ? [30, 26, 23] : [250, 249, 246];
  const card: Rgb = dark ? [43, 38, 34] : [255, 255, 255];
  const frame: Rgb = dark ? [62, 54, 47] : [240, 235, 227];
  const text: Rgb = dark ? [249, 247, 242] : [43, 38, 34];
  const muted: Rgb = dark ? [200, 190, 178] : [107, 94, 85];
  const bronze: Rgb = [166, 129, 92];
  const line: Rgb = dark ? [70, 61, 53] : [232, 226, 217];

  const title = options.title?.trim() || DEFAULT_FILAMENT_PDF_TITLE;
  const store = options.storeName?.trim() || "GLTech3D";
  const totalPages = filamentPdfPageCount(items.length);
  const dateStr = new Date().toLocaleDateString("pt-BR");

  const background = () => {
    doc.setFillColor(...bg);
    doc.rect(0, 0, W, H, "F");
  };

  const footer = (page: number) => {
    doc.setDrawColor(...line);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, H - 13, W - MARGIN, H - 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    const contact = options.storeWhatsapp ? `${store} · WhatsApp ${options.storeWhatsapp}` : store;
    doc.text(fitText(doc, contact, W - MARGIN * 2 - 30), MARGIN, H - 7);
    doc.text(`${page}/${totalPages}`, W - MARGIN, H - 7, { align: "right" });
  };

  // ── Cover ────────────────────────────────────────────────────────────────
  background();
  doc.setFillColor(...(dark ? ([20, 17, 15] as Rgb) : ([43, 38, 34] as Rgb)));
  doc.rect(0, 0, W, 120, "F");

  // Spools row: up to 12 distinct colors of the selection.
  const colors = [...new Set(items.map((f) => f.colorHex).filter((h): h is string => hexToRgb(h) !== null))].slice(0, 12);
  colors.forEach((hex, i) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    const cx = MARGIN + 8 + i * 15.5;
    doc.setFillColor(...rgb);
    doc.circle(cx, 30, 7, "F");
    doc.setFillColor(43, 38, 34);
    doc.circle(cx, 30, 2.2, "F");
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...bronze);
  doc.text(store.toUpperCase(), MARGIN, 62);
  doc.setFontSize(30);
  doc.setTextColor(249, 247, 242);
  doc.text(fitText(doc, title, W - MARGIN * 2), MARGIN, 78);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(213, 203, 191);
  doc.text("Testados na nossa produção · pedido pelo WhatsApp", MARGIN, 90);
  doc.setFontSize(9);
  doc.text(`${items.length} ${items.length === 1 ? "item" : "itens"} · atualizado em ${dateStr}`, MARGIN, 104);

  const materials = [...new Set(items.map((f) => f.materialName).filter((m): m is string => !!m))];
  doc.setTextColor(...text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Como pedir", MARGIN, 142);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  const how = [
    "1. Escolha o filamento, a cor e a quantidade.",
    options.storeWhatsapp
      ? `2. Chame no WhatsApp ${options.storeWhatsapp} com o nome do item.`
      : "2. Chame no WhatsApp com o nome do item.",
    "3. A loja confirma estoque, frete e forma de pagamento.",
  ];
  how.forEach((l, i) => doc.text(l, MARGIN, 152 + i * 7));
  if (!options.withPrice) {
    doc.text("Preços e tabela de atacado: consulte pelo WhatsApp.", MARGIN, 152 + how.length * 7 + 4);
  }
  if (materials.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...text);
    doc.text("Materiais", MARGIN, 200);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...muted);
    doc.text(fitText(doc, materials.join(" · "), W - MARGIN * 2), MARGIN, 208);
  }
  footer(1);

  // ── Card pages ───────────────────────────────────────────────────────────
  const cardPages = totalPages - 1;
  for (let p = 0; p < cardPages; p++) {
    doc.addPage();
    background();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...text);
    doc.text(fitText(doc, title, 120), MARGIN, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(options.withPrice ? `Preços de ${dateStr}` : "Preços pelo WhatsApp", W - MARGIN, 18, { align: "right" });

    if (items.length === 0) {
      doc.setFontSize(11);
      doc.text("Nenhum filamento selecionado.", W / 2, H / 2, { align: "center" });
    }

    items.slice(p * FILAMENTS_PER_PAGE, (p + 1) * FILAMENTS_PER_PAGE).forEach((f, idx) => {
      const r = gridCellRect(idx, FILAMENT_GRID);
      const innerX = r.x + 5;
      const innerW = r.w - 10;
      doc.setFillColor(...card);
      doc.setDrawColor(...line);
      doc.setLineWidth(0.25);
      doc.roundedRect(r.x, r.y, r.w, r.h, 3, 3, "FD");

      const photo = f.images[0]?.trim();
      const imgBox = { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: FILAMENT_CARD_IMAGE_H };
      if (photo && options.includeImages !== false) {
        drawImageBox(doc, images.get(photo), imgBox, { frameRgb: frame, mutedRgb: muted, radius: 2 }, photo);
      } else {
        doc.setFillColor(...frame);
        doc.roundedRect(imgBox.x, imgBox.y, imgBox.w, imgBox.h, 2, 2, "F");
      }
      // Color swatch (spool) over the bottom-left corner of the photo.
      const rgb = hexToRgb(f.colorHex);
      const sx = innerX + 7;
      const sy = imgBox.y + imgBox.h - 2;
      doc.setFillColor(...card);
      doc.circle(sx, sy, 7.6, "F");
      if (rgb) {
        doc.setFillColor(...rgb);
        doc.circle(sx, sy, 6.4, "F");
        doc.setFillColor(...card);
        doc.circle(sx, sy, 1.8, "F");
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.setTextColor(...muted);
        doc.text("cor", sx, sy + 1, { align: "center" });
      }

      // Availability badge, top-right of the photo.
      const badge = f.availabilityLabel.toUpperCase();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      const bw = doc.getTextWidth(badge) + 6;
      doc.setFillColor(...AVAILABILITY_RGB[f.availability]);
      doc.roundedRect(imgBox.x + imgBox.w - bw - 2, imgBox.y + 2, bw, 5, 1.5, 1.5, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(badge, imgBox.x + imgBox.w - bw / 2 - 2, imgBox.y + 5.4, { align: "center" });

      let y = imgBox.y + imgBox.h + 10;
      const eyebrow = [f.materialName, f.line, f.brand].filter(Boolean).join(" · ").toUpperCase();
      if (eyebrow) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(...bronze);
        doc.text(fitText(doc, eyebrow, innerW), innerX, y);
        y += 5;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...text);
      doc.text(fitText(doc, f.name, innerW), innerX, y);
      y += 5.5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      const diameter = `${f.diameterMm.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} mm`;
      const weight = formatNetWeight(f.netWeightG);
      doc.text(weight ? `${diameter} · ${weight}` : diameter, innerX, y);
      y += 4.5;
      const nozzle = pdfTempRange(f.nozzleTempMin, f.nozzleTempMax);
      const bed = pdfTempRange(f.bedTempMin, f.bedTempMax);
      const temps = [nozzle ? `Bico ${nozzle}` : null, bed ? `Mesa ${bed}` : null].filter(Boolean).join(" · ");
      if (temps) doc.text(fitText(doc, temps, innerW), innerX, y);

      if (options.withPrice && f.priceCents != null && f.priceCents > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...text);
        doc.text(brl(f.priceCents), r.x + r.w - 5, r.y + r.h - 5, { align: "right" });
      }
    });
    footer(p + 2);
  }

  return doc.output("blob");
}
