import type { CatalogProductItem } from "./whatsapp-formatter";
import { loadPdfImages, type PdfImageResult } from "./pdf-images";
import { drawImageBox, fitText, gridCellRect, pageCount, type GridSpec, type Rgb } from "./pdf-layout";
import { STORE_WHATSAPP_FALLBACK, formatWhatsappDisplay } from "@/lib/landing/whatsapp-number";

export const DEFAULT_PDF_CATALOG_TITLE = "CATÁLOGO DE PRODUTOS 3D";
export const DEFAULT_PDF_CATALOG_FOOTER = `GLTECH3D · Envio para todo o Brasil · ${formatWhatsappDisplay(STORE_WHATSAPP_FALLBACK)}`;

export interface PdfCatalogOptions {
  storeName?: string;
  priceMode: "varejo" | "atacado" | "custo";
  wholesaleDiscountPct?: number;
  layoutMode: "grid" | "detail"; // grid = 2x2, detail = 1x1
  theme: "dark" | "light";
  includeDimensions?: boolean;
  includeMaterial?: boolean;
  includeFooter?: boolean;
  /** Top-right header label. Default: DEFAULT_PDF_CATALOG_TITLE. */
  title?: string;
  /** Left footer text. Default: DEFAULT_PDF_CATALOG_FOOTER. */
  footerText?: string;
  /** Draw product photos (default true). */
  includeImages?: boolean;
  /** Progress while the photos download, before the PDF is built. */
  onImageProgress?: (done: number, total: number) => void;
}

const W = 210;
const H = 297;
const MARGIN = 12;
const HEADER_H = 28;
const FOOTER_H = 14;

/** 2x2 grid between the header and the footer. */
export const CATALOG_GRID: GridSpec = {
  pageW: W,
  margin: MARGIN,
  top: 35,
  bottom: H - 22,
  cols: 2,
  rows: 2,
  gap: 8,
};
const ITEMS_PER_GRID_PAGE = CATALOG_GRID.cols * CATALOG_GRID.rows;

/** Height of the photo area inside a grid card / the detail card (mm). */
export const GRID_IMAGE_H = 52;
export const DETAIL_IMAGE_H = 100;

export function catalogPageCount(productCount: number, layoutMode: PdfCatalogOptions["layoutMode"]): number {
  return layoutMode === "detail" ? Math.max(1, productCount) : pageCount(productCount, ITEMS_PER_GRID_PAGE);
}

