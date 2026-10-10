import { describe, it, expect } from "vitest";
import { formatCurrency, calculateDiscount } from "@/lib/bot-engine/formatter";

describe("Motor de Sincronização e Ajuste de Preços de 5 minutos", () => {
  it("calcula variação e desconto quando a loja altera o valor do anúncio", () => {
    const oldPromo = 99.9;
    const freshPromo = 129.9;
    const diff = Math.abs(oldPromo - freshPromo);

    expect(diff > 0.05).toBe(true);

    const discountOld = calculateDiscount(149.9, oldPromo);
    const discountNew = calculateDiscount(149.9, freshPromo);

    expect(discountOld).toBe(33);
    expect(discountNew).toBe(13);
  });

  it("formata valores monetários em padrão BRL adequadamente", () => {
    expect(formatCurrency(94.5)).toBe("94,50");
    expect(formatCurrency(1299.9)).toBe("1.299,90");
    expect(formatCurrency(0)).toBe("0,00");
  });
});
