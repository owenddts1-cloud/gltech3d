import { describe, expect, it } from "vitest";

import { isConfident, normalize, suggestProducts } from "./match-product";

/** Nomes reais do catálogo, para o teste não validar um mundo inventado. */
const CATALOGO = [
  { id: "1", name: "Luminária Lua Cheia - Alta Qualidade" },
  { id: "2", name: "Vaso Geométrico Moderno" },
  { id: "3", name: "Batman - Action Figure" },
  { id: "4", name: "Kit Vasos Modernos Com Bandeja" },
  { id: "5", name: "Charizard Articulável" },
];

describe("normalize", () => {
  it("tira acento, pontuação e caixa", () => {
    expect(normalize("Luminária Lua Cheia!")).toBe("luminaria lua cheia");
    expect(normalize("  VASO   Geométrico  ")).toBe("vaso geometrico");
  });

  it("não devolve string vazia com espaço sobrando", () => {
    expect(normalize("!!!")).toBe("");
  });
});

describe("suggestProducts", () => {
  it("acha a peça pelo nome parcial que o operador digitou", () => {
    const s = suggestProducts("luminaria lua", CATALOGO);
    expect(s[0]?.productId).toBe("1");
    expect(isConfident(s[0]!)).toBe(true);
  });

  it("nome curto casa com nome longo — a divisão é pelos termos DA VENDA", () => {
    // "Vaso" tem de casar com "Vaso Geométrico Moderno"; dividir pelos termos da
    // peça penalizaria o nome longo e a sugestão certa ficaria em segundo.
    const s = suggestProducts("vaso", CATALOGO);
    expect(s[0]?.productName).toContain("Vaso");
  });

  it("ignora palavra que não distingue nada", () => {
    // "Kit" sozinho casaria com qualquer coisa que tenha "kit" no nome.
    expect(suggestProducts("kit", CATALOGO)).toEqual([]);
    expect(suggestProducts("alta qualidade 3d", CATALOGO)).toEqual([]);
  });

  it("distingue duas peças que compartilham um termo", () => {
    const s = suggestProducts("kit vasos bandeja", CATALOGO);
    expect(s[0]?.productId).toBe("4");
  });

  it("respeita acento na venda e no catálogo", () => {
    expect(suggestProducts("LUMINARIA LUA CHEIA", CATALOGO)[0]?.productId).toBe("1");
    expect(suggestProducts("Charizard articulavel", CATALOGO)[0]?.productId).toBe("5");
  });

  it("texto sem termo útil não sugere nada, em vez de sugerir o primeiro", () => {
    expect(suggestProducts("", CATALOGO)).toEqual([]);
    expect(suggestProducts("de com para", CATALOGO)).toEqual([]);
    expect(suggestProducts("xyz", CATALOGO)).toEqual([]);
  });

  it("respeita o limite de sugestões", () => {
    expect(suggestProducts("vaso moderno", CATALOGO, 1)).toHaveLength(1);
  });

  it("ordena por pontuação, da melhor para a pior", () => {
    const s = suggestProducts("vaso moderno bandeja", CATALOGO);
    for (let i = 1; i < s.length; i++) {
      expect(s[i - 1]!.score).toBeGreaterThanOrEqual(s[i]!.score);
    }
  });

  it("a pontuação fica entre 0 e 1", () => {
    for (const s of suggestProducts("luminaria lua cheia alta qualidade", CATALOGO)) {
      expect(s.score).toBeGreaterThan(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("PARCIAL não vale o mesmo que a palavra inteira", () => {
    const inteira = suggestProducts("batman", CATALOGO)[0]!;
    const parcial = suggestProducts("batm", CATALOGO)[0];
    expect(inteira.score).toBe(1);
    if (parcial) expect(parcial.score).toBeLessThan(inteira.score);
  });

  it("catálogo vazio não quebra", () => {
    expect(suggestProducts("qualquer coisa", [])).toEqual([]);
  });
});

describe("limiar de confiança", () => {
  it("é alto de propósito — marcar errado por padrão é pior que não marcar", () => {
    // Vinculo errado contamina `sold_qty` e o custo de uma peça que nao foi
    // vendida, e o erro fica invisivel.
    expect(isConfident({ productId: "x", productName: "y", score: 0.5 })).toBe(false);
    expect(isConfident({ productId: "x", productName: "y", score: 0.6 })).toBe(true);
  });
});
