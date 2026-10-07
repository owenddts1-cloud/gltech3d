import type { FinancialRecord } from "@/app/actions/control/actions";

export interface DRESummary {
  grossRevenue: number;         // Receita Bruta
  platformFees: number;         // (-) Taxas e Comissões
  netRevenue: number;           // (=) Receita Líquida
  productionCosts: number;      // (-) CPV / Custos 3D (Insumos, Filamento, Maquinário)
  grossProfit: number;          // (=) Margem Bruta
  operationalExpenses: number;  // (-) Despesas Operacionais
  netProfit: number;            // (=) Resultado Líquido / Lucro Operacional
  marginPercentage: number;     // Margem % Líquida
}

export function calculateDRE(records: FinancialRecord[]): DRESummary {
  let grossRevenue = 0;
  let platformFees = 0;
  let productionCosts = 0;
  let operationalExpenses = 0;

  for (const r of records) {
    if (r.status === "cancelled") continue;

    if (r.type === "Receita") {
      grossRevenue += r.revenue || 0;
      platformFees += r.platform_fee || 0;
    } else if (r.type === "Despesa") {
      const category = (r.category || "").toLowerCase();
      const isCPV =
        category.includes("insumo") ||
        category.includes("filamento") ||
        category.includes("resina") ||
        category.includes("peça") ||
        category.includes("produção") ||
        category.includes("cpv");

      if (isCPV) {
        productionCosts += r.expense || 0;
      } else {
        operationalExpenses += r.expense || 0;
      }
    }
  }

  const netRevenue = grossRevenue - platformFees;
  const grossProfit = netRevenue - productionCosts;
  const netProfit = grossProfit - operationalExpenses;
  const marginPercentage = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

  return {
    grossRevenue: Number(grossRevenue.toFixed(2)),
    platformFees: Number(platformFees.toFixed(2)),
    netRevenue: Number(netRevenue.toFixed(2)),
    productionCosts: Number(productionCosts.toFixed(2)),
    grossProfit: Number(grossProfit.toFixed(2)),
    operationalExpenses: Number(operationalExpenses.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    marginPercentage: Number(marginPercentage.toFixed(1)),
  };
}
