import { describe, it, expect } from "vitest";
import {
  cleanTitle,
  detectMarketplace,
  extractCouponFromHtml,
  extractPrices,
} from "@/lib/bot-engine/scraper";

const {
  cleanTitle: cleanTitleJs,
  detectPlatformFromUrl,
} = require("../../services/bot_ofertas/src/services/scraper");

describe("Scraper Multi-Marketplace & Cupons", () => {
  it("limpa sufixos de títulos de todas as 5 plataformas", () => {
    expect(cleanTitle("Filamento PLA 1kg - Mercado Livre")).toBe("Filamento PLA 1kg");
    expect(cleanTitle("Filamento PETG Masterprint 1kg | Mercado Livre Brasil")).toBe("Filamento PETG Masterprint 1kg");
    expect(cleanTitle("Alicate de Corte de Precisão | Amazon.com.br")).toBe("Alicate de Corte de Precisão");
    expect(cleanTitle("Hotend Creality Ender 3 - Shopee Brasil")).toBe("Hotend Creality Ender 3");
    expect(cleanTitle("Kit 10 Bicos 0.4mm Brass V6 | AliExpress")).toBe("Kit 10 Bicos 0.4mm Brass V6");
    expect(cleanTitle("Mesa Magnética PEI Texturizada | TikTok Shop")).toBe("Mesa Magnética PEI Texturizada");

    // Paridade com JS
    expect(cleanTitleJs("Filamento PLA 1kg - Mercado Livre")).toBe("Filamento PLA 1kg");
  });

  it("detecta a plataforma a partir da URL oficial ou encurtada", () => {
    expect(detectMarketplace("https://melila.me/KPoyewqI0WYB3rfu")).toBe("mercadolivre");
    expect(detectMarketplace("https://produto.mercadolivre.com.br/MLB-123")).toBe("mercadolivre");
    expect(detectMarketplace("https://sshopee.me/PTtQhmkvikMx34t6")).toBe("shopee");
    expect(detectMarketplace("https://shope.ee/123456")).toBe("shopee");
    expect(detectMarketplace("https://amzn.to/3XABCDE")).toBe("amazon");
    expect(detectMarketplace("https://s.click.aliexpress.com/e/_DdXYZ")).toBe("aliexpress");
    expect(detectMarketplace("https://www.tiktok.com/@shop/view/123")).toBe("tiktok");

    expect(detectPlatformFromUrl("https://melila.me/KPoyewqI0WYB3rfu")).toBe("mercadolivre");
  });

  it("extrai cupons explícitos e contextuais do HTML de cada marketplace", () => {
    // 1. Cupom com código explícito
    const html1 = '<div class="banner">Use o cupom: <strong>GLTECH15</strong> no carrinho</div>';
    expect(extractCouponFromHtml(html1, "outro")).toBe("GLTECH15");

    // 2. Mercado Livre pill de cupom
    const htmlMl = '<span class="ui-pdp-promotions-pill-label">Cupom de R$ 20 OFF</span>';
    expect(extractCouponFromHtml(htmlMl, "mercadolivre")).toBe("Cupom de R$ 20 OFF");

    // 3. Amazon caixa de seleção
    const htmlAmz = '<label for="coupon">Economize R$ 15,00 ao aplicar o cupom</label>';
    expect(extractCouponFromHtml(htmlAmz, "amazon")).toBe("R$ 15,00");

    // 4. Shopee voucher
    const htmlShopee = '<div>Resgate seu cupom de R$ 25 no app</div>';
    expect(extractCouponFromHtml(htmlShopee, "shopee")).toBe("R$ 25");
  });

  it("extrai preços promocionais e originais com JSON-LD e elementos do DOM", () => {
    // 1. JSON-LD
    const jsonLdHtml = `
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Filamento PLA",
          "offers": {
            "@type": "Offer",
            "price": "89.90",
            "highPrice": "129.90",
            "priceCurrency": "BRL"
          }
        }
      </script>
    `;
    const prices = extractPrices(jsonLdHtml, "outro");
    expect(prices.promoPrice).toBe(89.9);
    expect(prices.originalPrice).toBe(129.9);

    // 2. Mercado Livre DOM
    const mlHtml = `
      <div class="andes-money-amount--previous">
        <span class="andes-money-amount__fraction">150</span>
      </div>
      <div class="ui-pdp-price__second-line">
        <span class="andes-money-amount__fraction">94</span>
        <span class="andes-money-amount__cents">50</span>
      </div>
    `;
    const mlPrices = extractPrices(mlHtml, "mercadolivre");
    expect(mlPrices.promoPrice).toBe(94.5);
    expect(mlPrices.originalPrice).toBe(150);
  });
});
