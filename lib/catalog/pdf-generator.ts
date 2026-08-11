import type { CatalogProductItem } from "./whatsapp-formatter";

export interface PdfCatalogOptions {
  storeName?: string;
  priceMode: "varejo" | "atacado" | "custo";
  wholesaleDiscountPct?: number;
  layoutMode: "grid" | "detail"; // grid = 2x2, detail = 1x1
  theme: "dark" | "light";
  includeDimensions?: boolean;
  includeMaterial?: boolean;
  includeFooter?: boolean;
}

export async function generateCatalogPdf(
  products: CatalogProductItem[],
  options: PdfCatalogOptions,
): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF("p", "mm", "a4");

  const W = 210;
  const H = 297;
  const margin = 12;
  const storeName = options.storeName || "GLTECH3D";
  const discount = options.wholesaleDiscountPct ?? 15;

  const isDark = options.theme === "dark";
  const bgRgb: [number, number, number] = isDark ? [15, 23, 42] : [255, 255, 255];
  const cardBgRgb: [number, number, number] = isDark ? [30, 41, 59] : [248, 250, 252];
  const textRgb: [number, number, number] = isDark ? [241, 245, 249] : [30, 41, 59];
  const mutedRgb: [number, number, number] = isDark ? [148, 163, 184] : [100, 116, 139];
  const accentRgb: [number, number, number] = [234, 179, 8]; // Dourado GLTECH

  function drawBackground() {
    doc.setFillColor(...bgRgb);
    doc.rect(0, 0, W, H, "F");
  }

  function drawHeader() {
    // Header Bar
    const headerBg: [number, number, number] = isDark ? [2, 6, 23] : [241, 245, 249];
    doc.setFillColor(...headerBg);
    doc.rect(0, 0, W, 28, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...textRgb);
    doc.text(storeName.toUpperCase(), margin, 16);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...accentRgb);
    doc.text("CATÁLOGO DE PRODUTOS 3D", W - margin, 12, { align: "right" });

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
      W - margin,
      19,
      { align: "right" },
    );
  }

  function drawFooter(pageNum: number, totalPages: number) {
    if (options.includeFooter === false) return;
    const footerBg: [number, number, number] = isDark ? [2, 6, 23] : [241, 245, 249];
    doc.setFillColor(...footerBg);
    doc.rect(0, H - 14, W, 14, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...mutedRgb);
    doc.text("GLTECH3D · Envio para todo o Brasil · (31) 99928-4834", margin, H - 5);
    doc.text(`Página ${pageNum} de ${totalPages}`, W - margin, H - 5, { align: "right" });
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

  if (options.layoutMode === "detail") {
    // 1 produto por página
    const totalPages = products.length;
    products.forEach((p, idx) => {
      if (idx > 0) doc.addPage();
      drawBackground();
      drawHeader();

      let y = 38;

      // Card Container principal
      doc.setFillColor(...cardBgRgb);
      doc.roundedRect(margin, y, W - margin * 2, H - 65, 4, 4, "F");

      y += 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(...textRgb);
      doc.text(p.name, margin + 8, y);

      if (p.is_bestseller) {
        doc.setFillColor(...accentRgb);
        doc.roundedRect(W - margin - 45, y - 6, 37, 7, 1.5, 1.5, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(15, 23, 42);
        doc.text("★ MAIS VENDIDO", W - margin - 26, y - 1, { align: "center" });
      }

      y += 8;
      if (p.hero_copy) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(...mutedRgb);
        doc.text(p.hero_copy, margin + 8, y);
        y += 8;
      }

      // Preço em destaque
      y += 6;
      let finalPriceCents = p.sale_price_cents;
      if (options.priceMode === "atacado") {
        finalPriceCents = Math.round(p.sale_price_cents * (1 - discount / 100));
      } else if (options.priceMode === "custo") {
        finalPriceCents = p.cost_total_cents ?? p.sale_price_cents;
      }

      const priceFormatted = (finalPriceCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(...accentRgb);
      doc.text(priceFormatted, margin + 8, y);

      if (options.priceMode === "atacado") {
        const origFormatted = (p.sale_price_cents / 100).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...mutedRgb);
        doc.text(`(De ${origFormatted} no Varejo)`, margin + 70, y - 2);
      }

      y += 18;
      // Especificações Técnicas
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...textRgb);
      doc.text("Especificações do Produto:", margin + 8, y);

      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...mutedRgb);

      if (options.includeMaterial && p.material) {
        doc.text(`• Material: ${p.material}`, margin + 12, y);
        y += 6;
      }
      if (options.includeDimensions && p.dimensions) {
        doc.text(`• Dimensões: ${p.dimensions}`, margin + 12, y);
        y += 6;
      }
      doc.text(`• Tecnologia: Impressão 3D FDM de Alta Resolução`, margin + 12, y);
      y += 6;
      doc.text(`• Acabamento: Inspeção e pós-processamento artesanal`, margin + 12, y);

      drawFooter(idx + 1, totalPages);
    });
  } else {
    // Grid 2x2 (4 produtos por página)
    const itemsPerPage = 4;
    const totalPages = Math.ceil(products.length / itemsPerPage);

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) doc.addPage();
      drawBackground();
      drawHeader();

      const pageProducts = products.slice(page * itemsPerPage, (page + 1) * itemsPerPage);
      const cardW = (W - margin * 2 - 8) / 2;
      const cardH = (H - 45 - 20) / 2;

      pageProducts.forEach((p, indexOnPage) => {
        const col = indexOnPage % 2;
        const row = Math.floor(indexOnPage / 2);
        const x = margin + col * (cardW + 8);
        const y = 35 + row * (cardH + 8);

        // Sub-card
        doc.setFillColor(...cardBgRgb);
        doc.roundedRect(x, y, cardW, cardH, 3, 3, "F");

        let innerY = y + 10;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...textRgb);

        const titleText = p.name.length > 24 ? p.name.substring(0, 22) + "…" : p.name;
        doc.text(titleText, x + 6, innerY);

        innerY += 6;
        if (p.hero_copy) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(...mutedRgb);
          const copyText = p.hero_copy.length > 32 ? p.hero_copy.substring(0, 30) + "…" : p.hero_copy;
          doc.text(copyText, x + 6, innerY);
          innerY += 6;
        }

        // Especificações curtas
        innerY += 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...mutedRgb);

        if (options.includeMaterial && p.material) {
          doc.text(`Material: ${p.material}`, x + 6, innerY);
          innerY += 5;
        }
        if (options.includeDimensions && p.dimensions) {
          doc.text(`Tam: ${p.dimensions}`, x + 6, innerY);
          innerY += 5;
        }

        // Preço
        innerY = y + cardH - 12;
        let finalPriceCents = p.sale_price_cents;
        if (options.priceMode === "atacado") {
          finalPriceCents = Math.round(p.sale_price_cents * (1 - discount / 100));
        } else if (options.priceMode === "custo") {
          finalPriceCents = p.cost_total_cents ?? p.sale_price_cents;
        }

        const priceFormatted = (finalPriceCents / 100).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(...accentRgb);
        doc.text(priceFormatted, x + 6, innerY);

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
