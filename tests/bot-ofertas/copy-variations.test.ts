import { describe, it, expect } from "vitest";
import {
  formatOfferMessage,
  extractProductHighlights,
  getDynamicHook,
  getDynamicCta,
} from "../../lib/bot-engine/formatter";

describe("Gerador de Cópias Dinâmicas e Exclusivas", () => {
  it("extrai destaques específicos de produto a partir do título para filamento PLA+", () => {
    const highlights = extractProductHighlights("Filamento PLA+ 1.75mm Voolt3D 1kg Cinza", "impressao_3d", 0);
    expect(highlights.length).toBeGreaterThan(0);
    expect(highlights[0]).toContain("PLA+ Reforçado");
  });

  it("extrai destaques específicos para bicos/nozzles", () => {
    const highlights = extractProductHighlights("Bico Nozzle CHT 0.4mm Creality K1 Ender 3", "impressao_3d", 0);
    expect(highlights[0]).toContain("Fluxo térmico");
  });

  it("extrai destaques específicos para ferramentas como paquímetro", () => {
    const highlights = extractProductHighlights("Paquímetro Digital 150mm Fibra de Carbono", "ferramentas", 0);
    expect(highlights[0]).toContain("Medição digital");
  });

  it("gera copys diferentes e exclusivas com seeds distintas para a mesma oferta", () => {
    const offerBase = {
      title: "Filamento PETG XT 1kg Branco",
      promoPrice: 85.9,
      originalPrice: 110.0,
      affiliateUrl: "https://sshopee.me/teste123",
      copyStyle: "achado",
    };

    const copyVar0 = formatOfferMessage({ ...offerBase, variationSeed: 0 });
    const copyVar1 = formatOfferMessage({ ...offerBase, variationSeed: 1 });
    const copyVar2 = formatOfferMessage({ ...offerBase, variationSeed: 2 });

    // Todas as variações devem conter os dados essenciais da oferta
    expect(copyVar0).toContain("Filamento PETG XT 1kg Branco");
    expect(copyVar1).toContain("Filamento PETG XT 1kg Branco");
    expect(copyVar2).toContain("Filamento PETG XT 1kg Branco");

    // As copies devem ser distintas entre si (hooks e apresentações de preço rotativos)
    expect(copyVar0).not.toBe(copyVar1);
    expect(copyVar1).not.toBe(copyVar2);
  });

  it("suporta os 6 estilos criativos com hooks personalizados", () => {
    const styles = ["padrao", "achado", "urgencia", "custo_beneficio", "review_maker", "direto_ao_ponto", "cupom_mes"];
    for (const style of styles) {
      const hook = getDynamicHook(style, "impressao_3d", 0);
      expect(hook).toBeTruthy();
      expect(typeof hook).toBe("string");
    }
  });

  it("rotaciona CTAs de compra conforme o seed", () => {
    const cta0 = getDynamicCta(0);
    const cta1 = getDynamicCta(1);
    expect(cta0).not.toBe(cta1);
  });
});
