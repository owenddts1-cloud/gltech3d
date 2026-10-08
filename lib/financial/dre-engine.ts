/**
 * Realtime DRE Engine Module
 *
 * Implements deterministic cascading managerial DRE:
 * (+) Receita Bruta (Filamentos + Peças 3D + Canais)
 * (-) Taxas de Meios de Pagamento e Plataformas
 * (=) Receita Líquida
 * (-) Custos Diretos de Produção (CPV: Filamentos consumidos + Energia/Depreciação de Máquina)
 * (=) Margem de Contribuição
 * (-) Custos e Despesas Fixas Operacionais
 * (=) Lucro Líquido Operacional
 *
 * Operates strictly in integer cents (BRL) to guarantee zero floating point drift.
 */

export type FinancialTransactionType = "Receita" | "Despesa";

export type FinancialChannel =
  | "all"
  | "site_filaments"
  | "demand_printing"
  | "whatsapp"
  | "shopee"
  | "mercado_livre"
  | "b2b"
  | "manual";

export interface FinancialTransactionItem {
  id: string;
  date: string; // YYYY-MM-DD
  type: FinancialTransactionType;
  category: string;
  channel?: string;
  revenue_cents: number;
  expense_cents: number;
  platform_fee_cents?: number;
  net_cents?: number;
  cpv_filament_cost_cents?: number;
  cpv_machine_cost_cents?: number;
  status?: string;
}

export interface DREFilterOptions {
  period?: "daily" | "weekly" | "monthly" | "all";
  targetDate?: string; // reference date in YYYY-MM-DD, defaults to today
  channel?: FinancialChannel;
}

export interface DREStatementResult {
  grossRevenueCents: number;            // (+) Receita Bruta
  platformFeesCents: number;            // (-) Deduções / Taxas Plataforma
  netRevenueCents: number;              // (=) Receita Líquida
  filamentDirectCostCents: number;      // (-) Custo Direto de Filamento / Insumos
  machineDirectCostCents: number;       // (-) Custo de Máquina (Energia + Depreciação)
  totalCPVCents: number;                // (=) CPV / CMV Total Direto
  contributionMarginCents: number;      // (=) Margem de Contribuição
  contributionMarginPct: number;        // Margem de Contribuição %
  fixedExpensesCents: number;           // (-) Custos e Despesas Fixas / Operacionais
  netOperatingProfitCents: number;      // (=) Lucro Líquido Operacional
  netMarginPct: number;                 // Lucro Líquido %
  transactionCount: number;
}

export function calculateRealtimeDRE(
  transactions: FinancialTransactionItem[],
  options: DREFilterOptions = {}
): DREStatementResult {
  const period = options.period || "all";
  const defaultDate = new Date().toISOString().slice(0, 10);
  const targetDate: string = options.targetDate || defaultDate;
  const channel = options.channel || "all";

  let grossRevenueCents = 0;
  let platformFeesCents = 0;
  let filamentDirectCostCents = 0;
  let machineDirectCostCents = 0;
  let fixedExpensesCents = 0;
  let transactionCount = 0;

  const targetDateObj = new Date(targetDate);
  const targetYearMonth = targetDate.slice(0, 7);

  for (const tx of transactions) {
    if (tx.status === "cancelled") continue;

    // 1. Channel Filter
    if (channel !== "all" && tx.channel && tx.channel !== channel) {
      continue;
    }

    // 2. Period Filter
    if (period === "daily") {
      if (tx.date !== targetDate) continue;
    } else if (period === "monthly") {
      if (tx.date.slice(0, 7) !== targetYearMonth) continue;
    } else if (period === "weekly") {
      const txDateObj = new Date(tx.date);
      const diffDays = Math.abs(
        (targetDateObj.getTime() - txDateObj.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays > 7) continue;
    }

    transactionCount++;

    if (tx.type === "Receita") {
      grossRevenueCents += tx.revenue_cents || 0;
      platformFeesCents += tx.platform_fee_cents || 0;
      filamentDirectCostCents += tx.cpv_filament_cost_cents || 0;
      machineDirectCostCents += tx.cpv_machine_cost_cents || 0;
    } else if (tx.type === "Despesa") {
      const catLower = (tx.category || "").toLowerCase();
      const isDirectCPV =
        catLower.includes("filamento") ||
        catLower.includes("insumo") ||
        catLower.includes("resina") ||
        catLower.includes("bico") ||
        catLower.includes("cpv");

      if (isDirectCPV) {
        filamentDirectCostCents += tx.expense_cents || 0;
      } else {
        fixedExpensesCents += tx.expense_cents || 0;
      }
    }
  }

  const netRevenueCents = grossRevenueCents - platformFeesCents;
  const totalCPVCents = filamentDirectCostCents + machineDirectCostCents;
  const contributionMarginCents = netRevenueCents - totalCPVCents;
  const netOperatingProfitCents = contributionMarginCents - fixedExpensesCents;

  const contributionMarginPct =
    grossRevenueCents > 0
      ? Math.round((contributionMarginCents / grossRevenueCents) * 1000) / 10
      : 0;

  const netMarginPct =
    grossRevenueCents > 0
      ? Math.round((netOperatingProfitCents / grossRevenueCents) * 1000) / 10
      : 0;

  return {
    grossRevenueCents,
    platformFeesCents,
    netRevenueCents,
    filamentDirectCostCents,
    machineDirectCostCents,
    totalCPVCents,
    contributionMarginCents,
    contributionMarginPct,
    fixedExpensesCents,
    netOperatingProfitCents,
    netMarginPct,
    transactionCount,
  };
}
