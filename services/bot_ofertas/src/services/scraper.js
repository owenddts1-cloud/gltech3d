const axios = require('axios');
const cheerio = require('cheerio');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * Extrai título, imagem e informações básicas de um link de e-commerce.
 */
async function scrapeProductInfo(url) {
  if (!url || !url.startsWith('http')) {
    throw new Error('URL inválida. Forneça um link iniciando com http:// ou https://');
  }

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
    let title = $('meta[property="og:title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                $('title').text() ||
                '';
    // Limpeza de sufixos de títulos (ex: " | Mercado Livre", " | Amazon.com.br")
    title = title.replace(/\s*\|.*$/, '')
                 .replace(/\s*-.*Mercado Livre.*$/i, '')
                 .replace(/\s*-.*Shopee.*$/i, '')
                 .replace(/\s*-.*Amazon.*$/i, '')
                 .replace(/\s*-.*AliExpress.*$/i, '')
                 .trim();

    // 2. Imagem
    let imageUrl = $('meta[property="og:image"]').attr('content') ||
                   $('meta[name="twitter:image"]').attr('content') ||
                   $('link[rel="image_src"]').attr('href') ||
                   '';

    if (imageUrl && imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    }

    // 3. Preço estimado (via OpenGraph ou JSON-LD se disponível)
    let promoPrice = 0;
    const ogPrice = $('meta[property="og:price:amount"]').attr('content') ||
                    $('meta[property="product:price:amount"]').attr('content');
    if (ogPrice) {
      promoPrice = parseFloat(ogPrice.replace(',', '.')) || 0;
    }

    // Tenta encontrar em scripts JSON-LD
    if (!promoPrice) {
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const json = JSON.parse($(el).html());
          const offers = json.offers || (json['@graph'] && json['@graph'].find((g) => g.offers)?.offers);
          if (offers) {
            const p = offers.price || (Array.isArray(offers) ? offers[0]?.price : null);
            if (p) promoPrice = parseFloat(p) || 0;
          }
        } catch (_) {}
      });
    }

    return {
      title,
      imageUrl,
      promoPrice,
      originalUrl: url,
      finalUrl
    };
  } catch (error) {
    console.warn(`[Scraper] Falha ao extrair metadados de ${url}:`, error.message);
    // Retorna fallback limpo se não conseguir fazer scraping
    return {
      title: '',
      imageUrl: '',
      promoPrice: 0,
      originalUrl: url,
      finalUrl: url,
      warning: 'Não foi possível extrair dados automaticamente do site (bloqueio de bot). Você pode preencher manualmente.'
    };
  }
}

module.exports = {
  scrapeProductInfo
};
