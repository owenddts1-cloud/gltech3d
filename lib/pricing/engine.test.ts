/**
 * O motor de precificação.
 *
 * O teste que motiva este arquivo é o de CONVERGÊNCIA: a mesma peça tem de
 * custar o mesmo pelos caminhos das três telas. Antes disto, `useCalculator`, o
 * simulador de Projetos e o próprio motor tinham cada um a sua cópia da conta —
 * com constantes diferentes (R$ 110/kg, R$ 140/kg, R$ 0,40/h) — e a resposta
 * mudava conforme a tela aberta.
 */

import { describe, expect, it } from "vitest";

import {
  calculateRealCost,
  channelResultAtPrice,
  computeChannelPrices,
  costFromHourlyInputs,
  depreciationPerHour,
} from "./engine";

/** Peça de referência: 50 g, 4 h, 200 W, R$ 0,92/kWh, R$ 0,50/h de máquina. */
const PECA = {
  grams: 50,
  filamentCostPerKg: 110,
  printHours: 4,
  wattage: 200,
  kwhPrice: 0.92,
  depreciationPerHour: 0.5,
};

describe("convergência — a razão de este módulo existir", () => {
  it("as unidades da tela e as do motor dão o MESMO custo", () => {
    const pelaTela = costFromHourlyInputs(PECA);
    const peloMotor = calculateRealCost({
      m_piece: PECA.grams,
      c_gram: PECA.filamentCostPerKg / 1000,
      t_print: PECA.printHours * 3600,
      k_energy: PECA.kwhPrice,
      power_draw: PECA.wattage,
      d_machine: PECA.depreciationPerHour,
    });
    expect(pelaTela).toEqual(peloMotor);
  });

  it("bate com a conta feita à mão, parcela por parcela", () => {
    const r = costFromHourlyInputs(PECA);
    expect(r.materialCost).toBeCloseTo(50 * (110 / 1000), 4); // 5,50
    expect(r.energyCost).toBeCloseTo(4 * (200 / 1000) * 0.92, 4); // 0,736
    expect(r.depreciationCost).toBeCloseTo(4 * 0.5, 4); // 2,00
    expect(r.totalCost).toBeCloseTo(5.5 + 0.736 + 2, 2);
  });

  it("reproduz a fórmula que a tela de Projetos usava antes", () => {
    // Os quatro helpers locais que foram removidos de `ProjectsClient`.
    const filamento = PECA.grams * (PECA.filamentCostPerKg / 1000);
    const energia = (PECA.wattage / 1000) * PECA.printHours * PECA.kwhPrice;
    const deprec = PECA.printHours * PECA.depreciationPerHour;

    const r = costFromHourlyInputs(PECA);
    expect(r.materialCost).toBeCloseTo(filamento, 4);
    expect(r.energyCost).toBeCloseTo(energia, 4);
    expect(r.depreciationCost).toBeCloseTo(deprec, 4);
  });

  it("reproduz a fórmula que a calculadora usava antes", () => {
    const valorMaquina = 4000;
    const vidaUtil = 8000;
    const antes = {
      filamento: (PECA.grams / 1000) * PECA.filamentCostPerKg,
      energia: PECA.printHours * (PECA.wattage / 1000) * PECA.kwhPrice,
      deprec: PECA.printHours * (valorMaquina / vidaUtil),
    };
    const r = costFromHourlyInputs({
      ...PECA,
      depreciationPerHour: depreciationPerHour(valorMaquina, vidaUtil),
    });
    expect(r.materialCost).toBeCloseTo(antes.filamento, 4);
    expect(r.energyCost).toBeCloseTo(antes.energia, 4);
    expect(r.depreciationCost).toBeCloseTo(antes.deprec, 4);
  });
});

describe("depreciationPerHour", () => {
  it("divide valor por vida útil", () => {
    expect(depreciationPerHour(4000, 8000)).toBeCloseTo(0.5, 6);
  });

  it("VIDA ÚTIL ZERO devolve zero, não Infinity", () => {
    // Máquina sem vida útil cadastrada não pode contaminar a soma: `Infinity`
    // se propaga em silêncio e só aparece como "R$ NaN" lá na tela.
    expect(depreciationPerHour(4000, 0)).toBe(0);
    expect(depreciationPerHour(4000, -10)).toBe(0);
    expect(Number.isFinite(costFromHourlyInputs({ ...PECA, depreciationPerHour: 0 }).totalCost)).toBe(true);
  });

  it("valor não finito devolve zero", () => {
    expect(depreciationPerHour(Number.NaN, 8000)).toBe(0);
  });
});

