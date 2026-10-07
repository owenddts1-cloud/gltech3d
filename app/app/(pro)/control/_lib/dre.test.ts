import { describe, it, expect } from "vitest";
import { calculateDRE } from "./dre";
import type { FinancialRecord } from "@/app/actions/control/actions";

describe("calculateDRE engine", () => {
  it("computes DRE correctly from revenue, fees, production costs and operational expenses", () => {
    const records: FinancialRecord[] = [
      {
        id: "1",
        date: "2026-10-01",
        month: "OUT.",
        quantity: 1,
        description: "Venda Shopee Peça 3D",
        type: "Receita",
        category: "Vendas",
        revenue: 100.0,
        expense: 0,
        platform_fee: 14.0,
        status: "reconciled",
        installments: "1",
        platform: "Shopee",
      },
      {
        id: "2",
        date: "2026-10-02",
        month: "OUT.",
        quantity: 2,
        description: "Filamento PLA Premium",
        type: "Despesa",
        category: "Insumos 3D",
        revenue: 0,
        expense: 30.0,
        status: "reconciled",
        installments: "1",
      },
      {
        id: "3",
        date: "2026-10-03",
        month: "OUT.",
        quantity: 1,
        description: "Conta de Luz Atelier",
        type: "Despesa",
        category: "Energia / Manutenção",
        revenue: 0,
        expense: 20.0,
        status: "reconciled",
        installments: "1",
      },
      {
        id: "4",
        date: "2026-10-04",
        month: "OUT.",
        quantity: 1,
        description: "Venda Cancelada",
        type: "Receita",
        category: "Vendas",
        revenue: 50.0,
        expense: 0,
        status: "cancelled",
        installments: "1",
      },
    ];

    const dre = calculateDRE(records);

    expect(dre.grossRevenue).toBe(100.0);
    expect(dre.platformFees).toBe(14.0);
    expect(dre.netRevenue).toBe(86.0); // 100 - 14
    expect(dre.productionCosts).toBe(30.0);
    expect(dre.grossProfit).toBe(56.0); // 86 - 30
    expect(dre.operationalExpenses).toBe(20.0);
    expect(dre.netProfit).toBe(36.0); // 56 - 20
    expect(dre.marginPercentage).toBe(36.0); // (36/100)*100
  });

  it("handles empty records gracefully", () => {
    const dre = calculateDRE([]);
    expect(dre.grossRevenue).toBe(0);
    expect(dre.netProfit).toBe(0);
    expect(dre.marginPercentage).toBe(0);
  });
});
