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

import { calculateRealCost, costFromHourlyInputs, depreciationPerHour } from "./engine";

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
