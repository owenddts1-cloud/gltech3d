export function formatCurrency(val: number | string | undefined | null): string {
  if (!val || isNaN(Number(val))) return "0,00";
  return Number(val).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function calculateDiscount(original: number | string, promo: number | string): number {
  const o = Number(original) || 0;
  const p = Number(promo) || 0;
  if (!o || !p || o <= p) return 0;
  return Math.round(((o - p) / o) * 100);
}

export function detectMarketplace(url: string = ""): string {
  const lower = url.toLowerCase();
  if (
    lower.includes("mercadolivre.com") ||
    lower.includes("mercadolivre.com.br") ||
    lower.includes("meli.la") ||
    lower.includes("melila.me")
  ) {
    return "mercadolivre";
  }
  if (lower.includes("shopee.com") || lower.includes("shope.ee") || lower.includes("sshopee.me")) {
    return "shopee";
  }
  if (lower.includes("amazon.com") || lower.includes("amzn.to")) {
    return "amazon";
  }
  if (lower.includes("aliexpress.com") || lower.includes("s.click.aliexpress.com")) {
    return "aliexpress";
  }
  if (lower.includes("tiktok.com")) {
    return "tiktok";
  }
  return "outro";
}

export type ProductNicheType = "impressao_3d" | "ferramentas" | "eletronicos" | "geral";

export function detectProductNiche(title: string = "", category: string = ""): ProductNicheType {
  const text = `${title} ${category}`.toLowerCase();
  if (
    /pla|petg|abs|tpu|resina|filamento|impressora\s*3d|creality|ender|bambu|anycubic|elegoo|k1|hotend|nozzle|bico|mesa\s*pei|extrusor|bowden|fatiador|3d\s*pen/i.test(
      text,
    )
  ) {
    return "impressao_3d";
  }
  if (
    /alicate|chave|allen|parafus|trena|solda|paquimetro|soprador|retifica|furadeira|parafusadeira|dremel|broca|ferramenta|nivel|torquimetro|lima/i.test(
      text,
    )
  ) {
    return "ferramentas";
  }
  if (
    /esp32|arduino|sensor|smart|tomada|alexa|fonte|rele|cabo|placa|camera|wifi|zigbee|bateria|led|modulo|display|multimetro|usb/i.test(
      text,
    )
  ) {
    return "eletronicos";
  }
  return "geral";
}

export function formatWelcomeMessage(
  participantPhone: string = "",
  groupName: string = "GLTech Ofertas - Impressão 3D",
): string {
  const cleanPhone = participantPhone.replace(/\D/g, "") || participantPhone;
  return [
    `🖨️ Bem-vindo @${cleanPhone} ao ${groupName}!`,
    "",
    "Aqui você encontra promoções de:",
    "🧵 Filamentos",
    "🧪 Resinas",
    "🔧 Ferramentas",
    "🖨️ Impressoras 3D",
    "⚙️ Peças, acessórios e upgrades",
    "",
    "🤖 Promoções monitoradas automaticamente ao longo do dia",
    "✅ Ofertas compartilhadas diariamente",
    "✅ Grupo gratuito",
    "🚫 Sem spam",
    "🚫 Sem conversas paralelas",
    "",
    "🔥 Muitas promoções possuem estoque limitado e podem esgotar rapidamente.",
  ].join("\n");
}

export interface FormatOptions {
  groupInviteUrl?: string;
  defaultHashtags?: string;
}

export interface FormatOfferInput {
  title?: string;
  category?: string;
  niche?: string;
  originalPrice?: number | string;
  promoPrice?: number | string;
  coupon?: string;
  couponTutorial?: string;
  couponHubUrl?: string;
  affiliateUrl?: string;
  copyStyle?: string; // "padrao" | "achado" | "cupom_mes" | "urgencia"
  marketplace?: string;
}

export function formatOfferMessage(
  offer: FormatOfferInput,
  options: FormatOptions = {},
): string {
  const lines: string[] = [];
  const style = offer.copyStyle || "padrao";
  const title = (offer.title || "Super Oferta").trim();
  const niche = detectProductNiche(title, offer.category || offer.niche || "");

  // 1. HEADLINE ESPECÍFICA DE ACORDO COM O TIPO DE PRODUTO E ESTILO
  if (niche === "impressao_3d") {
    if (style === "achado") {
      lines.push("🧵 ACHADO IMPERDÍVEL PARA QUEM IMPRIME EM 3D! 🖨️");
    } else if (style === "cupom_mes") {
      lines.push("🔥 CUPOM HISTÓRICO: FILAMENTOS & PEÇAS 3D! 🎟️");
    } else if (style === "urgencia") {
      lines.push("⚡ CORRE! FILAMENTO 3D COM PREÇO BAIXÍSSIMO! 🚨");
    } else {
      lines.push("🖨️ OFERTA ESPECIAL: FILAMENTOS & PEÇAS 3D 🧵");
    }
  } else if (niche === "ferramentas") {
    if (style === "achado") {
      lines.push("🛠️ ACHADO PARA SUA BANCADA / OFICINA MAKER! 🔧");
    } else if (style === "cupom_mes") {
      lines.push("🔥 CUPOM LIBERADO: FERRAMENTAS & MANUTENÇÃO! 🎟️");
    } else if (style === "urgencia") {
      lines.push("⚡ ÚLTIMAS UNIDADES! FERRAMENTA COM SUPER DESCONTO! 🚨");
    } else {
      lines.push("🔧 FERRAMENTA ESSENCIAL PARA SUA BANCADA 🛠️");
    }
  } else if (niche === "eletronicos") {
    if (style === "achado") {
      lines.push("💡 ACHADO TECH: SMART HOME & ELETRÔNICOS! ⚡");
    } else if (style === "cupom_mes") {
      lines.push("🔥 SUPER CUPOM TECH: AUTOMAÇÃO & SMART HOME! 🎟️");
    } else if (style === "urgencia") {
      lines.push("⚡ CORRE QUE VAI ESGOTAR! ELETRÔNICO EM PROMOÇÃO! 🚨");
    } else {
      lines.push("💡 SMART HOME & ELETRÔNICOS EM PROMOÇÃO ⚡");
    }
  } else {
    if (style === "achado") {
      lines.push("✨ ACHADO SENSACIONAL DO DIA! ✨");
    } else if (style === "cupom_mes") {
      lines.push("🔥 LIBERADO O MELHOR CUPOM DO MÊS! 🔥");
    } else if (style === "urgencia") {
      lines.push("⚡ CORRE QUE VAI ESGOTAR RÁPIDO! ⚡");
    } else {
      lines.push("🛍️ SUPER OPORTUNIDADE COM DESCONTO REAL! 🔥");
    }
  }

  lines.push("");
  lines.push(`📦 ${title}`);

  // 2. BENEFÍCIO / DESTAQUE TÉCNICO POR NICHO
  lines.push("");
  if (niche === "impressao_3d") {
    lines.push("✨ Alta precisão dimensional | Sem bolhas | Acabamento premium");
  } else if (niche === "ferramentas") {
    lines.push("✨ Precisão, durabilidade e acabamento reforçado para projetos");
  } else if (niche === "eletronicos") {
    lines.push("✨ Alta performance, conectividade e estabilidade garantida");
  } else {
    lines.push("✨ Produto selecionado com garantia de procedência e entrega rápida");
  }

  // 3. BLOCO DE PREÇOS COM CÁLCULO DE ECONOMIA REAL
  const orig = Number(offer.originalPrice) || 0;
  const promo = Number(offer.promoPrice) || 0;
  const discount = calculateDiscount(orig, promo);
  const diffSavings = orig > promo ? orig - promo : 0;

  lines.push("");
  if (orig > promo && promo > 0) {
    lines.push(`❌ De: R$ ${formatCurrency(orig)}`);
    const savingsTag = diffSavings > 0 ? ` (Economia de R$ ${formatCurrency(diffSavings)}!)` : "";
    lines.push(`✅ Por apenas: R$ ${formatCurrency(promo)} 🔥 ${discount}% OFF${savingsTag}`);
  } else if (promo > 0) {
    lines.push(`✅ Valor promocional: R$ ${formatCurrency(promo)} 🔥`);
  }

  // 4. CUPOM DE DESCONTO EM DESTAQUE
  if (offer.coupon && offer.coupon.trim().length > 0) {
    const cp = offer.coupon.trim();
    lines.push("");
    lines.push(`🎟️ CUPOM: *${cp.toUpperCase()}*`);
    lines.push("👉 Aplique o cupom no carrinho para garantir o menor valor!");
  }

  // 5. TUTORIAL DE RESGATE DE CUPOM
  if (offer.couponTutorial && offer.couponTutorial.trim().length > 0) {
    lines.push("");
    lines.push("💡 Como resgatar o desconto:");
    lines.push(offer.couponTutorial.trim());
  }

  // 6. CALL TO ACTION E LINK DE AFILIADO
  if (offer.affiliateUrl && offer.affiliateUrl.trim().length > 0) {
    lines.push("");
    lines.push("🛒 Garanta o seu pelo link oficial:");
    lines.push(`👉 ${offer.affiliateUrl.trim()}`);
  }

  // 7. CENTRAL DE CUPONS DO MARKETPLACE
  if (offer.couponHubUrl && offer.couponHubUrl.trim().length > 0) {
    lines.push("");
    lines.push(`🎟️ Resgate cupons adicionais da loja aqui:\n${offer.couponHubUrl.trim()}`);
  }

  // 8. LINK DE CONVITE DO GRUPO
  if (options.groupInviteUrl && options.groupInviteUrl.trim().length > 0) {
    lines.push("");
    lines.push(`🚀 Participe do nosso grupo de ofertas VIP:\n${options.groupInviteUrl.trim()}`);
  }

  // 9. ESCASSEZ E AVISO LEGAL
  lines.push("");
  lines.push("⚠️ Atenção: Os preços e estoques podem sofrer alteração a qualquer momento pela loja.");

  // 10. HASHTAGS OFICIAIS
  const hashtags = options.defaultHashtags || "#anúncio #cacadoresderenda #GLTech3D";
  if (hashtags.trim().length > 0) {
    lines.push("");
    lines.push(hashtags.trim());
  }

  return lines.join("\n");
}
