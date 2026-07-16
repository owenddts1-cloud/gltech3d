import { type FinancialRecord } from "@/app/actions/control/actions";

export const MONTH_ORDER = ["JAN.", "FEV.", "MAR.", "ABR.", "MAI.", "JUN.", "JUL.", "AGO.", "SET.", "OUT.", "NOV.", "DEZ."];

export interface Totals {
  totalRevenue: number;
  totalExpense: number;
  balance: number;
}

export interface MonthlyPoint {
  month: string;
  Receita: number;
  Despesa: number;
  "Saldo Mês": number;
  "Saldo Acumulado": number;
}

export interface CategorySlice {
  name: string;
  value: number;
}

/**
 * `revenue` and `expense` are the LINE TOTAL, never a unit price, so nothing here multiplies
 * by `quantity`. The source sheet records "Filamento PLA, qty 5, R$ 324,50" meaning R$ 64,90
 * per spool — consistent with its own R$ 79,99 single-spool line. An earlier version multiplied
 * by quantity and inflated every figure on the dashboard.
 */
export function computeTotals(records: FinancialRecord[]): Totals {
  let rev = 0;
  let exp = 0;
  records.forEach(r => {
    if (r.type === "Receita") {
      rev += r.revenue || 0;
    } else {
      exp += r.expense || 0;
    }
  });
  return { totalRevenue: rev, totalExpense: exp, balance: rev - exp };
}

export function computeMonthlyData(records: FinancialRecord[]): MonthlyPoint[] {
  const monthlyMap: Record<string, { month: string; Receita: number; Despesa: number }> = {};

  // Initialize all 12 months by default
  MONTH_ORDER.forEach(m => {
    monthlyMap[m] = { month: m, Receita: 0, Despesa: 0 };
  });

  records.forEach(r => {
    const m = r.month || "Outro";
    if (!monthlyMap[m]) {
      monthlyMap[m] = { month: m, Receita: 0, Despesa: 0 };
    }
    if (r.type === "Receita") {
      monthlyMap[m].Receita += r.revenue || 0;
    } else {
      monthlyMap[m].Despesa += r.expense || 0;
    }
  });

  const sortedMonths = Object.keys(monthlyMap).sort(
    (a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b)
  );

  let cumulative = 0;
  return sortedMonths.map(m => {
    const item = monthlyMap[m]!;
    const net = item.Receita - item.Despesa;
    cumulative += net;
    return {
      month: item.month,
      "Receita": Number(item.Receita.toFixed(2)),
      "Despesa": Number(item.Despesa.toFixed(2)),
      "Saldo Mês": Number(net.toFixed(2)),
      "Saldo Acumulado": Number(cumulative.toFixed(2))
    };
  });
}

function categoryBreakdown(records: FinancialRecord[], pick: (r: FinancialRecord) => number): CategorySlice[] {
  const catMap: Record<string, number> = {};
  records.forEach(r => {
    const cat = r.category || "Outros";
    catMap[cat] = (catMap[cat] || 0) + pick(r);
  });
  return Object.entries(catMap)
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);
}

export function computeExpenseCategories(records: FinancialRecord[]): CategorySlice[] {
  return categoryBreakdown(records.filter(r => r.type === "Despesa"), r => r.expense || 0);
}

export function computeRevenueCategories(records: FinancialRecord[]): CategorySlice[] {
  return categoryBreakdown(records.filter(r => r.type === "Receita"), r => r.revenue || 0);
}
