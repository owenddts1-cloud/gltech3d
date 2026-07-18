"use client";

/**
 * Page header: title + inline stats line (reference CRM style) and the action
 * cluster — Visões (saved views, localStorage), Exportar (CSV) and the
 * "Nova venda" dialog trigger passed in as a slot.
 */

import { useState } from "react";
import { BookmarkSimple, DownloadSimple, Trash } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { brl, pctBR, type SavedView } from "../_lib/view-model";

export interface HeaderStats {
  count: number;
  totalCents: number;
  avgTicketCents: number;
  /** Null when there is no revenue in the period. */
  marginPct: number | null;
  pendingCount: number;
}

interface Props {
  title: string;
  subtitle: string;
  stats: HeaderStats;
  savedViews: SavedView[];
  onSaveView: (name: string) => void;
  onApplyView: (view: SavedView) => void;
  onDeleteView: (name: string) => void;
  onExport: () => void;
  /** NewSaleDialog (owns its own trigger). */
  newSaleSlot: React.ReactNode;
}

export default function SalesHeader({
  title,
  subtitle,
  stats,
  savedViews,
  onSaveView,
  onApplyView,
  onDeleteView,
  onExport,
  newSaleSlot,
}: Props) {
  const [viewName, setViewName] = useState("");

  const statsLine = [
    `${stats.count} ${stats.count === 1 ? "venda" : "vendas"}`,
    `${brl(stats.totalCents)} faturado`,
    `ticket médio ${brl(stats.avgTicketCents)}`,
    stats.marginPct !== null ? `margem ${pctBR(stats.marginPct)}` : null,
    stats.pendingCount > 0 ? `${stats.pendingCount} pendentes` : null,
  ]
    .filter((s): s is string => s !== null)
    .join(" · ");

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{statsLine || subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Visões salvas */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm">
              <BookmarkSimple className="h-4 w-4" />
              Visões
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-3">
            <p className="mb-2 text-xs font-semibold">Visões salvas</p>
            {savedViews.length === 0 && (
              <p className="mb-2 text-xs text-muted-foreground">
                Nenhuma visão salva. Ajuste filtros e salve abaixo.
              </p>
            )}
            <ul className="mb-3 space-y-1">
              {savedViews.map((v) => (
                <li key={v.name} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onApplyView(v)}
                    className="flex-1 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    {v.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Excluir visão ${v.name}`}
                    onClick={() => onDeleteView(v.name)}
                    className="rounded p-1 text-muted-foreground hover:text-error"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 border-t border-border pt-3">
              <Input
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="Nome da visão…"
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!viewName.trim()}
                onClick={() => {
                  onSaveView(viewName.trim());
                  setViewName("");
                }}
              >
                Salvar
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="secondary" size="sm" onClick={onExport}>
          <DownloadSimple className="h-4 w-4" />
          Exportar
        </Button>

        {newSaleSlot}
      </div>
    </header>
  );
}