export async function generateCatalogPdf(
  products: CatalogProductItem[],
  options: PdfCatalogOptions,
): Promise<Blob> {
  // Photos first (the slow part), so the UI can show progress before jsPDF runs.
  const images: Map<string, PdfImageResult> =
    options.includeImages === false
      ? new Map()
      : await loadPdfImages(
          products.map((p) => p.image_url),
          { onProgress: options.onImageProgress },
        );

  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF("p", "mm", "a4");

  const storeName = options.storeName || "GLTECH3D";
  const discount = options.wholesaleDiscountPct ?? 15;
  const title = options.title?.trim() || DEFAULT_PDF_CATALOG_TITLE;
  const footerText = options.footerText?.trim() || DEFAULT_PDF_CATALOG_FOOTER;

  const isDark = options.theme === "dark";
  const bgRgb: Rgb = isDark ? [15, 23, 42] : [255, 255, 255];
  const cardBgRgb: Rgb = isDark ? [30, 41, 59] : [248, 250, 252];
  const frameRgb: Rgb = isDark ? [51, 65, 85] : [226, 232, 240];
  const textRgb: Rgb = isDark ? [241, 245, 249] : [30, 41, 59];
  const mutedRgb: Rgb = isDark ? [148, 163, 184] : [100, 116, 139];
  const accentRgb: Rgb = [234, 179, 8]; // Dourado GLTECH
  const barRgb: Rgb = isDark ? [2, 6, 23] : [241, 245, 249];

  const imageStyle = { frameRgb, mutedRgb, radius: 2 };
  const imageFor = (p: CatalogProductItem): PdfImageResult | undefined => {
    const url = p.image_url?.trim();
    return url ? images.get(url) : undefined;
  };

  function finalPriceCents(p: CatalogProductItem): number {
    if (options.priceMode === "atacado") return Math.round(p.sale_price_cents * (1 - discount / 100));
    if (options.priceMode === "custo") return p.cost_total_cents ?? p.sale_price_cents;
    return p.sale_price_cents;
  }

  const brl = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  function drawBackground() {
    doc.setFillColor(...bgRgb);
    doc.rect(0, 0, W, H, "F");
  }

  function drawHeader() {
    doc.setFillColor(...barRgb);
    doc.rect(0, 0, W, HEADER_H, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...textRgb);
    doc.text(fitText(doc, storeName.toUpperCase(), W / 2 - MARGIN), MARGIN, 16);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...accentRgb);
    doc.text(fitText(doc, title, W / 2 - MARGIN), W - MARGIN, 12, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...mutedRgb);
    const dateStr = new Date().toLocaleDateString("pt-BR");
    doc.text(
      options.priceMode === "atacado"
        ? `Tabela Atacado (-${discount}%) · ${dateStr}`
        : options.priceMode === "custo"
        ? `Relatório de Custos · ${dateStr}`
        : `Tabela Varejo · ${dateStr}`,
      W - MARGIN,
      19,
      { align: "right" },
    );
  }

  function drawFooter(pageNum: number, totalPages: number) {
    if (options.includeFooter === false) return;
    doc.setFillColor(...barRgb);
    doc.rect(0, H - FOOTER_H, W, FOOTER_H, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...mutedRgb);
    doc.text(fitText(doc, footerText, W - MARGIN * 2 - 30), MARGIN, H - 5);
    doc.text(`Página ${pageNum} de ${totalPages}`, W - MARGIN, H - 5, { align: "right" });
  }

  if (products.length === 0) {
    drawBackground();
    drawHeader();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(...mutedRgb);
    doc.text("Nenhum produto selecionado para exibição.", W / 2, H / 2, { align: "center" });
    drawFooter(1, 1);
    return doc.output("blob");
  }

  const totalPages = catalogPageCount(products.length, options.layoutMode);

  if (options.layoutMode === "detail") {
    // 1 produto por página
    products.forEach((p, idx) => {
      if (idx > 0) doc.addPage();
      drawBackground();
      drawHeader();

      const cardX = MARGIN;
      const cardW = W - MARGIN * 2;
      const innerX = cardX + 8;
      const innerW = cardW - 16;
      let y = 38;

      // Card Container principal
      doc.setFillColor(...cardBgRgb);
      doc.roundedRect(cardX, y, cardW, H - 65, 4, 4, "F");

      // Foto
      drawImageBox(
        doc,
        imageFor(p),
        { x: innerX, y: y + 8, w: innerW, h: DETAIL_IMAGE_H },
        imageStyle,
        p.image_url?.trim() || undefined,
      );
      y += 8 + DETAIL_IMAGE_H + 12;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(...textRgb);
      doc.text(fitText(doc, p.name, p.is_bestseller ? innerW - 42 : innerW), innerX, y);

      if (p.is_bestseller) {
        doc.setFillColor(...accentRgb);
        doc.roundedRect(W - MARGIN - 45, y - 6, 37, 7, 1.5, 1.5, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(15, 23, 42);
        doc.text("★ MAIS VENDIDO", W - MARGIN - 26, y - 1, { align: "center" });
      }

      y += 8;
      if (p.hero_copy) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(...mutedRgb);
        doc.text(fitText(doc, p.hero_copy, innerW), innerX, y);
        y += 8;
      }

      // Preço em destaque
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(...accentRgb);
      doc.text(brl(finalPriceCents(p)), innerX, y);

      if (options.priceMode === "atacado") {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...mutedRgb);
        doc.text(`(De ${brl(p.sale_price_cents)} no Varejo)`, MARGIN + 70, y - 2);
      }

      y += 14;
      // Especificações Técnicas
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...textRgb);
      doc.text("Especificações do Produto:", innerX, y);

      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...mutedRgb);

      if (options.includeMaterial && p.material) {
        doc.text(fitText(doc, `• Material: ${p.material}`, innerW - 4), innerX + 4, y);
        y += 6;
      }
      if (options.includeDimensions && p.dimensions) {
        doc.text(fitText(doc, `• Dimensões: ${p.dimensions}`, innerW - 4), innerX + 4, y);
        y += 6;
      }
      doc.text(`• Tecnologia: Impressão 3D FDM de Alta Resolução`, innerX + 4, y);
      y += 6;
      doc.text(`• Acabamento: Inspeção e pós-processamento artesanal`, innerX + 4, y);

      drawFooter(idx + 1, totalPages);
    });
  } else {
    // Grid 2x2 (4 produtos por página)
    for (let page = 0; page < totalPages; page++) {
      if (page > 0) doc.addPage();
      drawBackground();
      drawHeader();

      const pageProducts = products.slice(page * ITEMS_PER_GRID_PAGE, (page + 1) * ITEMS_PER_GRID_PAGE);

      pageProducts.forEach((p, indexOnPage) => {
        const { x, y, w: cardW, h: cardH } = gridCellRect(indexOnPage, CATALOG_GRID);
        const innerW = cardW - 12;

        // Sub-card
        doc.setFillColor(...cardBgRgb);
        doc.roundedRect(x, y, cardW, cardH, 3, 3, "F");

        // Foto
        drawImageBox(
          doc,
          imageFor(p),
          { x: x + 4, y: y + 4, w: cardW - 8, h: GRID_IMAGE_H },
          imageStyle,
          p.image_url?.trim() || undefined,
        );

        let innerY = y + 4 + GRID_IMAGE_H + 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...textRgb);
        doc.text(fitText(doc, p.name, innerW), x + 6, innerY);

        innerY += 6;
        if (p.hero_copy) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(...mutedRgb);
          doc.text(fitText(doc, p.hero_copy, innerW), x + 6, innerY);
          innerY += 6;
        }

        // Especificações curtas
        innerY += 1;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...mutedRgb);

        if (options.includeMaterial && p.material) {
          doc.text(fitText(doc, `Material: ${p.material}`, innerW), x + 6, innerY);
          innerY += 5;
        }
        if (options.includeDimensions && p.dimensions) {
          doc.text(fitText(doc, `Tam: ${p.dimensions}`, innerW), x + 6, innerY);
          innerY += 5;
        }

        // Preço
        innerY = y + cardH - 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(...accentRgb);
        doc.text(brl(finalPriceCents(p)), x + 6, innerY);

        if (p.is_bestseller) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(...accentRgb);
          doc.text("★ DESTAQUE", x + cardW - 6, innerY, { align: "right" });
        }
      });

      drawFooter(page + 1, totalPages);
    }
  }

  return doc.output("blob");
}
