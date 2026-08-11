export interface CatalogProductItem {
  id: string;
  name: string;
  slug?: string | null;
  sale_price_cents: number;
  cost_total_cents?: number;
  material?: string | null;
  dimensions?: string | null;
  hero_copy?: string | null;
  stock_qty?: number;
  is_bestseller?: boolean;
  image_url?: string | null;
}

export interface WhatsAppCatalogOptions {
  storeName?: string;
  whatsappNumber?: string;
  priceMode: "varejo" | "atacado" | "custo";
  wholesaleDiscountPct?: number;
  includeLinks?: boolean;
  includeDimensions?: boolean;
  includeMaterial?: boolean;
  baseUrl?: string;
}

export function formatCatalogForWhatsApp(
  products: CatalogProductItem[],
  options: WhatsAppCatalogOptions,
): string {
  const storeName = options.storeName || "GLTECH3D";
  const baseUrl = options.baseUrl || "https://gltech3d.com.br";
  const discount = options.wholesaleDiscountPct ?? 15;

  let text = `🚀 *CATÁLOGO DE PRODUTOS — ${storeName.toUpperCase()}*\n`;
  if (options.priceMode === "atacado") {
    text += `🏷️ *CONDIÇÕES ESPECIAIS DE ATACADO* (${discount}% de desconto aplicado)\n`;
  } else if (options.priceMode === "custo") {
    text += `⚙️ *RELATÓRIO DE CUSTOS DE PRODUÇÃO* (Uso Interno)\n`;
  }
  text += `─────────────────────────\n\n`;

  if (products.length === 0) {
    return text + "Nenhum produto selecionado para o catálogo.";
  }

  products.forEach((p, idx) => {
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

    text += `${idx + 1}. *${p.name.trim()}*\n`;
    if (p.hero_copy) text += `   _${p.hero_copy.trim()}_\n`;

    if (options.priceMode === "atacado") {
      const origFormatted = (p.sale_price_cents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      text += `   De ~${origFormatted}~ por *${priceFormatted}*\n`;
    } else if (options.priceMode === "custo") {
      text += `   Custo Base: *${priceFormatted}*\n`;
    } else {
      text += `   Preço: *${priceFormatted}*\n`;
    }

    if (options.includeMaterial && p.material) {
      text += `   🧱 Material: ${p.material}\n`;
    }
    if (options.includeDimensions && p.dimensions) {
      text += `   📏 Dimensões: ${p.dimensions}\n`;
    }
    if (options.includeLinks && p.slug) {
      text += `   🔗 Link: ${baseUrl}/product/${p.slug}\n`;
    }
    text += `\n`;
  });

  text += `─────────────────────────\n`;
  text += `📦 *Envio para todo o Brasil* | Peças em impressão 3D de alta precisão\n`;
  if (options.whatsappNumber) {
    text += `💬 *Fale conosco pelo WhatsApp:* https://wa.me/${options.whatsappNumber.replace(/\D/g, "")}\n`;
  } else {
    text += `💬 *Fale conosco pelo WhatsApp:* https://wa.me/5531999284834\n`;
  }

  return text;
}
