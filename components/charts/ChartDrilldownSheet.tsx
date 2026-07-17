"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export interface DrilldownRow {
  /** Rótulo principal da linha (ex.: descrição do lançamento, nome da OS). */
  label: string;
  /** Valor numérico já formatável (a formatação vem de valueFormat). */
  value: number;
  /** Texto secundário opcional (data, categoria, status…). */
  sub?: string;
  /** Badge opcional à direita do rótulo. */
  tag?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  subtitle?: string;
  rows: DrilldownRow[];
  valueFormat: (v: number) => string;
  emptyText?: string;
}

/** Painel de detalhamento (drill-down) das linhas por trás de uma fatia/barra do gráfico. */
export function ChartDrilldownSheet({ open, onOpenChange, title, subtitle, rows, valueFormat, emptyText = "Sem lançamentos neste grupo." }: Props) {
  const total = rows.reduce((s, r) => s + r.value, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-xl border border-border bg-surface">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-foreground">{title}</DialogTitle>
          {subtitle && <DialogDescription className="text-xs">{subtitle}</DialogDescription>}
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto">
          {rows.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">{emptyText}</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-medium text-foreground">{r.label}</span>
                      {r.tag && <Badge variant="secondary" className="shrink-0 text-[9px] font-normal">{r.tag}</Badge>}
                    </div>
                    {r.sub && <div className="truncate text-[11px] text-muted-foreground">{r.sub}</div>}
                  </div>
                  <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground">{valueFormat(r.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
            <span className="font-semibold text-muted-foreground">Total ({rows.length})</span>
            <span className="font-mono text-sm font-bold tabular-nums text-foreground">{valueFormat(total)}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
