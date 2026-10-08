import { describe, it, expect } from "vitest";
import {
  calculateRealtimeDRE,
  type FinancialTransactionItem,
} from "./dre-engine";

describe("Realtime DRE Engine Module", () => {
  const transactions: FinancialTransactionItem[] = [
    {
      id: "tx-1",
      date: "2026-10-07",
      type: "Receita",
      category: "Venda de Filamento",
      channel: "site_filaments",
      revenue_cents: 12000, // R$ 120.00
      expense_cents: 0,
      platform_fee_cents: 350, // R$ 3.50 Pix fee
      cpv_filament_cost_cents: 6500, // R$ 65.00
      cpv_machine_cost_cents: 0,
      status: "reconciled",
    },
    {
      id: "tx-2",
      date: "2026-10-07",
      type: "Receita",
      category: "Impressão 3D",
      channel: "demand_printing",
      revenue_cents: 25000, // R$ 250.00
      expense_cents: 0,
      platform_fee_cents: 750, // R$ 7.50
      cpv_filament_cost_cents: 4200, // R$ 42.00
      cpv_machine_cost_cents: 1800, // R$ 18.00
      status: "reconciled",
    },
    {
      id: "tx-3",
      date: "2026-10-07",
      type: "Despesa",
      category: "Energia Elétrica",
      channel: "manual",
      revenue_cents: 0,
      expense_cents: 4500, // R$ 45.00
      status: "reconciled",
    },
    {
      id: "tx-4",
      date: "2026-10-01",
      type: "Receita",
      category: "B2B Impressão",
      channel: "demand_printing",
      revenue_cents: 50000, // R$ 500.00
      expense_cents: 0,
      platform_fee_cents: 0,
      cpv_filament_cost_cents: 9000,
      cpv_machine_cost_cents: 3000,
      status: "reconciled",
    },
  ];

  it("calculates consolidated DRE cascade accurately in integer cents", () => {
    // Considering transactions for 2026-10-07
    const result = calculateRealtimeDRE(transactions, {
      period: "daily",
      targetDate: "2026-10-07",
      channel: "all",
    });

    // Gross Revenue: 12000 + 25000 = 37000
    expect(result.grossRevenueCents).toBe(37000);
    // Platform Fees: 350 + 750 = 1100
    expect(result.platformFeesCents).toBe(1100);
    // Net Revenue: 37000 - 1100 = 35900
    expect(result.netRevenueCents).toBe(35900);
    // CPV Filament: 6500 + 4200 = 10700
    expect(result.filamentDirectCostCents).toBe(10700);
    // CPV Machine: 0 + 1800 = 1800
    expect(result.machineDirectCostCents).toBe(1800);
    // Total CPV: 10700 + 1800 = 12500
    expect(result.totalCPVCents).toBe(12500);
    // Contribution Margin: 35900 - 12500 = 23400
    expect(result.contributionMarginCents).toBe(23400);
    // Fixed Expenses: 4500 (Energia)
    expect(result.fixedExpensesCents).toBe(4500);
    // Net Operating Profit: 23400 - 4500 = 18900
    expect(result.netOperatingProfitCents).toBe(18900);
    // Margins %
    expect(result.contributionMarginPct).toBeCloseTo((23400 / 37000) * 100, 1);
    expect(result.netMarginPct).toBeCloseTo((18900 / 37000) * 100, 1);
  });

  it("filters DRE specifically by channel (site_filaments vs demand_printing)", () => {
    const filamentsOnly = calculateRealtimeDRE(transactions, {
      period: "daily",
      targetDate: "2026-10-07",
      channel: "site_filaments",
    });

    expect(filamentsOnly.grossRevenueCents).toBe(12000);
    expect(filamentsOnly.totalCPVCents).toBe(6500);
    expect(filamentsOnly.transactionCount).toBe(1);

    const printOnly = calculateRealtimeDRE(transactions, {
      period: "daily",
      targetDate: "2026-10-07",
      channel: "demand_printing",
    });

    expect(printOnly.grossRevenueCents).toBe(25000);
    expect(printOnly.totalCPVCents).toBe(6000); // 4200 + 1800
    expect(printOnly.transactionCount).toBe(1);
  });

  it("filters DRE by monthly period encompassing all month dates", () => {
    const monthlyResult = calculateRealtimeDRE(transactions, {
      period: "monthly",
      targetDate: "2026-10-07",
      channel: "all",
    });

    // 12000 + 25000 + 50000 = 87000
    expect(monthlyResult.grossRevenueCents).toBe(87000);
    expect(monthlyResult.transactionCount).toBe(4);
  });
});
