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
export function extractCouponFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const cp =
      parsed.searchParams.get("coupon") ||
      parsed.searchParams.get("cupom") ||
      parsed.searchParams.get("code") ||
      parsed.searchParams.get("voucher") ||
      parsed.searchParams.get("promocode");
    if (cp && cp.trim().length >= 3) {
      return cp.trim().toUpperCase();
    }
  } catch (_) {}
  return "";
}

/**
 * Tenta extrair cupons de desconto presentes na página ou nos metadados.
 */
export function extractCouponFromHtml(html: string, marketplace: string, url: string = ""): string {
  // 0. Verifica se veio código de cupom na própria URL
  if (url) {
    const urlCoupon = extractCouponFromUrl(url);
    if (urlCoupon) return urlCoupon;
  }

  // Converte para texto plano removendo tags para não ser interrompido por <strong>, <span>, etc.
  const textContent = html.replace(/<[^>]+>/g, " ");

  // 1. Regex geral para códigos de cupom em destaque (ex: "Cupom: ECONOMIZE10", "Use o cupom VALE15", etc.)
  const explicitCouponRegexes = [
    /(?:use\s+o\s+)?cupom(?:\s+de)?(?:\s+c[oó]digo)?[:\s]+["']?([A-Z0-9_\-]{3,20})["']?/i,
    /c[oó]digo\s+(?:promocional|de\s+desconto)[:\s]+["']?([A-Z0-9_\-]{3,20})["']?/i,
    /voucher[:\s]+["']?([A-Z0-9_\-]{3,20})["']?/i,
    /(?:código|cupom)\s+([A-Z0-9_\-]{4,20})\s+(?:no\s+carrinho|ao\s+finalizar|no\s+checkout)/i,
  ];

  for (const regex of explicitCouponRegexes) {
    const match = textContent.match(regex);
    if (
      match?.[1] &&
      !["DE", "EM", "NA", "NO", "COM", "PARA", "OFF", "POR", "DO", "DA", "FRETE", "GRATIS"].includes(
        match[1].toUpperCase()
      )
    ) {
      return match[1].toUpperCase();
    }
  }

  // 2. Mercado Livre: Padrões de cupom em pills ou textos de desconto
  if (marketplace === "mercadolivre") {
    const mlPill =
      html.match(/class="[^"]*ui-pdp-promotions-pill-label[^"]*"[^>]*>([^<]+)</i) ||
      html.match(/class="[^"]*ui-vip-coupon__description[^"]*"[^>]*>([^<]+)</i) ||
      html.match(/class="[^"]*ui-vip-coupon__title[^"]*"[^>]*>([^<]+)</i);
    if (mlPill?.[1]) return mlPill[1].trim();

    const mlMatch =
      textContent.match(/(?:cupom|desconto)\s+de\s+(R\$\s*\d+(?:,\d{2})?)/i) ||
      textContent.match(/cupom\s+de\s+(\d+%\s*OFF)/i) ||
      textContent.match(/(\d+%\s*OFF\s*com\s*cupom)/i) ||
      textContent.match(/(R\$\s*\d+(?:,\d{2})?\s*OFF\s*com\s*cupom)/i);
    if (mlMatch?.[1]) return mlMatch[1].trim();
  }

  // 3. Amazon: Cupons de caixa de seleção (ex: "Economize R$ 10 ao aplicar o cupom")
  if (marketplace === "amazon") {
    const amzCouponMatch =
      textContent.match(/Economize\s+(R\$\s*\d+(?:,\d{2})?)\s+ao\s+aplicar\s+o\s+cupom/i) ||
      textContent.match(/Aplicar\s+cupom\s+de\s+(R\$\s*\d+(?:,\d{2})?)/i) ||
      textContent.match(/Cupom\s+de\s+desconto:\s*([A-Z0-9_-]+)/i);
    if (amzCouponMatch?.[1]) return amzCouponMatch[1].trim();
  }

  // 4. Shopee: Vouchers
  if (marketplace === "shopee") {
    const shopeeMatch =
      textContent.match(/(?:cupom|voucher)\s+de\s+(R\$\s*\d+)/i) ||
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

  // Estratégia 1: Mercado Livre DOM dedicado (layouts clássicos e modernos .poly-price__current)
  if (marketplace === "mercadolivre") {
    // 1.1 Preço original tachado
    const prevBlockMatch =
      html.match(/<[^>]+class="[^"]*(?:ui-pdp-price__original-value|andes-money-amount--previous)[^"]*"[\s\S]*?<\/[^>]+>/i) ||
      html.match(/<s[\s\S]*?<\/s>/i);
    const prevBlock = prevBlockMatch ? prevBlockMatch[0] : "";
    if (prevBlock) {
      const origMatch = prevBlock.match(/class="andes-money-amount__fraction"[^>]*>([\d.]+)</i);
      const origCents = prevBlock.match(/class="andes-money-amount__cents[^"]*"[^>]*>(\d+)</i);
      if (origMatch?.[1]) {
        const parsedOrig = parseFloat(
          origMatch[1].replace(/\./g, "") + (origCents?.[1] ? "." + origCents[1] : ".00")
        );
        if (parsedOrig > 0) {
          originalPrice = parsedOrig;
        }
      }
    }

    // 1.2 Preço promocional em .poly-price__current ou .ui-pdp-price__second-line
    const promoMatch =
      html.match(/class="[^"]*poly-price__current[^"]*"[\s\S]*?class="andes-money-amount__fraction"[^>]*>([\d.]+)</i) ||
      html.match(/class="[^"]*ui-pdp-price__second-line[^"]*"[\s\S]*?class="andes-money-amount__fraction"[^>]*>([\d.]+)</i) ||
      html.match(/class="andes-money-amount__fraction"[^>]*>([\d.]+)</i);
    const promoCents =
      html.match(/class="[^"]*(?:poly-price__current|ui-pdp-price__second-line)[^"]*"[\s\S]*?class="andes-money-amount__cents[^"]*"[^>]*>(\d+)</i);
    if (promoMatch?.[1]) {
      const parsedPromo = parseFloat(
        promoMatch[1].replace(/\./g, "") + (promoCents?.[1] ? "." + promoCents[1] : ".00")
      );
      if (parsedPromo > 0) {
        promoPrice = parsedPromo;
      }
    }
  }

  // Estratégia 2: Shopee State & JSON Parsing
  if (marketplace === "shopee" && !promoPrice) {
    const shopeeMatches = [
      ...html.matchAll(/"price(?:_min|_current)?"\s*:\s*(\d{5,12})/gi),
      ...html.matchAll(/"current_price"\s*:\s*(\d{5,12})/gi),
    ];
    for (const m of shopeeMatches) {
      if (m[1]) {
        let p = parseFloat(m[1]);
        if (p > 50000) p = p / 100000;
        if (p > 0 && !promoPrice) {
          promoPrice = p;
          break;
        }
      }
    }

    const shopeeOrig = html.match(/"price_(?:before_discount|max_before_discount)"\s*:\s*(\d{5,12})/i);
    if (shopeeOrig?.[1]) {
      let o = parseFloat(shopeeOrig[1]);
      if (o > 50000) o = o / 100000;
      if (o > 0 && !originalPrice) originalPrice = o;
    }
  }

  // Estratégia 3: Amazon DOM específico (.apexPriceToPay, .corePrice_feature_div, .a-price .a-offscreen)
  if (marketplace === "amazon" && !promoPrice) {
    const amzPromoMatch =
      html.match(/class="[^"]*(?:apexPriceToPay|corePrice_feature_div)[^"]*"[\s\S]*?class="a-offscreen"[^>]*>R\$\s*([\d.,]+)</i) ||
      html.match(/class="a-price\s+aok-align-center[^"]*"[\s\S]*?class="a-offscreen"[^>]*>R\$\s*([\d.,]+)</i) ||
      html.match(/class="a-price"[^>]*>[\s\S]*?class="a-offscreen"[^>]*>R\$\s*([\d.,]+)</i) ||
      html.match(/id="priceblock_ourprice"[^>]*>R\$\s*([\d.,]+)</i);
    if (amzPromoMatch?.[1]) {
      const cleanVal = amzPromoMatch[1].replace(/\./g, "").replace(",", ".");
      promoPrice = parseFloat(cleanVal) || 0;
    }

    const amzBasisPrice =
      html.match(/class="a-text-price"[^>]*>[\s\S]*?class="a-offscreen"[^>]*>R\$\s*([\d.,]+)</i) ||
      html.match(/id="basisPrice"[\s\S]*?class="a-offscreen"[^>]*>R\$\s*([\d.,]+)</i);
    if (amzBasisPrice?.[1]) {
      const cleanBasis = amzBasisPrice[1].replace(/\./g, "").replace(",", ".");
      originalPrice = parseFloat(cleanBasis) || 0;
    }
  }

  // Estratégia 4: JSON-LD (Schema.org Product) se ainda não capturou
  if (!promoPrice) {
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
  }

  // Estratégia 5: Meta tags abertas (og:price:amount, product:price:amount)
  if (!promoPrice) {
    const metaPriceMatch =
      html.match(/<meta\s+property="(?:product|og):price:amount"\s+content="([^"]+)"/i) ||
      html.match(/<meta\s+name="twitter:data1"\s+value="([^"]+)"/i);
    if (metaPriceMatch?.[1]) {
      promoPrice = parseFloat(metaPriceMatch[1].replace(",", ".")) || 0;
    }
  }

  // Estratégia 6: Microdata (itemprop="price")
  if (!promoPrice) {
    const itemPropPrice =
      html.match(/itemprop="price"\s+content="([^"]+)"/i) ||
      html.match(/content="([^"]+)"\s+itemprop="price"/i);
    if (itemPropPrice?.[1]) {
      promoPrice = parseFloat(itemPropPrice[1].replace(",", ".")) || 0;
    }
  }

  // Estratégia 7: Scripts de Estado (JSON com "price", "salePrice" ou "promoPrice")
  if (!promoPrice) {
    const scriptPrice =
      html.match(/"salePrice"\s*:\s*(\d+(?:\.\d+)?)/i) ||
      html.match(/"promoPrice"\s*:\s*(\d+(?:\.\d+)?)/i) ||
      html.match(/"price"\s*:\s*(\d+(?:\.\d+)?)/i);
    if (scriptPrice?.[1]) {
      const parsed = parseFloat(scriptPrice[1]);
      if (parsed > 0) promoPrice = parsed;
    }
  }

  // Estratégia 8: Fallback geral em texto de preços em Real (R$ XX,XX)
  if (!promoPrice) {
    const cleanText = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
    const brlMatches = [...cleanText.matchAll(/R\$\s*([\d.]+,\d{2})/gi)];
    if (brlMatches.length > 0) {
      const valid = brlMatches
        .map((m) => (m[1] ? parseFloat(m[1].replace(/\./g, "").replace(",", ".")) : NaN))
        .filter((v) => !isNaN(v) && v > 1 && v < 100000);
      if (valid.length > 0 && typeof valid[0] === "number") {
        promoPrice = valid[0];
        if (valid.length > 1 && typeof valid[1] === "number" && valid[1] > valid[0]) {
          originalPrice = valid[1];
        }
      }
    }
  }

  // Fallback para preço original se não encontrado
  if (!originalPrice) {
    const scriptOrig =
      html.match(/"originalPrice"\s*:\s*(\d+(?:\.\d+)?)/i) ||
      html.match(/"listPrice"\s*:\s*(\d+(?:\.\d+)?)/i) ||
      html.match(/"highPrice"\s*:\s*(\d+(?:\.\d+)?)/i);
    if (scriptOrig?.[1]) {
      const parsed = parseFloat(scriptOrig[1]);
      if (parsed > 0 && parsed > promoPrice) originalPrice = parsed;
    }
  }

  return { promoPrice, originalPrice };
}

