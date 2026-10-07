/**
 * Motor de Geração PDF A4 de Alta Definição — Catálogo Editorial GLTech3D (Agente 4)
 *
 * Diagramação matemática estrita A4 (210 x 297 mm, 15mm de respiro), tipografia
 * proporcional, carimbos de tolerância, capa editorial e contracapa comercial.
 */

import type { CatalogProductItem } from "./whatsapp-formatter";
import { loadPdfImages, type PdfImageResult } from "./pdf-images";
import {
  EDITORIAL_THEMES,
  CATALOG_LAYOUT_SPECS,
  formatDimensionBadge,
  TECHNICAL_BADGES,
  type CatalogLayoutMode,
  type EditorialThemeId,
} from "./editorial-design-system";
import {
  MANUFACTURING_MANIFESTO,
  MATERIAL_PROPERTIES_TABLE,
} from "./b2b-copywriting";
import { formatWhatsappDisplay } from "@/lib/landing/whatsapp-number";

export interface EditorialPdfOptions {
  theme?: EditorialThemeId;
  layoutMode?: CatalogLayoutMode;
  priceMode?: "varejo" | "atacado" | "sob_consulta";
  wholesaleDiscountPct?: number;
  includeCover?: boolean;
  includeManifesto?: boolean;
  includeBackcover?: boolean;
  includeDimensions?: boolean;
  includeMaterial?: boolean;
  includeTolerances?: boolean;
  includeImages?: boolean;
  storeName?: string;
  catalogTitle?: string;
  contactPhone?: string;
  contactEmail?: string;
  customLogoUrl?: string;
  onImageProgress?: (done: number, total: number) => void;
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return [r, g, b];
}

export function calculateEditorialPageCount(
  productsCount: number,
  options: EditorialPdfOptions,
): number {
  const layout = options.layoutMode || "grid_2x2";
  const itemsPerPage = CATALOG_LAYOUT_SPECS[layout]?.itemsPerPage || 4;
  const contentPages = Math.max(1, Math.ceil(productsCount / itemsPerPage));

  let total = contentPages;
  if (options.includeCover ?? true) total += 1;
  if (options.includeManifesto ?? true) total += 1;
  if (options.includeBackcover ?? true) total += 1;

  return total;
}

export function partitionProductsForLayout(
  products: CatalogProductItem[],
  layoutMode: CatalogLayoutMode,
): CatalogProductItem[][] {
  const itemsPerPage = CATALOG_LAYOUT_SPECS[layoutMode]?.itemsPerPage || 4;
  const pages: CatalogProductItem[][] = [];

  for (let i = 0; i < products.length; i += itemsPerPage) {
    pages.push(products.slice(i, i + itemsPerPage));
  }

  if (pages.length === 0) {
    pages.push([]);
  }

  return pages;
}

// Dimensões A4 em milímetros
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;

