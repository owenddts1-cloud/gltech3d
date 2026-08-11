import { describe, expect, it } from "vitest";

import {
  AA_TEXTO_GRANDE,
  AA_TEXTO_NORMAL,
  BRAND,
  contrastRatio,
  parseHex,
  passesAA,
  relativeLuminance,
} from "./contrast";

describe("a conta bate com valores conhecidos", () => {
  it("preto sobre branco é 21:1 e branco sobre branco é 1:1", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 4);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 6);
  });

  it("é simétrica — a ordem das cores não muda o resultado", () => {
    expect(contrastRatio("#8E6D4D", "#FFFFFF")).toBeCloseTo(
      contrastRatio("#FFFFFF", "#8E6D4D"),
      9,
    );
  });

  it("luminância de branco é 1 e de preto é 0", () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 6);
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 6);
  });
});

describe("o caso que motivou a mudança de paleta", () => {
  it("REPROVA: branco sobre o caramelo claro dá 3,55:1", () => {
    // O número que a auditoria externa mediu nos botões marrons. Abaixo dos
    // 4,5 exigidos para texto normal.
    const r = contrastRatio(BRAND.caramelo, BRAND.branco);
    expect(r).toBeCloseTo(3.55, 2);
    expect(r).toBeLessThan(AA_TEXTO_NORMAL);
    expect(passesAA(BRAND.caramelo, BRAND.branco)).toBe(false);
  });

  it("APROVA: branco sobre o caramelo escuro passa dos 4,5", () => {
    const r = contrastRatio(BRAND.carameloTexto, BRAND.branco);
    expect(r).toBeGreaterThanOrEqual(AA_TEXTO_NORMAL);
    expect(r).toBeCloseTo(4.72, 2);
  });

  it("o hover é ainda mais escuro, então também passa", () => {
    expect(passesAA(BRAND.carameloTextoHover, BRAND.branco)).toBe(true);
    expect(contrastRatio(BRAND.carameloTextoHover, BRAND.branco)).toBeGreaterThan(
      contrastRatio(BRAND.carameloTexto, BRAND.branco),
    );
  });

  it("o caramelo claro CONTINUA válido para texto grande e decoração", () => {
    // Não foi banido: 3,55 passa o limiar de 3:1 de texto grande. Bani-lo de
    // tudo seria jogar fora a identidade por causa de um caso.
    expect(contrastRatio(BRAND.caramelo, BRAND.branco)).toBeGreaterThanOrEqual(AA_TEXTO_GRANDE);
    expect(passesAA(BRAND.caramelo, BRAND.branco, true)).toBe(true);
  });

  it("o espresso sobre branco é confortável para corpo de texto", () => {
    expect(contrastRatio(BRAND.espresso, BRAND.branco)).toBeGreaterThan(12);
  });
});

describe("parseHex", () => {
  it("aceita com e sem cerquilha, e a forma curta", () => {
    expect(parseHex("#A6815C")).toEqual({ r: 166, g: 129, b: 92 });
    expect(parseHex("A6815C")).toEqual({ r: 166, g: 129, b: 92 });
    expect(parseHex("#fff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("devolve null em entrada inválida em vez de cor errada", () => {
    for (const v of ["", "#12345", "xyzxyz", "#GGGGGG", "rgb(1,2,3)"]) {
      expect(parseHex(v)).toBeNull();
    }
  });

  it("contraste com cor inválida devolve 0, e 0 nunca passa", () => {
    expect(contrastRatio("nao-e-cor", "#FFFFFF")).toBe(0);
    expect(passesAA("nao-e-cor", "#FFFFFF")).toBe(false);
  });
});
