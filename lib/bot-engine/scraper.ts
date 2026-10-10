/**
 * Scraper nativo avançado para Next.js / Serverless.
 * Extrai títulos limpos, imagens em alta resolução, preços promocionais e CUPOUS de desconto
 * de marketplaces como Mercado Livre, Amazon, Shopee, AliExpress e TikTok Shop.
 */

export interface ScrapedProductData {
  title: string;
  imageUrl: string;
  promoPrice: number;
  originalPrice: number;
  coupon: string;
  couponTutorial?: string;
  marketplace: string;
  couponHubUrl: string;
  originalUrl: string;
  finalUrl?: string;
  warning?: string;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export function cleanTitle(raw: string = ""): string {
  if (!raw) return "";
  return raw
    .replace(/\s*\|\s*Mercado Livre.*$/i, "")
    .replace(/\s*-\s*Mercado Livre.*$/i, "")
    .replace(/\s*\|\s*Amazon.*$/i, "")
    .replace(/\s*na\s*Amazon.*$/i, "")
    .replace(/\s*\|\s*Shopee.*$/i, "")
    .replace(/\s*-\s*Shopee.*$/i, "")
    .replace(/\s*\|\s*AliExpress.*$/i, "")
    .replace(/\s*-\s*AliExpress.*$/i, "")
    .replace(/\s*\|\s*TikTok.*$/i, "")
    .replace(/\s*-\s*TikTok.*$/i, "")
    .trim();
}

export function detectMarketplace(url: string = ""): string {
  const lower = (url || "").toLowerCase();
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

export function getDefaultCouponHub(marketplace: string): string {
  switch (marketplace) {
    case "mercadolivre":
      return "https://www.mercadolivre.com.br/cupons";
    case "shopee":
      return "https://shopee.com.br/m/cupons-diarios";
    case "amazon":
      return "https://www.amazon.com.br/cupom";
    case "aliexpress":
      return "https://best.aliexpress.com";
    case "tiktok":
      return "https://www.tiktok.com";
    default:
      return "";
  }
}

/**
 * Tenta extrair cupons de desconto presentes na página ou nos metadados.
 */
export function extractCouponFromHtml(html: string, marketplace: string): string {
  // Converte para texto plano removendo tags para não ser interrompido por <strong>, <span>, etc.
  const textContent = html.replace(/<[^>]+>/g, " ");

  // 1. Regex geral para códigos de cupom em destaque (ex: "Cupom: ECONOMIZE10", "Use o cupom VALE15", etc.)
  const explicitCouponRegexes = [
    /(?:use\s+o\s+)?cupom(?:\s+de)?(?:\s+c[oó]digo)?[:\s]+["']?([A-Z0-9_\-]{3,20})["']?/i,
    /c[oó]digo\s+(?:promocional|de\s+desconto)[:\s]+["']?([A-Z0-9_\-]{3,20})["']?/i,
    /voucher[:\s]+["']?([A-Z0-9_\-]{3,20})["']?/i,
  ];

  for (const regex of explicitCouponRegexes) {
    const match = textContent.match(regex);
    if (match?.[1] && !["DE", "EM", "NA", "NO", "COM", "PARA", "OFF", "POR", "DO", "DA"].includes(match[1].toUpperCase())) {
      return match[1].toUpperCase();
    }
  }

  // 2. Mercado Livre: Padrões de cupom em pills ou textos de desconto
  if (marketplace === "mercadolivre") {
    const mlPill = html.match(/class="[^"]*ui-pdp-promotions-pill-label[^"]*"[^>]*>([^<]+)</i) ||
                   html.match(/class="[^"]*ui-vip-coupon__description[^"]*"[^>]*>([^<]+)</i);
    if (mlPill?.[1]) return mlPill[1].trim();

    const mlMatch = textContent.match(/(?:cupom|desconto)\s+de\s+(R\$\s*\d+(?:,\d{2})?)/i) ||
                    textContent.match(/(\d+%\s*OFF\s*com\s*cupom)/i);
    if (mlMatch?.[1]) return mlMatch[1].trim();
  }

  // 3. Amazon: Cupons de caixa de seleção (ex: "Economize R$ 10 ao aplicar o cupom")
  if (marketplace === "amazon") {
    const amzCouponMatch = textContent.match(/Economize\s+(R\$\s*\d+(?:,\d{2})?)\s+ao\s+aplicar\s+o\s+cupom/i) ||
                           textContent.match(/Aplicar\s+cupom\s+de\s+(R\$\s*\d+(?:,\d{2})?)/i) ||
                           textContent.match(/Cupom\s+de\s+desconto:\s*([A-Z0-9_-]+)/i);
    if (amzCouponMatch?.[1]) return amzCouponMatch[1].trim();
  }

  // 4. Shopee: Vouchers
  if (marketplace === "shopee") {
    const shopeeMatch = textContent.match(/(?:cupom|voucher)\s+de\s+(R\$\s*\d+)/i) ||
                        textContent.match(/(\d+%\s*OFF\s*(?:no\s*app|com\s*cupom))/i);
    if (shopeeMatch?.[1]) return shopeeMatch[1].trim();
  }

  return "";
}

/**
 * Extrai preços promocionais e originais com estratégias múltiplas.
 */
export function extractPrices(html: string, marketplace: string): { promoPrice: number; originalPrice: number } {
  let promoPrice = 0;
  let originalPrice = 0;

  // Estratégia 1: JSON-LD (Schema.org Product)
  const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      if (!match[1]) continue;
      const parsed = JSON.parse(match[1]);
      const obj = Array.isArray(parsed) ? parsed[0] : parsed;
      const offers = obj?.offers || (obj?.["@graph"] && obj["@graph"].find((g: any) => g.offers)?.offers);

      if (offers) {
        const p = Array.isArray(offers) ? offers[0]?.price : offers.price;
        if (p && !promoPrice) {
          promoPrice = parseFloat(String(p).replace(",", ".")) || 0;
        }
        const high = Array.isArray(offers) ? offers[0]?.highPrice : offers.highPrice;
        if (high && !originalPrice) {
          originalPrice = parseFloat(String(high).replace(",", ".")) || 0;
        }
      }
    } catch (_) {}
  }

  // Estratégia 2: Meta tags abertas (og:price:amount, product:price:amount)
  if (!promoPrice) {
    const metaPriceMatch =
      html.match(/<meta\s+property="(?:product|og):price:amount"\s+content="([^"]+)"/i) ||
      html.match(/<meta\s+name="twitter:data1"\s+value="([^"]+)"/i);
    if (metaPriceMatch?.[1]) {
      promoPrice = parseFloat(metaPriceMatch[1].replace(",", ".")) || 0;
    }
  }

  // Estratégia 3: Mercado Livre DOM específico (.andes-money-amount)
  if (marketplace === "mercadolivre") {
    // Preço original tachado (antes do desconto)
    const strikethroughMatch = html.match(/class="[^"]*andes-money-amount--previous[^"]*"[\s\S]*?class="andes-money-amount__fraction"[^>]*>([\d.]+)</i);
    if (strikethroughMatch?.[1]) {
      const origInt = strikethroughMatch[1].replace(/\./g, "");
      const parsedOrig = parseFloat(origInt);
      if (parsedOrig > 0) {
        originalPrice = parsedOrig;
      }
    }

    // Preço de venda real (exclui o bloco previous)
    const htmlWithoutPrevious = html.replace(/<[^>]*andes-money-amount--previous[\s\S]*?<\/div>/gi, "")
                                    .replace(/<[^>]*andes-money-amount--previous[\s\S]*?<\/span>/gi, "");
    const fractionMatch = htmlWithoutPrevious.match(/class="andes-money-amount__fraction"[^>]*>([\d.]+)</i);
    const centsMatch = htmlWithoutPrevious.match(/class="andes-money-amount__cents[^"]*"[^>]*>(\d+)</i);
    if (fractionMatch?.[1]) {
      const intPart = fractionMatch[1].replace(/\./g, "");
      const decPart = centsMatch?.[1] ? "." + centsMatch[1] : ".00";
      const parsed = parseFloat(`${intPart}${decPart}`);
      if (parsed > 0) {
        promoPrice = parsed;
      }
    }
  }

  // Estratégia 4: Amazon DOM específico (.a-price .a-offscreen)
  if (marketplace === "amazon" && !promoPrice) {
    const amzPriceMatch = html.match(/class="a-price\s+aok-align-center[^"]*"[\s\S]*?class="a-offscreen"[^>]*>R\$\s*([\d.,]+)</i) ||
                          html.match(/class="a-price"[^>]*>[\s\S]*?class="a-offscreen"[^>]*>R\$\s*([\d.,]+)</i) ||
                          html.match(/id="priceblock_ourprice"[^>]*>R\$\s*([\d.,]+)</i);
    if (amzPriceMatch?.[1]) {
      const cleanVal = amzPriceMatch[1].replace(/\./g, "").replace(",", ".");
      promoPrice = parseFloat(cleanVal) || 0;
    }

    const amzBasisPrice = html.match(/class="a-text-price"[^>]*>[\s\S]*?class="a-offscreen"[^>]*>R\$\s*([\d.,]+)</i);
    if (amzBasisPrice?.[1]) {
      const cleanBasis = amzBasisPrice[1].replace(/\./g, "").replace(",", ".");
      originalPrice = parseFloat(cleanBasis) || 0;
    }
  }

  return { promoPrice, originalPrice };
}

/**
 * Função principal de extração de dados do produto a partir de URL.
 */
export async function scrapeProductInfo(url: string): Promise<ScrapedProductData> {
  if (!url || !url.startsWith("http")) {
    throw new Error("URL inválida. Forneça um link iniciando com http:// ou https://");
  }

  const marketplace = detectMarketplace(url);
  const couponHubUrl = getDefaultCouponHub(marketplace);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeout);

