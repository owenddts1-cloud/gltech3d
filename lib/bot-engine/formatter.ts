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
    /alicate|chave|allen|parafus|trena|solda|paquimetro|soprador|retifica|furadeira|parafusadeira|dremel|broca|ferramenta|nivel|torquimetro|lima|espatula/i.test(
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

/**
 * Extrai benefícios e destaques técnicos específicos baseados nas palavras-chave do título.
 */
export function extractProductHighlights(title: string = "", niche: ProductNicheType = "geral", seed: number = 0): string[] {
  const t = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const highlights: string[] = [];

  // Impressão 3D e Filamentos
  if (/pla\+|pla\s*plus/i.test(t)) {
    highlights.push("🌱 PLA+ Reforçado: Menos quebras e maior resistência a impactos");
    highlights.push("✨ Alta adesão entre camadas e acabamento brilhante");
  } else if (/petg/i.test(t)) {
    highlights.push("💪 Resistência mecânica e química superior: ideal para peças funcionais");
    highlights.push("🌡️ Suporta temperaturas moderadas sem deformar");
  } else if (/abs/i.test(t)) {
    highlights.push("🛡️ Alta rigidez e resistência térmica: acabamento liso com acetona");
  } else if (/tpu|flex/i.test(t)) {
    highlights.push("🌀 Flexibilidade máxima: absorve impacto sem rasgar");
  } else if (/resina|resin/i.test(t)) {
    highlights.push("🔬 Resolução microscópica ultra nítida | Cura rápida UV");
    highlights.push("✨ Baixo odor e excelente definição de detalhes");
  } else if (/filamento/i.test(t)) {
    highlights.push("🧵 Enrolamento preciso sem nós | Diâmetro uniforme 1.75mm");
    highlights.push("✨ Secagem a vácuo de fábrica para zero bolhas");
  }

  // Peças de Impressora 3D
  if (/bico|nozzle/i.test(t)) {
    highlights.push("🔥 Fluxo térmico estável | Reduz entupimentos em impressões rápidas");
  } else if (/mesa\s*pei|pei\s*sheet|build\s*plate/i.test(t)) {
    highlights.push("🧲 Adesão magnética perfeita a quente | Peça solta fácil ao esfriar");
  } else if (/hotend|bimetal/i.test(t)) {
    highlights.push("🌡️ Suporta altas temperaturas | Sem vazamentos ou heat creep");
  } else if (/extrusor|extruder/i.test(t)) {
    highlights.push("⚙️ Tração precisa com engrenagens duplas sem mastigar o filamento");
  } else if (/ender|creality|bambu|anycubic|elegoo|k1/i.test(t)) {
    highlights.push("🖨️ Compatibilidade direta e fácil instalação no seu setup");
  }

  // Ferramentas
  if (/alicate/i.test(t)) {
    highlights.push("✂️ Corte ultra rente e preciso | Essencial para remover suportes e rebarbas");
  } else if (/paquimetro/i.test(t)) {
    highlights.push("📏 Medição digital milimétrica de alta precisão (0.01mm)");
  } else if (/chave|allen|torx/i.test(t)) {
    highlights.push("🔧 Aço cromo vanádio de alta durabilidade: não desgasta os parafusos");
  } else if (/solda|soldering/i.test(t)) {
    highlights.push("🔌 Aquecimento rápido e controle térmico confiável para bancada");
  } else if (/retifica|dremel|micro\s*retifica/i.test(t)) {
    highlights.push("✨ Polimento e acabamento fino para peças e protótipos");
  } else if (/espatula/i.test(t)) {
    highlights.push("🛡️ Lâmina flexível para descolar impressões sem danificar a mesa");
  }

  // Eletrônicos
  if (/esp32|arduino/i.test(t)) {
    highlights.push("⚡ Excelente capacidade de processamento com Wi-Fi e Bluetooth nativos");
  } else if (/tomada\s*smart|smart\s*plug/i.test(t)) {
    highlights.push("📱 Controle remoto pelo celular e monitoramento de consumo elétrico");
  } else if (/camera|cam/i.test(t)) {
    highlights.push("👁️ Monitoramento remoto em tempo real de suas impressões e bancada");
  }

  // Se já encontrou destaques específicos, retorna até 2 formatados
  if (highlights.length > 0) {
    return highlights.slice(0, 2);
  }

  // Fallbacks dinâmicos por nicho variados pelo seed
  const fallbackByNiche: Record<ProductNicheType, string[][]> = {
    impressao_3d: [
      ["✨ Alta precisão dimensional | Sem bolhas | Acabamento premium"],
      ["🧵 Material verificado de excelente fluidez e fácil calibração"],
      ["⚙️ Upgrade recomendado para aumentar a qualidade e velocidade de impressão"],
      ["💎 Selecionado por makers: alta taxa de sucesso nas impressões"],
    ],
    ferramentas: [
      ["🔧 Precisão, durabilidade e acabamento reforçado para projetos"],
      ["🛠️ Material em aço temperado para máxima vida útil na oficina"],
      ["📐 Ferramenta indispensável para manutenção e calibração de máquinas"],
      ["⚡ Praticidade e segurança nas suas montagens de bancada"],
    ],
    eletronicos: [
      ["💡 Alta performance, conectividade e estabilidade garantida"],
      ["⚡ Componente confiável para automação e projetos maker"],
      ["🔋 Baixo consumo energético e excelente eficiência térmica"],
      ["📡 Conexão estável e compatível com ecossistemas inteligentes"],
    ],
    geral: [
      ["✨ Produto selecionado com garantia de procedência e entrega rápida"],
      ["📦 Excelente reputação de vendas com avaliações positivas"],
      ["💎 Oportunidade com desconto real verificado pela nossa equipe"],
      ["🚀 Envio ágil e compra 100% protegida pelo marketplace"],
    ],
  };

  const pool = fallbackByNiche[niche] || fallbackByNiche.geral;
  const pickedIndex = Math.abs(seed) % pool.length;
  return pool[pickedIndex] ?? pool[0] ?? ["✨ Produto selecionado com garantia de procedência e entrega rápida"];
}

/**
 * Retorna uma headline de abertura cativante e exclusiva baseada no estilo, nicho e variação.
 */
export function getDynamicHook(
  style: string = "padrao",
  niche: ProductNicheType = "impressao_3d",
  seed: number = 0
): string {
  const hooks: Record<string, string[]> = {
    achado: [
      "🧵 ACHADO IMPERDÍVEL PARA QUEM IMPRIME EM 3D! 🖨️",
      "👀 OLHA ESSE GARIMPO MAKER QUE ACABEI DE ENCONTRAR! 🔍",
      "💎 ACHADO DE OURO: Preço lá embaixo no marketplace! 🚀",
      "✨ GARIMPADO DO DIA: Oportunidade rara com valor reduzido! 📦",
      "🔥 ACHADO EXCLUSIVO: Preço que compensa muito estocar! 🧵",
    ],
    urgencia: [
      "⚡ CORRE! BAIXOU DE PREÇO AGORA MESMO! 🚨",
      "⏳ ALERTA DE ESTOQUE BAIXO: Menor valor registrado! 🔥",
      "🚨 ATENÇÃO: Desconto relâmpago que pode esgotar a qualquer momento! ⚡",
      "💥 DESPENCOU! Quem garantir primeiro pega o melhor valor! 🏃‍♂️",
      "⚠️ PREÇO DE QUEIMA: Pode voltar ao valor normal a qualquer instante! ⏱️",
    ],
    custo_beneficio: [
      "💰 O MELHOR CUSTO X BENEFÍCIO DA CATEGORIA! 🏆",
      "📈 ECONOMIA INTELIGENTE: Muito mais qualidade gastando menos! 💡",
      "🎯 COMPRA CERTA: Excelente avaliação e preço justo na bancada! 🤝",
      "⭐ CUSTO-BENEFÍCIO TESTADO: O item que sua oficina precisa! 🛠️",
      "🏷️ PREÇO JUSTO COM DESCONTO REAL: Vale cada centavo investido! 💵",
    ],
    review_maker: [
      "🔬 RECOMENDAÇÃO DE BANCADA: Testado no dia a dia maker! 🛠️",
      "👨‍🏭 DICA DE QUEM USA: Peça indispensável para seu setup 3D! ⚙️",
      "💡 UPGRADE OBRIGATÓRIO: Melhore seus resultados com esse item! 🖨️",
      "📌 AVALIADO PELA COMUNIDADE: Item com nota alta e satisfação garantida! 🌟",
      "🎯 PRODUTO APROVADO: Excelente acabamento e fácil de utilizar! 🔍",
    ],
    direto_ao_ponto: [
      "🎯 DIRETO AO PONTO: Desconto ativo no link oficial! 🏷️",
      "⚡ OFERTA DIRETA: Preço especial disponível agora! 📦",
      "🛒 PREÇO REDUZIDO: Verifique antes de finalizar o lote! 📉",
      "🏷️ OFERTA RÁPIDA: Link verificado abaixo! 👇",
      "📌 OPORTUNIDADE DO DIA: Preço baixo confirmado! 🚀",
    ],
    cupom_mes: [
      "🔥 CUPOM LIBERADO: Menor preço com código de desconto! 🎟️",
      "🎟️ DESCONTO COMBO: Preço baixo + cupom especial aplicado! 💥",
      "🚀 OPORTUNIDADE COM CUPOM: Economize na hora do checkout! 🏷️",
      "🔥 APROVEITE O CUPOM DO MÊS: Desconto ativado! ⚡",
      "🎟️ SUPER VOUCHER: Resgate e garanta o desconto extra no carrinho! 🛒",
    ],
    padrao: [
      niche === "impressao_3d"
        ? "🖨️ OFERTA ESPECIAL: FILAMENTOS & PEÇAS 3D 🧵"
        : niche === "ferramentas"
        ? "🔧 FERRAMENTA ESSENCIAL PARA SUA BANCADA 🛠️"
        : niche === "eletronicos"
        ? "💡 SMART HOME & ELETRÔNICOS EM PROMOÇÃO ⚡"
        : "🛍️ SUPER OPORTUNIDADE COM DESCONTO REAL! 🔥",
      "🔥 OPORTUNIDADE MAKER: Preço reduzido no marketplace! ⚡",
      "🛍️ SUPER OPORTUNIDADE COM DESCONTO REAL VERIFICADO! 🔥",
      "📦 OFERTA DESTAQUE DO DIA: Confira as condições especiais! ✨",
      "🌟 PRODUTO RECOMENDADO: Preço promocional por tempo limitado! 🚀",
    ],
  };

  const pool = hooks[style] || hooks.padrao;
  const index = Math.abs(seed) % (pool?.length || 1);
  return pool?.[index] ?? "🖨️ OFERTA ESPECIAL: FILAMENTOS & PEÇAS 3D 🧵";
}

/**
 * Retorna variações rotativas de Call-To-Action (CTA).
 */
export function getDynamicCta(seed: number = 0): string {
  const ctas = [
    "🛒 Garanta o seu pelo link oficial:",
    "👉 Link verificado e seguro para resgatar a oferta:",
    "📦 Pegue o seu antes que o lote promocional encerre:",
    "🔗 Acesse a oferta direto no marketplace parceiro:",
    "⚡ Clique abaixo para aproveitar pelo menor valor:",
    "🛍️ Confira todos os detalhes e compre com segurança aqui:",
  ];
  return ctas[Math.abs(seed) % ctas.length] ?? "🛒 Garanta o seu pelo link oficial:";
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
  copyStyle?: string; // "padrao" | "achado" | "cupom_mes" | "urgencia" | "custo_beneficio" | "review_maker" | "direto_ao_ponto"
  marketplace?: string;
  variationSeed?: number; // Permite gerar copies únicas para o mesmo produto
}

export function formatOfferMessage(
  offer: FormatOfferInput,
  options: FormatOptions = {},
): string {
  const lines: string[] = [];
  const style = offer.copyStyle || "padrao";
  const title = (offer.title || "Super Oferta").trim();
  const niche = detectProductNiche(title, offer.category || offer.niche || "");
  const seed = offer.variationSeed ?? 0;

  // 1. HEADLINE ESPECÍFICA & ROTATIVA
  const headline = getDynamicHook(style, niche, seed);
  lines.push(headline);

  lines.push("");
  lines.push(`📦 ${title}`);

  // 2. BENEFÍCIOS E DESTAQUES TÉCNICOS EXTRAÍDOS DINAMICAMENTE
  const highlights = extractProductHighlights(title, niche, seed);
  if (highlights.length > 0) {
    lines.push("");
    highlights.forEach((h) => lines.push(h));
  }

  // 3. BLOCO DE PREÇOS COM VARIAÇÃO PROCEDURAL
  const orig = Number(offer.originalPrice) || 0;
  const promo = Number(offer.promoPrice) || 0;
  const discount = calculateDiscount(orig, promo);
  const diffSavings = orig > promo ? orig - promo : 0;

  lines.push("");
  const priceVariation = Math.abs(seed) % 3;

  if (orig > promo && promo > 0) {
    if (priceVariation === 0) {
      lines.push(`❌ De: R$ ${formatCurrency(orig)}`);
      const savingsTag = diffSavings > 0 ? ` (Economia de R$ ${formatCurrency(diffSavings)}!)` : "";
      lines.push(`✅ Por apenas: R$ ${formatCurrency(promo)} 🔥 ${discount}% OFF${savingsTag}`);
    } else if (priceVariation === 1) {
      lines.push(`📉 De R$ ${formatCurrency(orig)} caiu para *R$ ${formatCurrency(promo)}*!`);
      lines.push(`🔥 Economize R$ ${formatCurrency(diffSavings)} (${discount}% de desconto)`);
    } else {
      lines.push(`🔥 Valor promocional: *R$ ${formatCurrency(promo)}* (Era R$ ${formatCurrency(orig)} - ${discount}% OFF)`);
      if (diffSavings > 0) {
        lines.push(`💰 Você economiza: R$ ${formatCurrency(diffSavings)}`);
      }
    }
  } else if (promo > 0) {
    if (priceVariation === 0) {
      lines.push(`✅ Valor promocional: R$ ${formatCurrency(promo)} 🔥`);
    } else if (priceVariation === 1) {
      lines.push(`🔥 Preço especial: *R$ ${formatCurrency(promo)}* à vista ou parcelado`);
    } else {
      lines.push(`⚡ Apenas *R$ ${formatCurrency(promo)}* no link abaixo!`);
    }
  }

  // 4. CUPOM DE DESCONTO EM DESTAQUE
  if (offer.coupon && offer.coupon.trim().length > 0) {
    const cp = offer.coupon.trim();
    lines.push("");
    lines.push(`🎟️ CUPOM: *${cp.toUpperCase()}*`);
    lines.push("👉 Aplique o código no checkout/carrinho para ativar o desconto!");
  }

  // 5. TUTORIAL DE RESGATE DE CUPOM
  if (offer.couponTutorial && offer.couponTutorial.trim().length > 0) {
    lines.push("");
    lines.push("💡 Como resgatar o desconto:");
    lines.push(offer.couponTutorial.trim());
  }

  // 6. CALL TO ACTION DINÂMICO E LINK DE AFILIADO
  if (offer.affiliateUrl && offer.affiliateUrl.trim().length > 0) {
    lines.push("");
    lines.push(getDynamicCta(seed));
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
