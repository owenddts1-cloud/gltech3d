"use client";

/**
 * Toolbar of the Sales shell: date presets (+ custom range), free search,
 * multi-check facet filters (channel / payment / production) and, on the
 * right, the view segmented control (Tabela · Kanban · Timeline) plus the
 * density toggle. Fully controlled by the parent — no local filter state.
 */

import { Check, Clock, Funnel, Kanban, MagnifyingGlass, Rows, Table } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  FULFILLMENT_LABEL,
  PAYMENT_LABEL,
  SALES_FULFILLMENT,
  SALES_PAYMENT,
  type SaleFulfillment,
  type SalePayment,
} from "@/lib/sales/config";
import type { SaleChannelOption } from "@/app/actions/sale-channels/actions";
import { DATE_PRESETS, type Density, type SalesFilters, type ViewMode } from "../_lib/view-model";

interface Props {
  filters: SalesFilters;
  onFilters: (patch: Partial<SalesFilters>) => void;
  view: ViewMode;
  onView: (v: ViewMode) => void;
  density: Density;
  onDensity: (d: Density) => void;
  /** Sub-tab pages fix the channel — hides the channel facet. */
  fixedPlatform?: string;
  /** Canais de venda da org — alimenta a faceta "Canal". */
  channelOptions?: SaleChannelOption[];
}

export default function SalesToolbar({
  filters,
  onFilters,
  view,
  onView,
  density,
  onDensity,
  fixedPlatform,
  channelOptions = [],
}: Props) {
  const facetCount =
    (fixedPlatform ? 0 : filters.platforms.length) +
    filters.payments.length +
    filters.fulfillments.length;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      {/* Linha 1 — período */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border p-0.5">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onFilters({ preset: p.value })}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs transition-colors",
                filters.preset === p.value
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {filters.preset === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              aria-label="Data inicial"
              value={filters.customFrom}
              onChange={(e) => onFilters({ customFrom: e.target.value })}
              className="h-8 w-36 text-xs"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="date"
              aria-label="Data final"
              value={filters.customTo}
              onChange={(e) => onFilters({ customTo: e.target.value })}
              className="h-8 w-36 text-xs"
            />
          </div>
        )}
      </div>

      {/* Linha 2 — busca + facetas | visão + densidade */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(e) => onFilters({ search: e.target.value })}
              placeholder="Buscar por nº, cliente…"
              className="h-8 w-56 pl-8 text-xs"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" size="sm" className="h-8">
                <Funnel className="h-3.5 w-3.5" />
                Filtros
                {facetCount > 0 && (
                  <span className="rounded-full bg-accent-soft px-1.5 text-[10px] font-semibold text-accent">
                    {facetCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3">
              {!fixedPlatform && (
                <FacetGroup<string>
                  title="Canal"
                  options={channelOptions.map((c) => ({ value: c.name, label: c.name }))}
                  selected={filters.platforms}
                  onChange={(platforms) => onFilters({ platforms })}
                />
              )}
              <FacetGroup<SalePayment>
                title="Pagamento"
                options={SALES_PAYMENT.map((p) => ({ value: p, label: PAYMENT_LABEL[p] }))}
                selected={filters.payments}
                onChange={(payments) => onFilters({ payments })}
              />
              <FacetGroup<SaleFulfillment>
                title="Produção"
                options={SALES_FULFILLMENT.map((f) => ({ value: f, label: FULFILLMENT_LABEL[f] }))}
                selected={filters.fulfillments}
                onChange={(fulfillments) => onFilters({ fulfillments })}
              />
              {facetCount > 0 && (
                <button
                  type="button"
                  onClick={() => onFilters({ platforms: [], payments: [], fulfillments: [] })}
                  className="mt-1 text-xs font-medium text-accent underline-offset-4 hover:underline"
                >
                  Limpar filtros
                </button>
              )}
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented: Tabela · Kanban · Timeline */}
          <div className="flex items-center gap-1 rounded-xl border border-border p-0.5">
            <ViewButton current={view} value="tabela" label="Tabela" icon={<Table className="h-3.5 w-3.5" />} onView={onView} />
            <ViewButton current={view} value="kanban" label="Kanban" icon={<Kanban className="h-3.5 w-3.5" />} onView={onView} />
            <ViewButton current={view} value="timeline" label="Timeline" icon={<Clock className="h-3.5 w-3.5" />} onView={onView} />
          </div>

          {/* Densidade */}
          <button
            type="button"
            onClick={() => onDensity(density === "confortavel" ? "compacto" : "confortavel")}
            title={`Densidade: ${density === "confortavel" ? "Confortável" : "Compacto"}`}
            className="flex items-center gap-1.5 rounded-xl border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Rows className="h-3.5 w-3.5" />
            {density === "confortavel" ? "Confortável" : "Compacto"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewButton({
  current,
  value,
  label,
  icon,
  onView,
}: {
  current: ViewMode;
  value: ViewMode;
  label: string;
  icon: React.ReactNode;
  onView: (v: ViewMode) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onView(value)}
      aria-pressed={current === value}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors",
        current === value
          ? "bg-accent-soft font-medium text-accent"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function FacetGroup<T extends string>({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  function toggle(value: T) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="space-y-0.5">
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(o.value)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted",
                on ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-3.5 w-3.5 items-center justify-center rounded border",
                  on ? "border-accent bg-accent text-accent-foreground" : "border-border",
                )}
              >
                {on && <Check className="h-2.5 w-2.5" weight="bold" />}
              </span>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