    const html = await response.text();
    const finalUrl = response.url || url;

    // 1. Título
    const titleMatch =
      html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
      html.match(/<meta\s+name="twitter:title"\s+content="([^"]+)"/i) ||
      html.match(/<title>([^<]+)<\/title>/i);
    const title = cleanTitle(titleMatch?.[1] || "");

    // 2. Imagem
    const imageMatch =
      html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
      html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i) ||
      html.match(/<link\s+rel="image_src"\s+href="([^"]+)"/i);
    let imageUrl = imageMatch?.[1] || "";
    if (imageUrl.startsWith("//")) {
      imageUrl = "https:" + imageUrl;
    }

    // 3. Preços
    const { promoPrice, originalPrice } = extractPrices(html, marketplace);

    // 4. Cupom
    const coupon = extractCouponFromHtml(html, marketplace);

    // 5. Tutorial de Cupom Inteligente
    let couponTutorial = "";
    if (coupon) {
      if (marketplace === "mercadolivre") {
        couponTutorial = `Resgate o cupom antes de finalizar ou adicione ${coupon} no checkout!`;
      } else if (marketplace === "amazon") {
        couponTutorial = `Selecione a caixa 'Aplicar cupom' na página do produto antes de comprar!`;
      } else if (marketplace === "shopee") {
        couponTutorial = `Resgate o cupom na página do produto ou aplique na tela de pagamento do app!`;
      } else {
        couponTutorial = `Insira o código ${coupon} no carrinho na hora de fechar a compra.`;
      }
    }

    return {
      title,
      imageUrl,
      promoPrice,
      originalPrice,
      coupon,
      couponTutorial,
      marketplace,
      couponHubUrl,
      originalUrl: url,
      finalUrl,
    };
  } catch (error: any) {
    console.warn(`[Scraper] Falha ao extrair metadados de ${url}:`, error.message);
    return {
      title: "",
      imageUrl: "",
      promoPrice: 0,
      originalPrice: 0,
      coupon: "",
      marketplace,
      couponHubUrl,
      originalUrl: url,
      finalUrl: url,
      warning: "Não foi possível extrair dados automaticamente deste site. Preencha manualmente os campos.",
    };
  }
}