/**
 * Resolve cadeias de redirecionamento de links de afiliados (301/302, meta-refresh e window.location)
 */
export async function resolveFinalProductUrl(
  initialUrl: string,
  maxHops = 3
): Promise<{ html: string; finalUrl: string }> {
  let currentUrl = initialUrl;
  let lastHtml = "";
  let hops = 0;

  while (hops < maxHops) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(currentUrl, {
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

      lastHtml = await response.text();
      const resUrl = response.url || currentUrl;

      if (typeof lastHtml === "string") {
        // 1. Meta refresh usado por encurtadores de afiliados
        const metaRefresh = lastHtml.match(
          /<meta[^>]*http-equiv=["']?refresh["']?[^>]*content=["']?[^"']*url=([^"'>\s]+)["']?/i
        );
        if (metaRefresh && metaRefresh[1]) {
          let nextUrl = metaRefresh[1].trim().replace(/['"]/g, "");
          if (nextUrl.startsWith("/")) {
            const base = new URL(resUrl);
            nextUrl = `${base.origin}${nextUrl}`;
          }
          if (nextUrl !== currentUrl && nextUrl.startsWith("http")) {
            currentUrl = nextUrl;
            hops++;
            continue;
          }
        }

        // 2. Script de window.location se for página curta de trampolim
        const jsRedirect = lastHtml.match(/window\.location(?:\.replace|\.href)?\s*[=(]\s*["']([^"']+)["']/i);
        if (jsRedirect && jsRedirect[1] && lastHtml.length < 4000) {
          let nextUrl = jsRedirect[1].trim();
          if (nextUrl.startsWith("/")) {
            const base = new URL(resUrl);
            nextUrl = `${base.origin}${nextUrl}`;
          }
          if (nextUrl !== currentUrl && nextUrl.startsWith("http")) {
            currentUrl = nextUrl;
            hops++;
            continue;
          }
        }
      }

      return { html: lastHtml, finalUrl: resUrl };
    } catch {
      break;
    }
  }

  return { html: lastHtml, finalUrl: currentUrl };
}

/**
 * Função principal de extração de dados do produto a partir de URL.
 */
export async function scrapeProductInfo(url: string): Promise<ScrapedProductData> {
  if (!url || !url.startsWith("http")) {
    throw new Error("URL inválida. Forneça um link iniciando com http:// ou https://");
  }

  try {
    const { html, finalUrl } = await resolveFinalProductUrl(url);
    if (!html) throw new Error("Não foi possível obter o conteúdo da página.");

    const targetUrl = finalUrl || url;
    const marketplace = detectMarketplace(targetUrl) !== "outro" ? detectMarketplace(targetUrl) : detectMarketplace(url);
    const couponHubUrl = getDefaultCouponHub(marketplace);

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
    const coupon = extractCouponFromHtml(html, marketplace, finalUrl || url);

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
    const marketplace = detectMarketplace(url);
    return {
      title: "",
      imageUrl: "",
      promoPrice: 0,
      originalPrice: 0,
      coupon: "",
      marketplace,
      couponHubUrl: getDefaultCouponHub(marketplace),
      originalUrl: url,
      finalUrl: url,
      warning: "Não foi possível extrair dados automaticamente deste site. Preencha manualmente os campos.",
    };
  }
}
