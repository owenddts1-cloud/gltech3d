import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  calculateDiscount,
  detectMarketplace,
  formatWelcomeMessage,
  formatOfferMessage,
} from "../../lib/bot-engine/formatter";

describe("Formatter V2: Multi-Marketplace, Creative Copies & Welcome", () => {
  it("detecta o marketplace correto a partir de URLs oficiais e encurtadas", () => {
    expect(detectMarketplace("https://melila.me/KPoyewqI0WYB3rfu")).toBe("mercadolivre");
    expect(detectMarketplace("https://produto.mercadolivre.com.br/MLB-123")).toBe("mercadolivre");
    expect(detectMarketplace("https://sshopee.me/PTtQhmkvikMx34t6")).toBe("shopee");
    expect(detectMarketplace("https://shopee.com.br/product/123")).toBe("shopee");
    expect(detectMarketplace("https://amzn.to/3XABCDE")).toBe("amazon");
    expect(detectMarketplace("https://www.amazon.com.br/dp/B08XYZ")).toBe("amazon");
    expect(detectMarketplace("https://s.click.aliexpress.com/e/_DdXYZ")).toBe("aliexpress");
    expect(detectMarketplace("https://aliexpress.com/item/123.html")).toBe("aliexpress");
    expect(detectMarketplace("https://www.tiktok.com/@shop/video/123")).toBe("tiktok");
  });

  it("gera a mensagem de boas-vindas oficial do GLTech Ofertas", () => {
    const welcome = formatWelcomeMessage("5513988389028", "GLTech Ofertas - Impressão 3D");
    expect(welcome).toContain("🖨️ Bem-vindo @5513988389028 ao GLTech Ofertas - Impressão 3D!");
    expect(welcome).toContain("🧵 Filamentos");
    expect(welcome).toContain("🧪 Resinas");
    expect(welcome).toContain("🔧 Ferramentas");
    expect(welcome).toContain("🖨️ Impressoras 3D");
    expect(welcome).toContain("⚙️ Peças, acessórios e upgrades");
    expect(welcome).toContain("🤖 Promoções monitoradas automaticamente ao longo do dia");
    expect(welcome).toContain("🚫 Sem spam");
    expect(welcome).toContain("🔥 Muitas promoções possuem estoque limitado");
  });

  it("formata oferta no estilo padrão de alta conversão", () => {
    const msg = formatOfferMessage({
      title: "Filamento PLA 1kg Preto",
      originalPrice: 120,
      promoPrice: 89.9,
      coupon: "10OFF",
      affiliateUrl: "https://sshopee.me/123",
      copyStyle: "padrao",
    });

    expect(msg).toContain("🛍️ Filamento PLA 1kg Preto");
    expect(msg).toContain("De: R$ 120,00");
    expect(msg).toContain("Por: R$ 89,90 ✅ (25% OFF)");
    expect(msg).toContain("🎟️ Use o cupom 10OFF");
    expect(msg).toContain("🛒 https://sshopee.me/123");
  });

  it("formata oferta no estilo criativo 'Achado Sensacional' com aviso de variações", () => {
    const msg = formatOfferMessage({
      title: "Filamento PLA Marrom Velvet High Speed Premium 1kg",
      promoPrice: 118.36,
      affiliateUrl: "https://sshopee.me/PTtQhmkvikMx34t6",
      copyStyle: "achado",
    });

    expect(msg).toContain("✨ Achado sensacional! ✨");
    expect(msg).toContain("Filamento PLA Marrom Velvet");
    expect(msg).toContain("Por: R$ 118,36 ✅");
    expect(msg).toContain("Atenção: Oferta sujeita a alterações de preço e disponibilidade no site. Garanta o seu!");
  });

  it("inclui link para a central de cupons do marketplace quando fornecido", () => {
    const msg = formatOfferMessage({
      title: "Hotend Creality Ender 3",
      promoPrice: 45.0,
      affiliateUrl: "https://sshopee.me/hotend",
      couponHubUrl: "https://sshopee.me/GMNE98tfdo4yYUpL",
    });

    expect(msg).toContain("⚠️ Sempre resgate todos os cupons disponíveis aqui:\nhttps://sshopee.me/GMNE98tfdo4yYUpL");
  });

  it("adiciona tutorial passo a passo de resgate de cupom quando especificado", () => {
    const msg = formatOfferMessage({
      title: "Filamento Voolt3D Branco",
      promoPrice: 84.9,
      coupon: "25% OFF Mercado Livre Full",
      couponTutorial: "1. Clique em 'Mais' no canto inferior direito\n2. Entre em 'Cupons relâmpago do dia'\n3. Resgate o cupom",
      affiliateUrl: "https://melila.me/sn5Fu2YXDdO7uj53",
    });

    expect(msg).toContain("🔥 TUTORIAL DE RESGATE DO CUPOM:");
    expect(msg).toContain("1. Clique em 'Mais' no canto inferior direito");
  });
});
