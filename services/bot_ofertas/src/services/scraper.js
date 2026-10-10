const axios = require('axios');
const cheerio = require('cheerio');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function cleanTitle(raw) {
  if (!raw) return '';
  return raw
    .replace(/\s*\|\s*Mercado Livre.*$/i, '')
    .replace(/\s*-\s*Mercado Livre.*$/i, '')
    .replace(/\s*\|\s*Amazon.*$/i, '')
    .replace(/\s*na\s*Amazon.*$/i, '')
    .replace(/\s*\|\s*Shopee.*$/i, '')
    .replace(/\s*-\s*Shopee.*$/i, '')
    .replace(/\s*\|\s*AliExpress.*$/i, '')
    .replace(/\s*-\s*AliExpress.*$/i, '')
    .replace(/\s*\|\s*TikTok.*$/i, '')
    .replace(/\s*-\s*TikTok.*$/i, '')
    .trim();
}

function detectPlatformFromUrl(url = '') {
  const lower = (url || '').toLowerCase();
  if (
    lower.includes('mercadolivre.com') ||
    lower.includes('mercadolivre.com.br') ||
    lower.includes('meli.la') ||
    lower.includes('melila.me')
  ) {
    return 'mercadolivre';
  }
  if (lower.includes('shopee.com') || lower.includes('shope.ee') || lower.includes('sshopee.me')) {
    return 'shopee';
  }
  if (lower.includes('amazon.com') || lower.includes('amzn.to')) {
    return 'amazon';
  }
  if (lower.includes('aliexpress.com') || lower.includes('s.click.aliexpress.com')) {
    return 'aliexpress';
  }
  if (lower.includes('tiktok.com')) {
    return 'tiktok';
  }
  return 'outro';
}

function getDefaultCouponHub(platform) {
  switch (platform) {
    case 'mercadolivre':
      return 'https://www.mercadolivre.com.br/cupons';
    case 'shopee':
      return 'https://shopee.com.br/m/cupons-diarios';
    case 'amazon':
      return 'https://www.amazon.com.br/cupom';
    case 'aliexpress':
      return 'https://best.aliexpress.com';
    case 'tiktok':
      return 'https://www.tiktok.com';
    default:
      return '';
  }
}

function extractCouponFromUrl(url = '') {
  try {
    const parsed = new URL(url);
    const cp =
      parsed.searchParams.get('coupon') ||
      parsed.searchParams.get('cupom') ||
      parsed.searchParams.get('code') ||
      parsed.searchParams.get('voucher') ||
      parsed.searchParams.get('promocode');
    if (cp && cp.trim().length >= 3) {
      return cp.trim().toUpperCase();
    }
  } catch (_) {}
  return '';
}

