import { describe, it, expect } from "vitest";
import { type FinancialRecord } from "@/app/actions/control/actions";
import {
  computeTotals, computeMonthlyData, computeExpenseCategories, computeRevenueCategories
} from "./aggregate";

let seq = 0;
function rec(over: Partial<FinancialRecord>): FinancialRecord {
  return {
    id: `r-${++seq}`,
    date: "2026-03-01",
    month: "MAR.",
    quantity: 1,
    description: "Item",
    type: "Despesa",
    category: "Outros",
    revenue: 0,
    expense: 0,
    installments: "1",
    ...over
  };
}

/**
 * Real rows from the GLTech3D sheet. The filament lines are what pin down the semantics:
 * qty 5 / R$ 324,50 is R$ 64,90 per spool, consistent with the qty 1 / R$ 79,99 line.
 * So the value is the line total, and quantity must never be a multiplier.
 */
const SHEET: FinancialRecord[] = [
  rec({ month: "FEV.", date: "2026-02-06", description: "Impressora 3D", quantity: 1, expense: 3808.30 }),
  rec({ month: "FEV.", date: "2026-02-10", description: "Filamento PLA", quantity: 5, expense: 324.50 }),
  rec({ month: "FEV.", date: "2026-02-23", description: "Filamento PLA", quantity: 1, expense: 79.99 }),
  rec({ month: "MAR.", date: "2026-03-07", description: "Filamento PLA", quantity: 3, expense: 266.43 }),
  rec({ month: "FEV.", date: "2026-02-27", description: "Peça 3D (Wellington)", quantity: 5, type: "Receita", revenue: 100.00 }),
  rec({ month: "MAR.", date: "2026-03-06", description: "Peça 3D (Gu Primo)", quantity: 1, type: "Receita", revenue: 60.00 }),
];

describe("computeTotals", () => {
  it("soma o valor da linha e NUNCA multiplica por quantidade", () => {
    const { totalRevenue, totalExpense, balance } = computeTotals(SHEET);

    // 3808.30 + 324.50 + 79.99 + 266.43 — not 3808.30 + 5*324.50 + 79.99 + 3*266.43
    expect(totalExpense).toBeCloseTo(4479.22, 2);
    expect(totalRevenue).toBeCloseTo(160.00, 2); // 100 + 60, not 5*100 + 60
    expect(balance).toBeCloseTo(-4319.22, 2);
  });

  it("ignora o campo do lado oposto ao tipo do lançamento", () => {
    const sujo = [
      rec({ type: "Receita", revenue: 50, expense: 999 }),
      rec({ type: "Despesa", expense: 30, revenue: 999 }),
    ];
    const { totalRevenue, totalExpense } = computeTotals(sujo);
    expect(totalRevenue).toBe(50);
    expect(totalExpense).toBe(30);
  });

  it("devolve zeros para lista vazia", () => {
    expect(computeTotals([])).toEqual({ totalRevenue: 0, totalExpense: 0, balance: 0 });
  });
});

describe("computeMonthlyData", () => {
  it("agrupa por mês sem multiplicar por quantidade e acumula o saldo", () => {
    const data = computeMonthlyData(SHEET);
    const fev = data.find(d => d.month === "FEV.")!;
    const mar = data.find(d => d.month === "MAR.")!;

    expect(fev.Despesa).toBeCloseTo(4212.79, 2); // 3808.30 + 324.50 + 79.99
    expect(fev.Receita).toBeCloseTo(100.00, 2);  // qty 5 não multiplica
    expect(mar.Despesa).toBeCloseTo(266.43, 2);
    expect(mar.Receita).toBeCloseTo(60.00, 2);

    // Saldo acumulado encadeia FEV -> MAR
    expect(fev["Saldo Acumulado"]).toBeCloseTo(-4112.79, 2);
    expect(mar["Saldo Acumulado"]).toBeCloseTo(-4319.22, 2);
    expect(mar["Saldo Acumulado"]).toBeCloseTo(computeTotals(SHEET).balance, 2);
  });

  it("devolve os 12 meses em ordem cronológica mesmo sem lançamentos", () => {
    const data = computeMonthlyData([]);
    expect(data).toHaveLength(12);
    expect(data.map(d => d.month).slice(0, 3)).toEqual(["JAN.", "FEV.", "MAR."]);
    expect(data.every(d => d["Saldo Acumulado"] === 0)).toBe(true);
  });
});

describe("computeExpenseCategories / computeRevenueCategories", () => {
  it("separa por tipo e soma o valor da linha", () => {
    expect(computeExpenseCategories(SHEET)).toEqual([{ name: "Outros", value: 4479.22 }]);
    expect(computeRevenueCategories(SHEET)).toEqual([{ name: "Outros", value: 160.00 }]);
  });

  it("ordena por valor decrescente", () => {
    const cats = computeExpenseCategories([
      rec({ category: "Barato", expense: 10 }),
      rec({ category: "Caro", expense: 500 }),
      rec({ category: "Medio", expense: 100 }),
    ]);
    expect(cats.map(c => c.name)).toEqual(["Caro", "Medio", "Barato"]);
  });
});
