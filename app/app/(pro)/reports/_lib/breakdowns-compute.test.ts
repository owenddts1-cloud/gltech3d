import { describe, it, expect } from "vitest";
import { computeReportBreakdowns, type BreakdownInput } from "./breakdowns-compute";

const empty: BreakdownInput = { fin: [], so: [], mo: [], proj: [] };

describe("computeReportBreakdowns", () => {
  it("agrupa receita por cliente (O.S. concluídas + vendas), ordena desc e ignora não-concluídas/canceladas", () => {
    const r = computeReportBreakdowns({
      ...empty,
      so: [
        { id: "1", title: "OS A", contact_name: "Acme", status: "concluido", total_cents: 10000, created_at: "2026-07-01" },
        { id: "2", title: "OS B", contact_name: "Acme", status: "em_producao", total_cents: 5000, created_at: "2026-07-02" }, // ignorada
        { id: "3", title: "OS C", contact_name: "Beta", status: "concluido", total_cents: 3000, created_at: "2026-07-03" },
      ],
      mo: [
        { id: "m1", customer_name: "Acme", platform: "Shopee", status: "pago", total_cents: 2000, sold_at: "2026-07-04" },
        { id: "m2", customer_name: "Gama", platform: "Olx", status: "cancelado", total_cents: 9999, sold_at: "2026-07-05" }, // ignorada
      ],
    });
    expect(r.client.groups).toEqual([
      { name: "Acme", value: 12000 }, // 10000 (OS) + 2000 (venda)
      { name: "Beta", value: 3000 },
    ]);
    expect(r.client.drill["Acme"]).toHaveLength(2);
  });

  it("soma despesa por categoria só de lançamentos Despesa com valor > 0", () => {
    const r = computeReportBreakdowns({
      ...empty,
      fin: [
        { id: "a", date: "2026-07-01", description: "Filamento", type: "Despesa", category: "Insumos", platform: null, revenue_cents: 0, expense_cents: 8000 },
        { id: "b", date: "2026-07-02", description: "Venda", type: "Receita", category: "Venda", platform: "B2B", revenue_cents: 5000, expense_cents: 0 }, // ignorada
        { id: "c", date: "2026-07-03", description: "Cola", type: "Despesa", category: "Insumos", platform: null, revenue_cents: 0, expense_cents: 2000 },
        { id: "d", date: "2026-07-04", description: "Zero", type: "Despesa", category: "Outros", platform: null, revenue_cents: 0, expense_cents: 0 }, // ignorada
      ],
    });
    expect(r.category.groups).toEqual([{ name: "Insumos", value: 10000 }]);
  });

  it("calcula o custo de fabricação por projeto (insumo + energia + depreciação) em centavos", () => {
    const r = computeReportBreakdowns({
      ...empty,
      proj: [
        { id: "p1", name: "Peça X", weight_grams: 250, print_hours: 10, filament_cost_per_kg: 140, wattage: 300, kwh_price: 0.85, depreciation_per_hour: 0.5 },
      ],
    });
    // insumo 250*(140/1000)=35.00 → 3500 ; energia (300/1000)*10*0.85=2.55 → 255 ; deprec 10*0.5=5.00 → 500
    expect(r.project.groups).toEqual([{ name: "Peça X", value: 4255 }]);
    expect(r.project.drill["Peça X"]!.map((d) => d.value)).toEqual([3500, 255, 500]);
  });

  it("agrupa receita por canal (Controle + vendas), usando 'Direto/B2B' quando sem plataforma", () => {
    const r = computeReportBreakdowns({
      ...empty,
      fin: [
        { id: "a", date: "2026-07-01", description: "Venda loja", type: "Receita", category: "Venda", platform: "Shopee", revenue_cents: 4000, expense_cents: 0 },
        { id: "b", date: "2026-07-02", description: "Venda direta", type: "Receita", category: "Venda", platform: "", revenue_cents: 6000, expense_cents: 0 },
      ],
      mo: [{ id: "m1", customer_name: "Cli", platform: "Shopee", status: "pago", total_cents: 1000, sold_at: "2026-07-03" }],
    });
    expect(r.platform.groups).toEqual([
      { name: "Direto/B2B", value: 6000 },
      { name: "Shopee", value: 5000 }, // 4000 + 1000
    ]);
  });

  it("não quebra com entrada vazia", () => {
    const r = computeReportBreakdowns(empty);
    expect(r.client.groups).toEqual([]);
    expect(r.category.groups).toEqual([]);
    expect(r.project.groups).toEqual([]);
    expect(r.platform.groups).toEqual([]);
  });
});
