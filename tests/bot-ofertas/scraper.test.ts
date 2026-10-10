import { describe, it, expect } from "vitest";
const {
  cleanTitle,
  detectPlatformFromUrl,
} = require("../../services/bot_ofertas/src/services/scraper");

describe("Scraper Multi-Marketplace Helpers", () => {
  it("limpa sufixos de títulos de todas as 5 plataformas", () => {
    expect(cleanTitle("Filamento PLA 1kg - Mercado Livre")).toBe("Filamento PLA 1kg");
    expect(cleanTitle("Filamento PETG Masterprint 1kg | Mercado Livre Brasil")).toBe("Filamento PETG Masterprint 1kg");
    expect(cleanTitle("Alicate de Corte de Precisão | Amazon.com.br")).toBe("Alicate de Corte de Precisão");
    expect(cleanTitle("Hotend Creality Ender 3 - Shopee Brasil")).toBe("Hotend Creality Ender 3");
    expect(cleanTitle("Kit 10 Bicos 0.4mm Brass V6 | AliExpress")).toBe("Kit 10 Bicos 0.4mm Brass V6");
    expect(cleanTitle("Mesa Magnética PEI Texturizada | TikTok Shop")).toBe("Mesa Magnética PEI Texturizada");
  });

  it("detecta a plataforma a partir da URL oficial ou encurtada", () => {
    expect(detectPlatformFromUrl("https://melila.me/KPoyewqI0WYB3rfu")).toBe("mercadolivre");
    expect(detectPlatformFromUrl("https://produto.mercadolivre.com.br/MLB-123")).toBe("mercadolivre");
    expect(detectPlatformFromUrl("https://sshopee.me/PTtQhmkvikMx34t6")).toBe("shopee");
    expect(detectPlatformFromUrl("https://shope.ee/123456")).toBe("shopee");
    expect(detectPlatformFromUrl("https://amzn.to/3XABCDE")).toBe("amazon");
    expect(detectPlatformFromUrl("https://s.click.aliexpress.com/e/_DdXYZ")).toBe("aliexpress");
    expect(detectPlatformFromUrl("https://www.tiktok.com/@shop/view/123")).toBe("tiktok");
  });
});
