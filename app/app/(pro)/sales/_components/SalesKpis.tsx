"use client";

/**
 * KPI grid (reference CRM style): UPPERCASE label, big value, colored delta
 * chip vs the previous equivalent period, inline SVG sparkline and a sub-hint.
 * "Lucro Líquido" also carries the month-goal progress bar.
 * Below the grid, the thin "Custos & Taxas" strip.
 */

import type { SalesKpis as SalesKpisData } from "@/lib/sales/config";
import { cn } from "@/lib/utils";
import Sparkline from "./Sparkline";
import {
  MONTH_GOAL_CENTS,
  brl,
  deltaLabel,
  pctBR,
  type SparkSeries,
} from "../_lib/view-model";

export interface KpiDeltas {
  net: number | null;
  total: number | null;
  count: number | null;
  avg: number | null;
}

interface Props {
  kpis: SalesKpisData;
  deltas: KpiDeltas;
  spark: SparkSeries;
  /** Net profit of the current calendar month (goal bar ignores the filters). */
  monthNetCents: number;
}

export default function SalesKpis({ kpis, deltas, spark, monthNetCents }: Props) {
  const goalPct = Math.min((monthNetCents / MONTH_GOAL_CENTS) * 100, 100);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Lucro Líquido"
        value={brl(kpis.netCents)}
        delta={deltas.net}
        data={spark.net}
        hint="Receita menos taxas e custo de produção"
      >
        {/* Meta do mês — barra de progresso sobre MONTH_GOAL_CENTS */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Meta do mês · {brl(MONTH_GOAL_CENTS)}</span>
            <span className="font-medium text-accent">{pctBR((monthNetCents / MONTH_GOAL_CENTS) * 100)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${Math.max(goalPct, 0)}%` }}
            />
          </div>
        </div>
      </KpiCard>

      <KpiCard
        label="Receita Bruta"
        value={brl(kpis.totalCents)}
        delta={deltas.total}
        data={spark.total}
        hint="Fora cancelados"
      />
      <KpiCard
        label="Vendas"
        value={String(kpis.count)}
        delta={deltas.count}
        data={spark.count}
        hint="Pedidos no período"
      />
      <KpiCard
        label="Ticket Médio"
        value={brl(kpis.avgTicketCents)}
        delta={deltas.avg}
        data={spark.avg}
        hint="Por pedido"
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  data,
  hint,
  children,
}: {
  label: string;
  value: string;
  delta: number | null;
  data: number[];
  hint: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <DeltaChip delta={delta} />
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <span className="font-mono text-2xl font-semibold tracking-tight">{value}</span>
        <Sparkline data={data} className="shrink-0 text-accent" />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
      {children}
    </div>
  );
}

function DeltaChip({ delta }: { delta: number | null }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        delta === null && "bg-muted text-muted-foreground",
        delta !== null && delta >= 0 && "bg-success-bg text-success-fg",
        delta !== null && delta < 0 && "bg-error-bg text-error-fg",
      )}
      title="Variação vs. período anterior equivalente"
    >
      {deltaLabel(delta)}
    </span>
  );
}

/** Thin "Custos & Taxas" strip — custo de produção real (E5) via produto vinculado. */
export function CostsStrip({
  commissionCents,
  productCostCents,
  totalCents,
  netCents,
}: {
  commissionCents: number;
  /** Soma dos custos de produção das vendas com produto vinculado. */
  productCostCents: number;
  totalCents: number;
  netCents: number;
}) {
  const totalCostCents = commissionCents + productCostCents;
  const marginPct = totalCents > 0 ? (netCents / totalCents) * 100 : null;

  const parts = [
    `Taxas ${brl(commissionCents)}`,
    `Custo produção ${brl(productCostCents)}`,
    `Custo total ${brl(totalCostCents)}`,
    marginPct !== null ? `Margem ${pctBR(marginPct)}` : null,
  ].filter((p): p is string => p !== null);

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-2 text-xs text-muted-foreground">
      <span className="mr-2 font-semibold text-foreground">Custos &amp; Taxas</span>
      {parts.join(" · ")}
    </div>
  );
}
