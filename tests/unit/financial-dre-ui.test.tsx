import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { DreClient } from "@/app/app/(pro)/financeiro/dre/DreClient";
import { CashflowClient } from "@/app/app/(pro)/financeiro/fluxo-caixa/CashflowClient";

describe("Financial Realtime DRE & Cashflow UI Components", () => {
  const mockInitialTransactions = [
    {
      id: "tx-1",
      date: "2026-10-07",
      type: "Receita" as const,
      category: "Venda de Filamento",
      channel: "site_filaments",
      revenue_cents: 12000,
      expense_cents: 0,
      platform_fee_cents: 350,
      cpv_filament_cost_cents: 6500,
      cpv_machine_cost_cents: 0,
      status: "reconciled",
    },
    {
      id: "tx-2",
      date: "2026-10-07",
      type: "Receita" as const,
      category: "Impressão 3D",
      channel: "demand_printing",
      revenue_cents: 25000,
      expense_cents: 0,
      platform_fee_cents: 750,
      cpv_filament_cost_cents: 4200,
      cpv_machine_cost_cents: 1800,
      status: "reconciled",
    },
    {
      id: "tx-3",
      date: "2026-10-07",
      type: "Despesa" as const,
      category: "Energia Elétrica",
      channel: "manual",
      revenue_cents: 0,
      expense_cents: 4500,
      status: "reconciled",
    },
  ];

  it("renders DRE Client with KPI metrics and cascading breakdown", () => {
    render(<DreClient initialTransactions={mockInitialTransactions} />);

    expect(screen.getByText("DRE Gerencial em Tempo Real")).toBeDefined();
    expect(screen.getByText("Receita Bruta")).toBeDefined();
    expect(screen.getByText("CPV / Custos Diretos")).toBeDefined();
    expect(screen.getAllByText("Margem de Contribuição").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Lucro Líquido Operacional").length).toBeGreaterThanOrEqual(1);

    // Cascading table elements
    expect(screen.getByText("Demonstrativo de Resultado do Exercício")).toBeDefined();
    expect(screen.getByText(/Custo Direto de Filamentos/)).toBeDefined();
    expect(screen.getByText(/Custo Direto de Máquina/)).toBeDefined();
  });

  it("renders Cashflow Client with realized and projected cards", () => {
    const mockCashflowSummary = {
      currentBalanceCents: 20000,
      projectedInflowCents: 15000,
      projectedOutflowCents: 5000,
      projectedBalanceCents: 30000,
      unreconciledPixCount: 1,
      recentTransactions: [
        {
          id: "tx-pix-1",
          date: "2026-10-07",
          description: "Pedido #001 - Pix",
          type: "Receita" as const,
          category: "Filamentos",
          revenue_cents: 15000,
          expense_cents: 0,
          net_cents: 15000,
          payment_method: "pix",
          status: "pending",
          is_projected: true,
        },
      ],
    };

    render(<CashflowClient summary={mockCashflowSummary} />);

    expect(screen.getByText("Fluxo de Caixa & Conciliação Pix")).toBeDefined();
    expect(screen.getByText("Saldo Atual (Realizado)")).toBeDefined();
    expect(screen.getByText("Entradas Previstas")).toBeDefined();
    expect(screen.getByText("Saídas Previstas")).toBeDefined();
    expect(screen.getByText("Saldo Projetado")).toBeDefined();
    expect(screen.getByText("Pedido #001 - Pix")).toBeDefined();
    expect(screen.getByText("Conciliar Pix")).toBeDefined();
  });
});
