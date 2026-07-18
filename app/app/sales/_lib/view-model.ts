/**
 * Pure view-model helpers for the Sales shell (stage E1).
 *
 * Everything here is framework-free on purpose: filtering, period math, KPI
 * deltas, sparkline bucketing and CSV building are unit-testable without React.
 * The only DOM-touching function is `downloadCsv` (guarded, client-only).
 */

import type { SaleFulfillment, SalePayment, SaleRow, SalesKpis } from "@/lib/sales/config";

// ─── UI enums ────────────────────────────────────────────────────────────────

export type ViewMode = "tabela" | "kanban" | "timeline";
export type Density = "confortavel" | "compacto";
export type DatePreset = "hoje" | "7d" | "30d" | "90d" | "12m" | "tudo" | "custom";

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "12m", label: "12 meses" },
  { value: "tudo", label: "Tudo" },
  { value: "custom", label: "Personalizado" },
];

/** Monthly net-profit goal shown in the "Lucro Líquido" card (R$ 9.750,00). */
export const MONTH_GOAL_CENTS = 975_000;

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface SalesFilters {
  preset: DatePreset;
  /** YYYY-MM-DD ("" = unset). Only used when preset === "custom". */
  customFrom: string;
  customTo: string;
  search: string;
  /** Empty array = all. */
  platforms: string[];
  payments: SalePayment[];
  fulfillments: SaleFulfillment[];
}

export const DEFAULT_FILTERS: SalesFilters = {
  // "tudo" preserves today's behavior (page always showed every sale).
  preset: "tudo",
  customFrom: "",
  customTo: "",
  search: "",
  platforms: [],
  payments: [],
  fulfillments: [],
};

/** A saved view = filters + view mode under a user-given name (localStorage). */
export interface SavedView {
  name: string;
  filters: SalesFilters;
  view: ViewMode;
}

// ─── Date math (all on YYYY-MM-DD strings, compared lexicographically) ───────