function extractCoupon(html, $, marketplace, url = '') {
  // 0. Verifica se veio na URL
  if (url) {
    const fromUrl = extractCouponFromUrl(url);
    if (fromUrl) return fromUrl;
  }

  const textContent = html.replace(/<[^>]+>/g, ' ');

  // 1. Regex Geral
  const explicitCouponRegexes = [
    /(?:use\s+o\s+)?cupom(?:\s+de)?(?:\s+c[oó]digo)?[:\s]+["']?([A-Z0-9_\-]{3,20})["']?/i,
    /c[oó]digo\s+(?:promocional|de\s+desconto)[:\s]+["']?([A-Z0-9_\-]{3,20})["']?/i,
    /voucher[:\s]+["']?([A-Z0-9_\-]{3,20})["']?/i,
    /(?:código|cupom)\s+([A-Z0-9_\-]{4,20})\s+(?:no\s+carrinho|ao\s+finalizar|no\s+checkout)/i
  ];

  for (const regex of explicitCouponRegexes) {
    const match = textContent.match(regex);
    if (
      match &&
      match[1] &&
      !['DE', 'EM', 'NA', 'NO', 'COM', 'PARA', 'OFF', 'POR', 'DO', 'DA', 'FRETE', 'GRATIS'].includes(
        match[1].toUpperCase()
      )
    ) {
      return match[1].toUpperCase();
    }
  }

  // Mercado Livre
  if (marketplace === 'mercadolivre') {
    const mlPill = $('.ui-pdp-promotions-pill-label, .ui-vip-coupon__description, .ui-vip-coupon__title')
      .first()
      .text()
      .trim();
    if (mlPill) return mlPill;
    const mlMatch =
      textContent.match(/(?:cupom|desconto)\s+de\s+(R\$\s*\d+(?:,\d{2})?)/i) ||
      textContent.match(/cupom\s+de\s+(\d+%\s*OFF)/i) ||
      textContent.match(/(\d+%\s*OFF\s*com\s*cupom)/i) ||
      textContent.match(/(R\$\s*\d+(?:,\d{2})?\s*OFF\s*com\s*cupom)/i);
    if (mlMatch && mlMatch[1]) return mlMatch[1].trim();
  }

  // Amazon
  if (marketplace === 'amazon') {
    const amzText =
      textContent.match(/Economize\s+(R\$\s*\d+(?:,\d{2})?)\s+ao\s+aplicar\s+o\s+cupom/i) ||
      textContent.match(/Aplicar\s+cupom\s+de\s+(R\$\s*\d+(?:,\d{2})?)/i) ||
      textContent.match(/Cupom\s+de\s+desconto:\s*([A-Z0-9_-]+)/i);
    if (amzText && amzText[1]) return amzText[1].trim();
  }

  // Shopee
  if (marketplace === 'shopee') {
    const shopeeMatch =
      textContent.match(/(?:cupom|voucher)\s+de\s+(R\$\s*\d+)/i) ||
      textContent.match(/(\d+%\s*OFF\s*(?:no\s*app|com\s*cupom))/i);
    if (shopeeMatch && shopeeMatch[1]) return shopeeMatch[1].trim();
  }

  return '';
}

/**
 * Extrai título, imagem e informações de preços de um link de e-commerce.
 */
async function scrapeProductInfo(url) {
  if (!url || !url.startsWith('http')) {
    throw new Error('URL inválida. Forneça um link iniciando com http:// ou https://');
  }

  const marketplace = detectPlatformFromUrl(url);
  const couponHubUrl = getDefaultCouponHub(marketplace);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 12000,
      maxRedirects: 5
    });

    const html = response.data;
    const finalUrl = response.request?.res?.responseUrl || url;
    const $ = cheerio.load(html);

    // 1. Título
    let rawTitle =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      '';
    const title = cleanTitle(rawTitle);

    // 2. Imagem
    let imageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('link[rel="image_src"]').attr('href') ||
      '';

    if (imageUrl && imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    }

    // 3. Preços
    let promoPrice = 0;
    let originalPrice = 0;

    // Mercado Livre DOM dedicado (precedência máxima para preço promocional da loja)
    if (marketplace === 'mercadolivre') {
      const prevFraction = $(
        '.ui-pdp-price__original-value .andes-money-amount__fraction, .andes-money-amount--previous .andes-money-amount__fraction'
      )
        .first()
        .text()
        .replace(/\./g, '');
      const prevCents = $(
        '.ui-pdp-price__original-value .andes-money-amount__cents, .andes-money-amount--previous .andes-money-amount__cents'
      )
        .first()
        .text();
      if (prevFraction) {
        const parsedPrev = parseFloat(prevFraction + (prevCents ? '.' + prevCents : '.00'));
        if (parsedPrev > 0) originalPrice = parsedPrev;
      }

      const fraction = $(
        '.ui-pdp-price__second-line .andes-money-amount__fraction, .andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__fraction'
      )
        .first()
        .text()
        .replace(/\./g, '');
      const cents = $(
        '.ui-pdp-price__second-line .andes-money-amount__cents, .andes-money-amount:not(.andes-money-amount--previous) .andes-money-amount__cents'
      )
        .first()
        .text();
      if (fraction) {
        const parsed = parseFloat(fraction + (cents ? '.' + cents : '.00'));
        if (parsed > 0) promoPrice = parsed;
      }
    }

    // JSON-LD (Schema.org) se ainda não capturado
    if (!promoPrice) {
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const json = JSON.parse($(el).html());
          const offers = json.offers || (json['@graph'] && json['@graph'].find((g) => g.offers)?.offers);
          if (offers) {
            const p = offers.price || (Array.isArray(offers) ? offers[0]?.price : null);
            if (p && !promoPrice) promoPrice = parseFloat(p) || 0;
            const orig = offers.highPrice || offers.priceSpecification?.maxPrice;
            if (orig && !originalPrice) originalPrice = parseFloat(orig) || 0;
          }
        } catch (_) {}
      });
    }

    // Fallback Meta Tags
    if (!promoPrice) {
      const ogPrice =
        $('meta[property="og:price:amount"]').attr('content') ||
        $('meta[property="product:price:amount"]').attr('content');
      if (ogPrice) {
        promoPrice = parseFloat(ogPrice.replace(',', '.')) || 0;
      }
    }

    // Amazon DOM
    if (marketplace === 'amazon' && !promoPrice) {
      const amzPrice = $('.a-price .a-offscreen')
        .first()
        .text()
        .replace(/[^\d.,]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
      if (amzPrice) promoPrice = parseFloat(amzPrice) || 0;
      const amzOrig = $('.a-text-price .a-offscreen')
        .first()
        .text()
        .replace(/[^\d.,]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
      if (amzOrig) originalPrice = parseFloat(amzOrig) || 0;
    }

    // 4. Cupom
    const coupon = extractCoupon(html, $, marketplace, finalUrl || url);
    let couponTutorial = '';
    if (coupon) {
      if (marketplace === 'mercadolivre') {
        couponTutorial = `Resgate o cupom antes de finalizar ou adicione ${coupon} no checkout!`;
      } else if (marketplace === 'amazon') {
        couponTutorial = `Selecione a caixa 'Aplicar cupom' na página do produto antes de comprar!`;
      } else if (marketplace === 'shopee') {
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
      finalUrl
    };
  } catch (error) {
    console.warn(`[Scraper] Falha ao extrair metadados de ${url}:`, error.message);
    return {
      title: '',
      imageUrl: '',
      promoPrice: 0,
      originalPrice: 0,
      coupon: '',
      couponTutorial: '',
      marketplace,
      couponHubUrl,
      originalUrl: url,
      finalUrl: url,
      warning: 'Não foi possível extrair dados automaticamente do site (bloqueio ou captcha). Preencha manualmente.'
    };
  }
}

module.exports = {
  cleanTitle,
  detectPlatformFromUrl,
  getDefaultCouponHub,
  scrapeProductInfo
};