describe("robustez", () => {
  it("peça sem massa nem tempo custa zero, não NaN", () => {
    const r = costFromHourlyInputs({ ...PECA, grams: 0, printHours: 0 });
    expect(r.totalCost).toBe(0);
    expect(Number.isFinite(r.totalCost)).toBe(true);
  });

  it("o total é a soma das parcelas", () => {
    const r = costFromHourlyInputs(PECA);
    expect(r.totalCost).toBeCloseTo(r.materialCost + r.energyCost + r.depreciationCost, 2);
  });

  it("dobrar o tempo dobra energia e depreciação, mas não o material", () => {
    const a = costFromHourlyInputs(PECA);
    const b = costFromHourlyInputs({ ...PECA, printHours: PECA.printHours * 2 });
    expect(b.energyCost).toBeCloseTo(a.energyCost * 2, 4);
    expect(b.depreciationCost).toBeCloseTo(a.depreciationCost * 2, 4);
    expect(b.materialCost).toBeCloseTo(a.materialCost, 4);
  });
});

describe("lucro por canal — o consumidor que faltava", () => {
  const CANAIS = [
    { platform: "B2B", commissionPct: 0 },
    { platform: "Shopee", commissionPct: 20, fixedFee: 4 },
    { platform: "Mercado Livre", commissionPct: 14, fixedFee: 6 },
  ];

  it("NÃO inventa comissão para canal sem cadastro", () => {
    // A versão anterior aplicava 18% à Shopee e 14% ao ML a quem não passasse
    // configuração — número que PARECE apurado e não veio de lugar nenhum.
    expect(computeChannelPrices(10, 30)).toEqual([]);
    expect(computeChannelPrices(10, 30, { channels: [] })).toEqual([]);
  });

  it("calcula um canal por linha cadastrada, não só dois nomes conhecidos", () => {
    const r = computeChannelPrices(10, 30, { channels: CANAIS });
    expect(r.map((x) => x.channel)).toEqual(["B2B", "Shopee", "Mercado Livre"]);
  });

  it("marca comissão ZERADA sem confundir com canal sem taxa", () => {
    // B2B legitimamente retém 0%; Shopee por preencher também marca 0. A marca
    // existe para a tela poder avisar em vez de afirmar margem cheia.
    const r = computeChannelPrices(10, 30, { channels: CANAIS });
    expect(r.find((x) => x.channel === "B2B")?.commissionMissing).toBe(true);
    expect(r.find((x) => x.channel === "Shopee")?.commissionMissing).toBe(false);
  });

  it("a margem alvo é atingida no preço sugerido", () => {
    const r = computeChannelPrices(10, 30, { channels: CANAIS, simplesTaxPct: 6 });
    for (const canal of r) expect(canal.netMarginPct).toBeCloseTo(30, 0);
  });

  it("comissão maior exige preço maior para a mesma margem", () => {
    const barato = computeChannelPrices(10, 30, { channels: [{ platform: "X", commissionPct: 5 }] });
    const caro = computeChannelPrices(10, 30, { channels: [{ platform: "X", commissionPct: 25 }] });
    expect(caro[0]!.suggestedPrice).toBeGreaterThan(barato[0]!.suggestedPrice);
  });

  it("margem impossível não devolve preço infinito", () => {
    // Comissão 60% + imposto 10% + margem alvo 50% consome mais que o total.
    const r = computeChannelPrices(10, 50, {
      channels: [{ platform: "X", commissionPct: 60 }],
      simplesTaxPct: 10,
    });
    expect(Number.isFinite(r[0]!.suggestedPrice)).toBe(true);
    expect(r[0]!.suggestedPrice).toBeGreaterThan(0);
  });
});

describe("channelResultAtPrice — o que sobra do preço de hoje", () => {
  it("detecta PREJUÍZO no preço praticado", () => {
    // Peça de R$ 11,90 na Shopee, custo R$ 9, comissão 20% + R$ 4 fixo.
    const r = channelResultAtPrice(9, 11.9, { platform: "Shopee", commissionPct: 20, fixedFee: 4 });
    expect(r.netProfit).toBeLessThan(0);
    expect(r.netMarginPct).toBeLessThan(0);
  });

  it("com comissão zero o resultado é preço menos custo", () => {
    const r = channelResultAtPrice(10, 25, { platform: "B2B", commissionPct: 0 });
    expect(r.netProfit).toBeCloseTo(15, 2);
  });

  it("o imposto entra sobre a VENDA, não sobre o lucro", () => {
    const sem = channelResultAtPrice(10, 100, { platform: "X", commissionPct: 0 }, 0);
    const com = channelResultAtPrice(10, 100, { platform: "X", commissionPct: 0 }, 6);
    expect(sem.netProfit - com.netProfit).toBeCloseTo(6, 2);
  });

  it("preço zero não gera divisão por zero", () => {
    const r = channelResultAtPrice(10, 0, { platform: "X", commissionPct: 20 });
    expect(r.netMarginPct).toBe(0);
    expect(Number.isFinite(r.netProfit)).toBe(true);
  });
});
