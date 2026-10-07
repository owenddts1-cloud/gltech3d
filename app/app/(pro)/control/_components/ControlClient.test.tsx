import { describe, it, expect } from "vitest";
import { exportFinancialRecordsToCSV } from "../_lib/csv-export";
import { calculateDRE } from "../_lib/dre";
import type { FinancialRecord } from "@/app/actions/control/actions";

describe("ControlClient Features Integration", () => {
  const records: FinancialRecord[] = [
    {
      id: "rec-101",
      date: "2026-10-06",
      month: "OUT.",
      quantity: 1,
      description: "Venda Especial",
      type: "Receita",
      category: "Venda",
      revenue: 200,
      expense: 0,
      platform_fee: 20,
      status: "pending",
      installments: "1",
      platform: "Shopee",
    },
    {
      id: "rec-102",
      date: "2026-10-06",
      month: "OUT.",
      quantity: 1,
      description: "Filamento PLA",
      type: "Despesa",
      category: "Insumo",
      revenue: 0,
      expense: 50,
      status: "reconciled",
      installments: "1",
    },
  ];

  it("calculates DRE correctly for UI presentation", () => {
    const dre = calculateDRE(records);
    expect(dre.grossRevenue).toBe(200);
    expect(dre.platformFees).toBe(20);
    expect(dre.netRevenue).toBe(180);
    expect(dre.productionCosts).toBe(50);
    expect(dre.netProfit).toBe(130);
  });

  it("generates valid CSV export string for financial records", () => {
    const csv = exportFinancialRecordsToCSV(records);
    expect(csv).toContain("Venda Especial");
    expect(csv).toContain("Filamento PLA");
    expect(csv).toContain("Shopee");
  });
});
