const axios = require('axios');
const cheerio = require('cheerio');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

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
    let rawTitle = $('meta[property="og:title"]').attr('content') ||
                   $('meta[name="twitter:title"]').attr('content') ||
                   $('title').text() ||
                   '';
    const title = cleanTitle(rawTitle);

    // 2. Imagem
    let imageUrl = $('meta[property="og:image"]').attr('content') ||
                   $('meta[name="twitter:image"]').attr('content') ||
                   $('link[rel="image_src"]').attr('href') ||
                   '';

    if (imageUrl && imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    }

    // 3. Preços
    let promoPrice = 0;
    let originalPrice = 0;

    const ogPrice = $('meta[property="og:price:amount"]').attr('content') ||
                    $('meta[property="product:price:amount"]').attr('content');
    if (ogPrice) {
      promoPrice = parseFloat(ogPrice.replace(',', '.')) || 0;
    }

    // JSON-LD
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html());
        const offers = json.offers || (json['@graph'] && json['@graph'].find((g) => g.offers)?.offers);
        if (offers) {
          const p = offers.price || (Array.isArray(offers) ? offers[0]?.price : null);
          if (p && !promoPrice) promoPrice = parseFloat(p) || 0;
          const orig = offers.highPrice || offers.priceSpecification?.maxPrice;
          if (orig) originalPrice = parseFloat(orig) || 0;
        }
      } catch (_) {}
    });

    return {
      title,
      imageUrl,
      promoPrice,
      originalPrice,
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
