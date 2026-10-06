"use client";

/**
 * Timeline view (stage E3) — chronological feed of the filtered sales, newest
 * first, grouped by day ("Hoje" / "Ontem" / "18 jul 2026"). Each entry is a
 * button that opens the sale drawer via `onOpenSale`. Vertical scroll is
 * isolated inside the card so the page shell keeps its own rhythm.
 */

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock } from "@/lib/ui/icons";
import {
  FULFILLMENT_LABEL,
  PAYMENT_LABEL,
  type SaleFulfillment,
  type SalePayment,
  type SaleRow,
} from "@/lib/sales/config";
import { brl, orderCode, todayIso } from "../_lib/view-model";
import { dayLabel, groupByDay } from "../_lib/timeline";

interface Props {
  rows: SaleRow[];
  /** Opens the sale detail drawer in the parent shell. */
  onOpenSale: (id: string) => void;
}

/** Same production-stage accent dots as the Kanban — one visual language. */
const STAGE_DOT: Record<SaleFulfillment, string> = {
  confirmada: "bg-sky-500",
  produzindo: "bg-amber-500",
  pronta: "bg-violet-500",
  enviada: "bg-cyan-500",
  entregue: "bg-emerald-500",
  cancelada: "bg-zinc-500",
};

const FULFILLMENT_VARIANT: Record<
  SaleFulfillment,
  "neutral" | "warning" | "default" | "info" | "success" | "error"
> = {
  confirmada: "neutral",
  produzindo: "warning",
  pronta: "default",
  enviada: "info",
  entregue: "success",
  cancelada: "error",
};

const PAYMENT_VARIANT: Record<SalePayment, "success" | "warning" | "error"> = {
  pago: "success",
  pendente: "warning",
  estornado: "error",
};

export default function SalesTimelineView({ rows, onOpenSale }: Props) {
  const today = useMemo(() => todayIso(), []);
  const groups = useMemo(() => groupByDay(rows), [rows]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
        <span className="rounded-xl bg-accent-soft p-3 text-accent">
          <Clock className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-medium">Nenhuma venda no período</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ajuste os filtros ou lance uma venda para vê-la na linha do tempo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Linha do tempo</h2>
        <span className="text-xs text-muted-foreground">
          {rows.length} venda{rows.length > 1 ? "s" : ""}
        </span>
      </header>

      <div className="max-h-[600px] overflow-y-auto pr-1">
        {groups.map((group) => (
          <div key={group.date}>
            <h3 className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-surface py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>{dayLabel(group.date, today)}</span>
              <span className="font-mono normal-case tracking-normal">
                {brl(group.rows.reduce((s, r) => s + r.totalCents, 0))}
              </span>
            </h3>

            <ol className="mb-3 ml-1.5 border-l border-border pl-4">
              {group.rows.map((r) => (
                <li key={r.id} className="relative py-1">
                  <span
                    className={`absolute -left-[21px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ring-2 ring-surface ${STAGE_DOT[r.fulfillmentStatus]}`}
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => onOpenSale(r.id)}
                    aria-label={`Abrir venda ${orderCode(r)}, ${r.customerName ?? "sem cliente"}, ${brl(r.totalCents)}`}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-transparent px-2.5 py-2 text-left transition-colors hover:border-accent/40 hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                      #{orderCode(r)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {r.customerName ?? "Sem cliente"}
                    </span>
                    <Badge variant="neutral" className="px-2 py-0 text-[10px]">
                      {r.platform}
                    </Badge>
                    <Badge
                      variant={PAYMENT_VARIANT[r.paymentStatus]}
                      className="px-2 py-0 text-[10px]"
                    >
                      {PAYMENT_LABEL[r.paymentStatus]}
                    </Badge>
                    <Badge
                      variant={FULFILLMENT_VARIANT[r.fulfillmentStatus]}
                      className="px-2 py-0 text-[10px]"
                    >
                      {FULFILLMENT_LABEL[r.fulfillmentStatus]}
                    </Badge>
                    <span className="shrink-0 font-mono text-xs font-semibold">
                      {brl(r.totalCents)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
