import { describe, it, expect } from "vitest";

import { brlFromCents, brlNumberFromCents, centsFromInput, centsToWordsPtBr } from "./money";

/**   é o espaço rígido que o Intl usa entre "R$" e o número. */
const nbsp = (s: string) => s.replace(/ /g, " ");

describe("brlFromCents", () => {
  it("formata centavos como moeda brasileira", () => {
    expect(nbsp(brlFromCents(0))).toBe("R$ 0,00");
    expect(nbsp(brlFromCents(1))).toBe("R$ 0,01");
    expect(nbsp(brlFromCents(125000))).toBe("R$ 1.250,00");
  });

  it("não quebra com entrada não-finita", () => {
    expect(nbsp(brlFromCents(Number.NaN))).toBe("R$ 0,00");
  });
});

describe("brlNumberFromCents", () => {
  it("omite o símbolo, para uso dentro de tabelas", () => {
    expect(brlNumberFromCents(125000)).toBe("1.250,00");
    expect(brlNumberFromCents(0)).toBe("0,00");
  });
});

describe("centsFromInput", () => {
  it("aceita o formato brasileiro com milhar e decimal", () => {
    expect(centsFromInput("1.250,00")).toBe(125000);
    expect(centsFromInput("22,50")).toBe(2250);
    expect(centsFromInput("1.000.000,99")).toBe(100000099);
  });

  it("aceita ponto como decimal quando não há vírgula", () => {
    expect(centsFromInput("22.50")).toBe(2250);
    expect(centsFromInput("22.5")).toBe(2250);
  });

  it("trata ponto de milhar sem decimal", () => {
    expect(centsFromInput("1.250")).toBe(125000);
    expect(centsFromInput("1.250.000")).toBe(125000000);
  });

  it("tolera lixo, símbolo e vazio", () => {
    expect(centsFromInput("")).toBe(0);
    expect(centsFromInput("R$ 22,50")).toBe(2250);
    expect(centsFromInput("abc")).toBe(0);
  });

  it("preserva o sinal negativo", () => {
    expect(centsFromInput("-22,50")).toBe(-2250);
  });
});

describe("centsToWordsPtBr", () => {
  it("cobre os casos de borda de singular e plural", () => {
    expect(centsToWordsPtBr(0)).toBe("zero reais");
    expect(centsToWordsPtBr(1)).toBe("um centavo");
    expect(centsToWordsPtBr(2)).toBe("dois centavos");
    expect(centsToWordsPtBr(100)).toBe("um real");
    expect(centsToWordsPtBr(200)).toBe("dois reais");
    expect(centsToWordsPtBr(101)).toBe("um real e um centavo");
  });

  it("escreve dezenas, centenas e o caso especial 'cem'", () => {
    expect(centsToWordsPtBr(1500)).toBe("quinze reais");
    expect(centsToWordsPtBr(4200)).toBe("quarenta e dois reais");
    expect(centsToWordsPtBr(10000)).toBe("cem reais");
    expect(centsToWordsPtBr(10100)).toBe("cento e um reais");
    expect(centsToWordsPtBr(99900)).toBe("novecentos e noventa e nove reais");
  });

  it("escreve milhares com a conjunção correta", () => {
    expect(centsToWordsPtBr(100000)).toBe("mil reais");
    expect(centsToWordsPtBr(120000)).toBe("mil e duzentos reais");
    expect(centsToWordsPtBr(123450)).toBe(
      "mil duzentos e trinta e quatro reais e cinquenta centavos",
    );
    expect(centsToWordsPtBr(268000)).toBe("dois mil seiscentos e oitenta reais");
  });

  it("escreve milhões com a preposição correta", () => {
    expect(centsToWordsPtBr(100_000_000)).toBe("um milhão de reais");
    expect(centsToWordsPtBr(250_000_000)).toBe("dois milhões e quinhentos mil reais");
  });

  it("ignora o sinal — recibo não tem valor negativo", () => {
    expect(centsToWordsPtBr(-100)).toBe("um real");
  });
});