export interface DateRange {
  from: string | null;
  to: string | null;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive day count between two ISO dates (same day = 1). */
function spanDays(from: string, to: string): number {
  const ms = Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

export function resolveRange(f: SalesFilters, today: string): DateRange {
  switch (f.preset) {
    case "hoje":
      return { from: today, to: today };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "90d":
      return { from: addDays(today, -89), to: today };
    case "12m":
      return { from: addDays(today, -364), to: today };
    case "custom":
      return { from: f.customFrom || null, to: f.customTo || null };
    case "tudo":
      return { from: null, to: null };
  }
}

/** Previous equivalent period (same length, right before `range`). Null if open-ended. */
export function previousRange(range: DateRange): DateRange | null {
  if (!range.from || !range.to) return null;
  const len = spanDays(range.from, range.to);
  const prevTo = addDays(range.from, -1);
  return { from: addDays(prevTo, -(len - 1)), to: prevTo };
}

export function inRange(soldAt: string, range: DateRange): boolean {
  if (range.from && soldAt < range.from) return false;
  if (range.to && soldAt > range.to) return false;
  return true;
}

// ─── Filtering ───────────────────────────────────────────────────────────────

/** Short human order code derived from the UUID (until a real sequence exists). */
export function orderCode(row: SaleRow): string {
  return row.id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

/** Applies every facet EXCEPT the date range (deltas re-use it on the previous period). */
export function applyFacets(sales: SaleRow[], f: SalesFilters): SaleRow[] {
  const q = f.search.trim().toLowerCase();
  return sales.filter((r) => {
    if (f.platforms.length > 0 && !f.platforms.includes(r.platform)) return false;
    if (f.payments.length > 0 && !f.payments.includes(r.paymentStatus)) return false;
    if (f.fulfillments.length > 0 && !f.fulfillments.includes(r.fulfillmentStatus)) return false;
    if (q) {
      const hay = `${r.customerName ?? ""} ${r.platform} ${orderCode(r)}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function applyFilters(sales: SaleRow[], f: SalesFilters, today: string): SaleRow[] {
  const range = resolveRange(f, today);
  return applyFacets(sales, f).filter((r) => inRange(r.soldAt, range));
}

// ─── KPIs & deltas ───────────────────────────────────────────────────────────

/** Same convention as the server: money KPIs ignore legacy-cancelled sales. */
export function activeRows(rows: SaleRow[]): SaleRow[] {
  return rows.filter((r) => r.status !== "cancelado");
}

export function computeKpis(rows: SaleRow[]): SalesKpis {
  const active = activeRows(rows);
  const totalCents = active.reduce((s, r) => s + r.totalCents, 0);
  const commissionCents = active.reduce((s, r) => s + r.commissionCents, 0);
  return {
    totalCents,
    netCents: totalCents - commissionCents,
    count: active.length,
    avgTicketCents: active.length ? Math.round(totalCents / active.length) : 0,
  };
}

/** Percent variation vs previous period. Null = not computable (shows "—"). */
export function deltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

// ─── Sparklines ──────────────────────────────────────────────────────────────

export interface SparkSeries {
  total: number[];
  net: number[];
  count: number[];
  avg: number[];
}

/**
 * Buckets the (already filtered) rows into `buckets` equal slices of the range.
 * Open-ended ranges ("Tudo") fall back to the min–max soldAt found in the data.
 */
export function sparkSeries(rows: SaleRow[], range: DateRange, buckets = 12): SparkSeries {
  const zeros = (): number[] => Array.from({ length: buckets }, () => 0);
  const series: SparkSeries = { total: zeros(), net: zeros(), count: zeros(), avg: zeros() };

  const active = activeRows(rows);
  let from = range.from;
  let to = range.to;
  if (!from || !to) {
    const dates = active.map((r) => r.soldAt).sort();
    from = dates[0] ?? null;
    to = dates[dates.length - 1] ?? null;
  }
  if (!from || !to || active.length === 0) return series;

  const start = Date.parse(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);
  const span = Math.max(end - start, 1);

  for (const r of active) {
    const t = Date.parse(`${r.soldAt}T12:00:00Z`);
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((t - start) / span) * buckets)));
    series.total[idx] = (series.total[idx] ?? 0) + r.totalCents;
    series.net[idx] = (series.net[idx] ?? 0) + (r.totalCents - r.commissionCents);
    series.count[idx] = (series.count[idx] ?? 0) + 1;
  }
  for (let i = 0; i < buckets; i++) {
    const count = series.count[i] ?? 0;
    const total = series.total[i] ?? 0;
    series.avg[i] = count > 0 ? Math.round(total / count) : 0;
  }
  return series;
}

// ─── Pending alert ───────────────────────────────────────────────────────────

/** Sales still unpaid and sold more than `days` days ago (default 7). */
export function pendingOlderThan(sales: SaleRow[], today: string, days = 7): SaleRow[] {
  const cutoff = addDays(today, -days);
  return sales.filter(
    (r) => r.paymentStatus === "pendente" && r.status !== "cancelado" && r.soldAt < cutoff,
  );
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dateBR(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

/** "83,9%" — pt-BR percent with one decimal. */
export function pctBR(value: number): string {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** "+374,5%" / "-12,0%" for delta chips. */
export function deltaLabel(delta: number | null): string {
  if (delta === null) return "—";
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${pctBR(delta)}`;
}

/** Legacy status labels (NewSaleDialog still writes the legacy axis). */
export const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  enviado: "Enviado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

// ─── CSV export ──────────────────────────────────────────────────────────────

/** Same conventions as control/_lib/export.ts: semicolon, quoted text, BOM for Excel. */
export function buildCsv(
  rows: SaleRow[],
  labels: { fulfillment: Record<SaleFulfillment, string>; payment: Record<SalePayment, string> },
): string {
  const sep = ";";
  const esc = (s: string): string => `"${s.replace(/"/g, '""')}"`;
  const money = (cents: number): string => (cents / 100).toFixed(2).replace(".", ",");
  const lines: string[] = [
    ["Nº", "Data", "Cliente", "Canal", "Produção", "Pagamento", "Comissão (R$)", "Total (R$)", "Observações"]
      .map(esc)
      .join(sep),
  ];
  rows.forEach((r) => {
    lines.push(
      [
        esc(orderCode(r)),
        esc(r.soldAt),
        esc(r.customerName ?? ""),
        esc(r.platform),
        esc(labels.fulfillment[r.fulfillmentStatus]),
        esc(labels.payment[r.paymentStatus]),
        money(r.commissionCents),
        money(r.totalCents),
        esc(r.notes ?? ""),
      ].join(sep),
    );
  });
  return "﻿" + lines.join("\r\n");
}

/** Client-only: triggers a download of the CSV built from `csv`. */
export function downloadCsv(csv: string, filename: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
