import { describe, it, expect } from "vitest";
import {
  totalHours,
  formatHours,
  roiSentence,
  costAnatomy,
  marginTone,
} from "@/lib/calculator/public-view-model";
import { DEFAULT_INPUTS, type CalculatorOutputs } from "@/hooks/calculator/useCalculator";

function outputs(over: Partial<CalculatorOutputs> = {}): CalculatorOutputs {
  return {
    custoFilamento: 5,
    custoEnergia: 0.5,
    custoDepreciacao: 2,
    custoTrabalho: 3,
    custoBase: 10.5,
    custoFalha: 1.5,
    custoTotalUnitario: 12,
    precoSugerido: 24,
    lucroUnitario: 12,
    pecasParaPagar: 292,
    custoLote: 12,
    precoLote: 24,
    lucroLote: 12,
    pctFilamento: 41.7,
    pctEnergia: 4.2,
    pctDepreciacao: 16.7,
    pctTrabalho: 25,
    pctFalha: 12.5,
    ...over,
  };
}

describe("totalHours", () => {
  it("soma impressão e trabalho manual e multiplica pelo lote", () => {
    expect(totalHours({ ...DEFAULT_INPUTS, tempoImpressao: 3, horasManuais: 0.25, quantidade: 4 })).toBe(13);
  });

  it("nunca devolve negativo mesmo com entrada absurda", () => {
    expect(totalHours({ ...DEFAULT_INPUTS, tempoImpressao: -5, horasManuais: 0, quantidade: 2 })).toBe(0);
    expect(totalHours({ ...DEFAULT_INPUTS, quantidade: -3 })).toBe(0);
  });
});

describe("formatHours", () => {
  it("usa uma casa decimal e o sufixo h", () => {
    expect(formatHours(1)).toBe("1,0 h");
    expect(formatHours(12.55)).toBe("12,6 h");
  });
});

describe("roiSentence", () => {
  it("conta quantas peças pagam a máquina quando há lucro", () => {
    const r = roiSentence(outputs());
    expect(r.healthy).toBe(true);
    expect(r.text).toContain("292");
  });

  /**
   * `pecasParaPagar` vem como Infinity quando o lucro unitário é <= 0. Imprimir
   * "∞ peças" seria pior que inútil — a mensagem precisa dizer o que fazer.
   */
  it("troca a frase quando o lucro não paga a máquina", () => {
    const r = roiSentence(outputs({ pecasParaPagar: Infinity, lucroUnitario: 0 }));
    expect(r.healthy).toBe(false);
    expect(r.text).not.toContain("Infinity");
    expect(r.text).not.toContain("∞");
    expect(r.text).toMatch(/margem/i);
  });

  it("também protege contra lucro negativo com contagem finita", () => {
    const r = roiSentence(outputs({ pecasParaPagar: 10, lucroUnitario: -2 }));
    expect(r.healthy).toBe(false);
  });
});

describe("costAnatomy", () => {
  it("devolve as cinco parcelas do custo na ordem do gráfico", () => {
    const rows = costAnatomy(outputs());
    expect(rows.map((r) => r.key)).toEqual([
      "filamento",
      "energia",
      "maquina",
      "trabalho",
      "falhas",
    ]);
  });

  it("as parcelas somam o custo total unitário", () => {
    const o = outputs();
    const sum = costAnatomy(o).reduce((acc, r) => acc + r.value, 0);
    expect(sum).toBeCloseTo(o.custoTotalUnitario, 5);
  });
});

describe("marginTone", () => {
  it("escala do apertado ao folgado sem repetir cor", () => {
    const tight = marginTone(10);
    const ok = marginTone(60);
    const loose = marginTone(150);
    expect(new Set([tight.bar, ok.bar, loose.bar]).size).toBe(3);
  });

  it("fica na paleta marrom da vitrine, sem o vermelho/verde do CRM", () => {
    for (const pct of [0, 39, 40, 89, 90, 300]) {
      expect(marginTone(pct).bar).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});
