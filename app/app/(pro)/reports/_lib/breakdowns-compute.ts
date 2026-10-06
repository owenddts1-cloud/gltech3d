/**
 * Lógica PURA dos breakdowns dos Relatórios (agrupamento + custo de projeto).
 *
 * Separada da server action ([app/actions/reports/breakdowns.ts]) para ser testável sem
 * banco — a action só busca as linhas e delega para `computeReportBreakdowns` aqui.
 * Valores monetários em CENTAVOS.
 */

export type BreakdownKey = "client" | "category" | "project" | "platform";

/** `type` (não `interface`) de propósito: precisa da index signature implícita para ser
 *  aceito como `Record<string, unknown>` pelo `data` do DynamicChart. */
export type BreakdownGroup = {
  name: string;
  value: number;
};

export interface BreakdownDrillRow {
  label: string;
  value: number;
  sub?: string;
  tag?: string;
}

export interface Breakdown {
  key: BreakdownKey;
  title: string;
  source: string;
  isCurrency: boolean;
  groups: BreakdownGroup[];
  drill: Record<string, BreakdownDrillRow[]>;
}

export interface ReportBreakdowns {
  client: Breakdown;
  category: Breakdown;
  project: Breakdown;
  platform: Breakdown;
}

export interface FinRow {
  id: string;
  date: string;
  description: string | null;
  type: string;
  category: string | null;
  platform: string | null;
  revenue_cents: number | string;
  expense_cents: number | string;
}
export interface SoRow {
  id: string;
  title: string | null;
  contact_name: string | null;
  status: string;
  total_cents: number | string;
  created_at: string;
}
export interface MoRow {
  id: string;
  customer_name: string | null;
  platform: string | null;
  status: string;
  total_cents: number | string;
  sold_at: string;
}
export interface ProjRow {
  id: string;
  name: string;
  weight_grams: number | string;
  print_hours: number | string;
  filament_cost_per_kg: number | string;
  wattage: number | string;
  kwh_price: number | string;
  depreciation_per_hour: number | string;
}

export interface BreakdownInput {
  fin: FinRow[];
  so: SoRow[];
  mo: MoRow[];
  proj: ProjRow[];
}

const num = (v: unknown): number => (v == null ? 0 : Number(v) || 0);
const reaisToCents = (v: number): number => Math.round(v * 100);
const dateBR = (iso: string): string => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
};

/** Agrega grupos a partir de linhas de drill (soma valores por chave, ordena desc). */
function groupsFromDrill(drill: Record<string, BreakdownDrillRow[]>): BreakdownGroup[] {
  return Object.entries(drill)
    .map(([name, rows]) => ({ name, value: rows.reduce((s, r) => s + r.value, 0) }))
    .sort((a, b) => b.value - a.value);
}

function push(drill: Record<string, BreakdownDrillRow[]>, key: string, row: BreakdownDrillRow) {
  (drill[key] ??= []).push(row);
}

export function computeReportBreakdowns({ fin, so, mo, proj }: BreakdownInput): ReportBreakdowns {
  // ── 1. Receita por cliente (O.S. concluídas + Vendas de marketplace) ──
  const clientDrill: Record<string, BreakdownDrillRow[]> = {};
  for (const o of so) {
    if (o.status !== "concluido") continue;
    const client = (o.contact_name || "").trim() || "Sem cliente";
    push(clientDrill, client, {
      label: o.title || "O.S. sem título",
      value: num(o.total_cents),
      sub: `O.S. · ${dateBR(o.created_at)}`,
      tag: "O.S.",
    });
  }
  for (const m of mo) {
    if (m.status === "cancelado") continue;
    const client = (m.customer_name || "").trim() || "Sem cliente";
    push(clientDrill, client, {
      label: m.platform || "Venda",
      value: num(m.total_cents),
      sub: `Venda · ${dateBR(m.sold_at)}`,
      tag: m.platform || "Venda",
    });
  }

  // ── 2. Despesa por categoria (Controle) ──
  const categoryDrill: Record<string, BreakdownDrillRow[]> = {};
  for (const r of fin) {
    if (r.type !== "Despesa") continue;
    const cents = num(r.expense_cents);
    if (cents <= 0) continue;
    const cat = (r.category || "").trim() || "Outros";
    push(categoryDrill, cat, { label: r.description || "Lançamento", value: cents, sub: dateBR(r.date) });
  }

  // ── 3. Por projeto (custo de fabricação calculado) ──
  const projectDrill: Record<string, BreakdownDrillRow[]> = {};
  for (const p of proj) {
    const filament = num(p.weight_grams) * (num(p.filament_cost_per_kg) / 1000);
    const energy = (num(p.wattage) / 1000) * num(p.print_hours) * num(p.kwh_price);
    const deprec = num(p.print_hours) * num(p.depreciation_per_hour);
    projectDrill[p.name] = [
      { label: "Insumo (filamento)", value: reaisToCents(filament), sub: `${num(p.weight_grams)}g` },
      { label: "Energia", value: reaisToCents(energy), sub: `${num(p.print_hours)}h` },
      { label: "Depreciação", value: reaisToCents(deprec), sub: `${num(p.print_hours)}h` },
    ];
  }

  // ── 4. Por canal/plataforma (Receita: Controle + Vendas) ──
  const platformDrill: Record<string, BreakdownDrillRow[]> = {};
  for (const r of fin) {
    if (r.type !== "Receita") continue;
    const cents = num(r.revenue_cents);
    if (cents <= 0) continue;
    const plat = (r.platform || "").trim() || "Direto/B2B";
    push(platformDrill, plat, { label: r.description || "Receita", value: cents, sub: dateBR(r.date) });
  }
  for (const m of mo) {
    if (m.status === "cancelado") continue;
    const plat = (m.platform || "").trim() || "Direto/B2B";
    push(platformDrill, plat, { label: m.customer_name || "Venda", value: num(m.total_cents), sub: `Venda · ${dateBR(m.sold_at)}` });
  }

  return {
    client: { key: "client", title: "Receita por cliente", source: "service_orders + marketplace_orders", isCurrency: true, groups: groupsFromDrill(clientDrill), drill: clientDrill },
    category: { key: "category", title: "Despesa por categoria", source: "financial_records (Despesa)", isCurrency: true, groups: groupsFromDrill(categoryDrill), drill: categoryDrill },
    project: { key: "project", title: "Custo por projeto", source: "projects (custo calculado)", isCurrency: true, groups: groupsFromDrill(projectDrill), drill: projectDrill },
    platform: { key: "platform", title: "Receita por canal", source: "financial_records (Receita) + marketplace_orders", isCurrency: true, groups: groupsFromDrill(platformDrill), drill: platformDrill },
  };
}