export async function generateEditorialCatalogPdf(
  products: CatalogProductItem[],
  options: EditorialPdfOptions = {},
): Promise<Blob> {
  const themeKey = options.theme || "warm_studio";
  const theme = EDITORIAL_THEMES[themeKey] || EDITORIAL_THEMES.warm_studio;
  const layoutKey = options.layoutMode || "grid_2x2";

  const includeCover = options.includeCover ?? true;
  const includeManifesto = options.includeManifesto ?? true;
  const includeBackcover = options.includeBackcover ?? true;
  const storeName = options.storeName || "GLTECH3D";
  const catalogTitle = options.catalogTitle || "CATÁLOGO TÉCNICO // COLEÇÃO 2026";
  const contactPhone = options.contactPhone || "11988887777";
  const contactEmail = options.contactEmail || "comercial@gltech3d.com.br";

  const bgRgb = hexToRgb(theme.bg);
  const fgRgb = hexToRgb(theme.fg);
  const surfaceRgb = hexToRgb(theme.surface);
  const borderRgb = hexToRgb(theme.border);
  const accentRgb = hexToRgb(theme.accent);
  const mutedRgb = hexToRgb(theme.muted);

  // Pré-carrega fotos
  const images: Map<string, PdfImageResult> =
    options.includeImages === false
      ? new Map()
      : await loadPdfImages(
          products.map((p) => p.photo_url),
          options.onImageProgress,
        );

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  let isFirstPage = true;

  function newPage() {
    if (!isFirstPage) {
      doc.addPage("a4", "portrait");
    }
    isFirstPage = false;

    // Pintar fundo do tema
    doc.setFillColor(...bgRgb);
    doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  }

  function drawHeader(pageTitle: string, pageNum: number, totalPages: number) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...mutedRgb);
    doc.text(storeName.toUpperCase(), MARGIN, 10);

    doc.setFont("helvetica", "normal");
    doc.text(pageTitle.toUpperCase(), PAGE_W / 2, 10, { align: "center" });

    doc.text(`PÁG. ${pageNum} // ${totalPages}`, PAGE_W - MARGIN, 10, { align: "right" });

    doc.setDrawColor(...borderRgb);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, 13, PAGE_W - MARGIN, 13);
  }

  function drawFooter() {
    doc.setDrawColor(...borderRgb);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...mutedRgb);
    doc.text(`${TECHNICAL_BADGES.standard} · ${TECHNICAL_BADGES.tolerance}`, MARGIN, PAGE_H - 7);

    const contactStr = `Atendimento: ${formatWhatsappDisplay(contactPhone)}`;
    doc.text(contactStr, PAGE_W - MARGIN, PAGE_H - 7, { align: "right" });
  }

  const totalPages = calculateEditorialPageCount(products.length, options);
  let currentPage = 1;

  // 1. CAPA EDITORIAL
  if (includeCover) {
    newPage();

    // Faixa decorativa no topo
    doc.setFillColor(...accentRgb);
    doc.rect(MARGIN, 25, 12, 3, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...accentRgb);
    doc.text(storeName.toUpperCase() + " // DIVISÃO DE MANUFATURA ADITIVA", MARGIN, 36);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(...fgRgb);
    doc.text("CATÁLOGO TÉCNICO", MARGIN, 48);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(...mutedRgb);
    doc.text("Peças de Engenharia & Protótipos de Precisão", MARGIN, 56);

    // Hero visual box na capa
    const heroBox = { x: MARGIN, y: 70, w: PAGE_W - MARGIN * 2, h: 120 };
    doc.setFillColor(...surfaceRgb);
    doc.setDrawColor(...borderRgb);
    doc.setLineWidth(0.3);
    doc.roundedRect(heroBox.x, heroBox.y, heroBox.w, heroBox.h, 2, 2, "FD");

    const heroProduct = products.find((p) => p.is_top) || products[0];
    const heroImg = heroProduct?.photo_url ? images.get(heroProduct.photo_url) : undefined;
    if (heroImg?.ok) {
      doc.addImage(heroImg.image.dataUrl, "JPEG", heroBox.x + 10, heroBox.y + 10, heroBox.w - 20, heroBox.h - 20, undefined, "FAST");
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...mutedRgb);
      doc.text("GLTech3D High-Precision 3D Manufacturing", heroBox.x + heroBox.w / 2, heroBox.y + heroBox.h / 2, { align: "center" });
    }

    // Carimbo técnico na base da capa
    doc.setFont("courier", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...fgRgb);
    doc.text("ESPECIFICAÇÕES DE FABRICAÇÃO:", MARGIN, 215);

    doc.setFont("courier", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedRgb);
    doc.text(`· TOLERÂNCIA: ${TECHNICAL_BADGES.tolerance}`, MARGIN, 222);
    doc.text(`· RESOLUÇÃO: ${TECHNICAL_BADGES.resolution}`, MARGIN, 228);
    doc.text(`· NORMAS: ${TECHNICAL_BADGES.standard}`, MARGIN, 234);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...mutedRgb);
    doc.text(`Edição Técnica 2026 · Emitido em ${new Date().toLocaleDateString("pt-BR")}`, MARGIN, PAGE_H - 20);

    currentPage++;
  }

  // 2. MANIFESTO & TABELA DE MATERIAIS
  if (includeManifesto) {
    newPage();
    drawHeader("Manifesto de Qualidade & Engenharia", currentPage, totalPages);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...fgRgb);
    doc.text(MANUFACTURING_MANIFESTO.title, MARGIN, 26);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...fgRgb);
    const manifestoLines = doc.splitTextToSize(MANUFACTURING_MANIFESTO.statement, PAGE_W - MARGIN * 2);
    doc.text(manifestoLines, MARGIN, 33);

    // Tabela de Polímeros
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...accentRgb);
    doc.text("MATRIZ DE PROPRIEDADES MECÂNICAS DOS MATERIAIS", MARGIN, 60);

    let tableY = 68;
    MATERIAL_PROPERTIES_TABLE.forEach((mat) => {
      doc.setFillColor(...surfaceRgb);
      doc.roundedRect(MARGIN, tableY, PAGE_W - MARGIN * 2, 22, 1.5, 1.5, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...fgRgb);
      doc.text(mat.name, MARGIN + 4, tableY + 6);

      doc.setFont("courier", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...mutedRgb);
      doc.text(`Densidade: ${mat.density} | Tração: ${mat.tensileStrength} | Temp. Max: ${mat.heatDeflectionTemp}`, MARGIN + 4, tableY + 12);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...fgRgb);
      doc.text(`Aplicação: ${mat.primaryApplication}`, MARGIN + 4, tableY + 18);

      tableY += 25;
    });

    drawFooter();
    currentPage++;
  }

  // 3. MIOLO DE PRODUTOS
  const productPages = partitionProductsForLayout(products, layoutKey);
  const spec = CATALOG_LAYOUT_SPECS[layoutKey];

  for (const pageItems of productPages) {
    newPage();
    drawHeader(catalogTitle, currentPage, totalPages);

    if (layoutKey === "editorial_detail" && pageItems[0]) {
      // 1 Produto Destaque Completo
      const p = pageItems[0];
      const imgBox = { x: MARGIN, y: 22, w: PAGE_W - MARGIN * 2, h: 120 };
      doc.setFillColor(...surfaceRgb);
      doc.roundedRect(imgBox.x, imgBox.y, imgBox.w, imgBox.h, 2, 2, "F");

      const imgRes = p.photo_url ? images.get(p.photo_url) : undefined;
      if (imgRes?.ok) {
        doc.addImage(imgRes.image.dataUrl, "JPEG", imgBox.x + 10, imgBox.y + 10, imgBox.w - 20, imgBox.h - 20, undefined, "FAST");
      }

      // Detalhes abaixo da foto
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(...fgRgb);
      doc.text(p.name, MARGIN, 155);

      doc.setFont("courier", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...accentRgb);
      doc.text(`CATEGORIA: ${p.category?.toUpperCase() || "MANUFATURA ADITIVA"}`, MARGIN, 163);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...mutedRgb);
      doc.text(`Material Primário: ${p.material || "PETG Industrial"}`, MARGIN, 172);
      doc.text(`Dimensões Físicas: ${formatDimensionBadge(p.dimensions)}`, MARGIN, 178);
      if (p.filament_grams) doc.text(`Massa Estimada: ${p.filament_grams}g`, MARGIN, 184);

      // Preço ou Sob Consulta
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      if (options.priceMode === "sob_consulta") {
        doc.setTextColor(...accentRgb);
        doc.text("VALOR SOB CONSULTA B2B", MARGIN, 205);
      } else {
        doc.setTextColor(...fgRgb);
        const precoReais = ((p.price_cents ?? 0) / 100).toFixed(2).replace(".", ",");
        doc.text(`R$ ${precoReais}`, MARGIN, 205);
      }
    } else {
      // Grade 2x2 ou Lista
      const cardW = (PAGE_W - MARGIN * 2 - 8) / 2;
      const cardH = 120;

      pageItems.forEach((p, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const cardX = MARGIN + col * (cardW + 8);
        const cardY = 20 + row * (cardH + 8);

        // Fundo do card
        doc.setFillColor(...surfaceRgb);
        doc.setDrawColor(...borderRgb);
        doc.setLineWidth(0.2);
        doc.roundedRect(cardX, cardY, cardW, cardH, 1.5, 1.5, "FD");

        // Área da foto
        const photoH = 65;
        doc.setFillColor(...bgRgb);
        doc.roundedRect(cardX + 2, cardY + 2, cardW - 4, photoH, 1, 1, "F");

        const imgRes = p.photo_url ? images.get(p.photo_url) : undefined;
        if (imgRes?.ok) {
          doc.addImage(imgRes.image.dataUrl, "JPEG", cardX + 4, cardY + 4, cardW - 8, photoH - 4, undefined, "FAST");
        } else {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(...mutedRgb);
          doc.text("Sem imagem técnica", cardX + cardW / 2, cardY + photoH / 2, { align: "center" });
        }

        // Título da peça
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(...fgRgb);
        doc.text(doc.splitTextToSize(p.name, cardW - 8)[0], cardX + 4, cardY + photoH + 9);

        // Metadados técnicos
        doc.setFont("courier", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...mutedRgb);
        doc.text(`DIM: ${formatDimensionBadge(p.dimensions)}`, cardX + 4, cardY + photoH + 16);
        doc.text(`MAT: ${p.material || "Polímero Industrial"}`, cardX + 4, cardY + photoH + 21);

        // Preço
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        if (options.priceMode === "sob_consulta") {
          doc.setTextColor(...accentRgb);
          doc.text("Sob Consulta", cardX + 4, cardY + cardH - 6);
        } else {
          doc.setTextColor(...fgRgb);
          const precoReais = ((p.price_cents ?? 0) / 100).toFixed(2).replace(".", ",");
          doc.text(`R$ ${precoReais}`, cardX + 4, cardY + cardH - 6);
        }
      });
    }

    drawFooter();
    currentPage++;
  }

  // 4. CONTRACAPA INSTITUCIONAL
  if (includeBackcover) {
    newPage();

    doc.setFillColor(...accentRgb);
    doc.rect(MARGIN, 40, 15, 3, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...fgRgb);
    doc.text("ENGENHARIA SOB DEMANDA", MARGIN, 56);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...fgRgb);
    doc.text("Fale com nossos engenheiros de aplicação para orçamentos e lotes industriais.", MARGIN, 68);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...accentRgb);
    doc.text("CANAIS DIRETOS:", MARGIN, 90);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...fgRgb);
    doc.text(`WhatsApp Comercial: ${formatWhatsappDisplay(contactPhone)}`, MARGIN, 100);
    doc.text(`E-mail de Engenharia: ${contactEmail}`, MARGIN, 108);
    doc.text("Website: gltech3d.vercel.app", MARGIN, 116);

    doc.setDrawColor(...borderRgb);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, 135, PAGE_W - MARGIN, 135);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...fgRgb);
    doc.text("TERMOS DE GARANTIA & VALIDAÇÃO DIMENSIONAL", MARGIN, 146);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedRgb);
    const termos =
      "Todas as peças são inspecionadas por amostragem com paquímetros digitais calibrados. Desvios térmicos ou contrações naturais de polímeros são compensados em software fatiador com fatores de escala pré-estabelecidos. Garantia total contra delaminação de camada e defeitos de extrusão.";
    doc.text(doc.splitTextToSize(termos, PAGE_W - MARGIN * 2), MARGIN, 154);

    doc.setFont("courier", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedRgb);
    doc.text("GLTECH3D // PROJETOS, PROTÓTIPOS E MANUFATURA ADITIVA", PAGE_W / 2, PAGE_H - 20, { align: "center" });
  }

  return doc.output("blob");
}
