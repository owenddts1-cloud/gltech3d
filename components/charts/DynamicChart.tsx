"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Layers, LineChart as LineIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";
import { useTheme } from "@/lib/theme";
import {
  buildOption, resolveChartTokens, colorAt, CHART_TYPE_LABELS, isCategorical, SERIES_TYPES,
  type ChartType, type BuildParams, type SeriesDef,
} from "./echarts-theme";
import type { EChartClickParams } from "./EChartCanvas";

// Client-only: o ECharts/echarts-gl não pode renderizar no servidor (canvas/WebGL).
const EChartCanvas = dynamic(() => import("./EChartCanvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-muted/40" />,
});

const ALL_TYPES: ChartType[] = ["donut", "pie", "pie3d", "bar", "bar3d", "line", "area", "histogram"];

export interface DrillInfo {
  label: string;
  value: number;
  seriesName?: string;
}

export interface DynamicChartProps {
  data: Array<Record<string, unknown>>;
  /** Modo série: passe `series`. Modo categórico: passe nameKey/valueKey (default name/value). */
  series?: SeriesDef[];
  categoryKey?: string;
  nameKey?: string;
  valueKey?: string;
  /** Nome da série sintetizada quando um dataset categórico vira barras/linha. */
  valueLabel?: string;
  type?: ChartType;
  allowedTypes?: ChartType[];
  height?: number;
  currency?: boolean;
  valueFormat?: (v: number) => string;
  showBarLabels?: boolean;
  onDrill?: (info: DrillInfo) => void;
  /** Controles extras no cabeçalho (ex.: seletores de mês/ano). */
  headerRight?: React.ReactNode;
  className?: string;
  emptyText?: string;
}

const brlPlain = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function DynamicChart(props: DynamicChartProps) {
  const {
    data, series, categoryKey = "label", nameKey = "name", valueKey = "value",
    valueLabel = "Valor", height = 300, currency, valueFormat, showBarLabels,
    onDrill, headerRight, className, emptyText = "Sem dados para exibir.",
  } = props;

  const { resolvedTheme } = useTheme();
  const isSeriesMode = Array.isArray(series) && series.length > 0;

  const allowedTypes = props.allowedTypes ?? (isSeriesMode ? SERIES_TYPES : ALL_TYPES);
  const [type, setType] = useState<ChartType>(() => {
    const initial = props.type ?? (isSeriesMode ? "bar" : "donut");
    return allowedTypes.includes(initial) ? initial : allowedTypes[0]!;
  });
  const [stacked, setStacked] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const fmtFn = useMemo<(v: number) => string>(() => {
    if (valueFormat) return valueFormat;
    if (currency) return (v: number) => brlPlain(v);
    return (v: number) => v.toLocaleString("pt-BR");
  }, [valueFormat, currency]);

  const tokens = useMemo(() => resolveChartTokens(resolvedTheme === "dark"), [resolvedTheme]);

  const option = useMemo(() => {
    const base: BuildParams = { type, data, tokens, valueFormat: fmtFn, showBarLabels };

    if (!isSeriesMode) {
      if (isCategorical(type)) {
        return buildOption({ ...base, nameKey, valueKey });
      }
      // Dataset categórico renderizado como barras/linha/3D (série única, cor por categoria).
      return buildOption({
        ...base, categoryKey: nameKey,
        series: [{ key: valueKey, name: valueLabel }],
        stacked, hidden, colorByData: true,
      });
    }
    return buildOption({ ...base, categoryKey, series, stacked, hidden });
  }, [type, data, tokens, fmtFn, showBarLabels, isSeriesMode, nameKey, valueKey, valueLabel, categoryKey, series, stacked, hidden]);

  const defs = isSeriesMode ? series! : [{ key: valueKey, name: valueLabel }];
  const canStack = (type === "bar" || type === "area" || type === "histogram") && isSeriesMode && defs.length > 1;
  const showChips = isSeriesMode && defs.length > 1;

  function handleClick(p: EChartClickParams) {
    if (!onDrill) return;
    let value = 0;
    if (typeof p.value === "number") value = p.value;
    else if (Array.isArray(p.value)) value = Number(p.value[p.value.length - 1]) || 0;
    else if (p.data && typeof p.data === "object" && "value" in p.data) value = Number((p.data as { value: unknown }).value) || 0;
    onDrill({ label: p.name ?? "", seriesName: p.seriesName, value });
  }

  const isEmpty = data.length === 0;

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Controles */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Seletor de tipo — combobox com busca (padrão dos menus do CRM) */}
          <Combobox
            className="h-8 w-36 rounded-lg text-xs font-semibold"
            value={type}
            onChange={(v) => setType(v as ChartType)}
            options={allowedTypes.map((t) => ({ value: t, label: CHART_TYPE_LABELS[t] }))}
            searchPlaceholder="Tipo de gráfico…"
          />

          {/* Empilhado / Agrupado */}
          {canStack && (
            <button
              type="button"
              onClick={() => setStacked((s) => !s)}
              aria-pressed={stacked}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors",
                stacked ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {stacked ? <Layers size={13} /> : <LineIcon size={13} />}
              {stacked ? "Empilhado" : "Agrupado"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">{headerRight}</div>
      </div>

      {/* Chips de série */}
      {showChips && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {defs.map((s, i) => {
            const off = hidden.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() =>
                  setHidden((prev) => {
                    const next = new Set(prev);
                    if (next.has(s.key)) next.delete(s.key); else next.add(s.key);
                    return next;
                  })
                }
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  off ? "border-border text-muted-foreground/50 line-through" : "border-border text-foreground hover:bg-muted",
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: s.color || colorAt(tokens, i) }} />
                {s.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Área do gráfico */}
      <div style={{ height }} className="w-full">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{emptyText}</div>
        ) : (
          <EChartCanvas option={option} height={height} onClick={onDrill ? handleClick : undefined} />
        )}
      </div>
    </div>
  );
}
