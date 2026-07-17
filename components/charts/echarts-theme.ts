/**
 * Ponte entre a paleta canônica do CRM ([lib/ui/chart-theme.ts]) e o `option` do ECharts.
 *
 * Por que ler CSS var em runtime: o ECharts pinta em canvas/WebGL e lê a cor como string —
 * `var(--...)` não resolve ali (ao contrário do Recharts, que injeta em atributo SVG). Então
 * resolvemos os tokens de tema para hex/rgb concretos no cliente, seguindo paleta+modo ativos.
 */

import type { EChartsCoreOption } from "echarts";
import { CHART } from "@/lib/ui/chart-theme";

export type ChartType =
  | "donut" | "pie" | "pie3d"        // categóricos
  | "bar" | "bar3d" | "line" | "area" | "histogram"; // séries

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  donut: "Rosca",
  pie: "Pizza 2D",
  pie3d: "Pizza 3D",
  bar: "Barras",
  bar3d: "Colunas 3D",
  line: "Linha",
  area: "Área",
  histogram: "Histograma",
};

export const CATEGORICAL_TYPES: ChartType[] = ["donut", "pie", "pie3d"];
export const SERIES_TYPES: ChartType[] = ["bar", "bar3d", "line", "area", "histogram"];
export const is3D = (t: ChartType): boolean => t === "bar3d" || t === "pie3d";
export const isCategorical = (t: ChartType): boolean => CATEGORICAL_TYPES.includes(t);

/**
 * Paleta categórica (8 hues distintos). Ordem fixa — nunca ciclar cor, é o mecanismo de
 * segurança p/ daltonismo (mesmo espírito do DONUT em chart-theme). Primeiros 3 = DONUT.
 */
const CATEGORICAL = ["#2a78d6", "#1baf7a", "#eda100", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#64748b"];
const CATEGORICAL_DARK = ["#3987e5", "#199e70", "#c98500", "#f87171", "#a78bfa", "#22d3ee", "#fb923c", "#94a3b8"];

export interface ChartTokens {
  text: string;
  textMuted: string;
  border: string;
  surface: string;
  surfaceElevated: string;
  accent: string;
  categorical: string[];
  positive: string;
  negative: string;
}

function readVar(name: string, fallback: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Resolve os tokens de tema para cores concretas que o ECharts entende. */
export function resolveChartTokens(dark: boolean): ChartTokens {
  return {
    text: readVar("--color-text", dark ? "#e5e7eb" : "#0f172a"),
    textMuted: readVar("--color-text-muted", dark ? "#94a3b8" : "#64748b"),
    border: readVar("--color-border", dark ? "#27272a" : "#e2e8f0"),
    surface: readVar("--color-surface", dark ? "#0f172a" : "#ffffff"),
    surfaceElevated: readVar("--color-surface-elevated", dark ? "#1e293b" : "#f1f5f9"),
    accent: readVar("--color-accent", "#f97316"),
    categorical: dark ? CATEGORICAL_DARK : CATEGORICAL,
    positive: CHART.emerald,
    negative: CHART.red,
  };
}

/** Cor estável derivada do índice, para a fatia/série `i`. */
export const colorAt = (tokens: ChartTokens, i: number): string =>
  tokens.categorical[i % tokens.categorical.length]!;

export interface SeriesDef {
  key: string;
  name: string;
  color?: string;
}

export interface BuildParams {
  type: ChartType;
  /** Linhas de dados. Categórico: {name, value}. Séries: {[categoryKey], [seriesKey]:number}. */
  data: Array<Record<string, unknown>>;
  tokens: ChartTokens;
  /** Séries (para tipos de série). */
  series?: SeriesDef[];
  /** Chave do eixo X nos gráficos de série (default "label"). */
  categoryKey?: string;
  /** Chaves p/ categóricos. */
  nameKey?: string;
  valueKey?: string;
  /** Empilhar séries (bar/area). */
  stacked?: boolean;
  /** Séries ocultas (chips). */
  hidden?: Set<string>;
  /** Formata valores no eixo/tooltip/rótulo. */
  valueFormat?: (v: number) => string;
  /** Mostrar rótulo de valor em cima das barras (estilo Manequip). */
  showBarLabels?: boolean;
  /** Colorir cada barra pela categoria (dataset categórico renderizado como barras/linha). */
  colorByData?: boolean;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v) || 0);

/** Tooltip escuro consistente com o resto do app (chart-theme.tooltipStyle). */
function tooltipBase() {
  return {
    backgroundColor: "#0f172a",
    borderWidth: 0,
    borderRadius: 10,
    textStyle: { color: "#fff", fontSize: 12 },
    extraCssText: "box-shadow: 0 8px 24px -6px rgba(0,0,0,0.35);",
    padding: [8, 12] as [number, number],
  };
}

function fmt(valueFormat: ((v: number) => string) | undefined, v: number): string {
  return valueFormat ? valueFormat(v) : String(v);
}

/** Gráficos categóricos: rosca / pizza 2D / pizza "3D" (estilizada). */
function buildCategorical(p: BuildParams): EChartsCoreOption {
  const { type, data, tokens, valueFormat } = p;
  const nameKey = p.nameKey ?? "name";
  const valKey = p.valueKey ?? "value";

  const items = data.map((d, i) => ({
    name: String(d[nameKey] ?? ""),
    value: num(d[valKey]),
    itemStyle: { color: (d.color as string) || colorAt(tokens, i) },
  }));
  const total = items.reduce((s, it) => s + it.value, 0);

  // "Pizza 3D": echarts-gl não tem pie 3D nativo. Aproximação robusta: pizza 2D com sombra
  // forte + realce (parece 3D, sem depender de WebGL). Colunas 3D usam bar3D real.
  const is3DPie = type === "pie3d";
  const isDonut = type === "donut";

  return {
    color: tokens.categorical,
    animation: true,
    animationDuration: 700,
    animationEasing: "cubicOut",
    tooltip: {
      ...tooltipBase(),
      trigger: "item",
      valueFormatter: (v: unknown) => fmt(valueFormat, num(v)),
    },
    legend: {
      type: "scroll",
      bottom: 0,
      textStyle: { color: tokens.textMuted, fontSize: 11 },
      icon: "circle",
    },
    series: [
      {
        type: "pie",
        radius: isDonut ? ["45%", "72%"] : is3DPie ? ["0%", "70%"] : ["0%", "72%"],
        center: ["50%", "46%"],
        avoidLabelOverlap: true,
        roseType: is3DPie ? "radius" : false,
        itemStyle: {
          borderColor: tokens.surface,
          borderWidth: isDonut ? 2 : 1,
          ...(is3DPie
            ? { shadowBlur: 22, shadowColor: "rgba(0,0,0,0.45)", shadowOffsetY: 6 }
            : {}),
        },
        label: isDonut
          ? {
              show: true,
              position: "center",
              formatter: () => fmt(valueFormat, total),
              fontSize: 18,
              fontWeight: "bold",
              color: tokens.text,
            }
          : { show: true, color: tokens.textMuted, fontSize: 11, formatter: "{b}" },
        labelLine: { show: !isDonut },
        emphasis: {
          scale: true,
          scaleSize: is3DPie ? 12 : 6,
          itemStyle: { shadowBlur: 24, shadowColor: "rgba(0,0,0,0.4)" },
        },
        data: items,
      },
    ],
  };
}

/** Gráficos de série: barras / linha / área / histograma. */
function buildSeries(p: BuildParams): EChartsCoreOption {
  const { type, data, tokens, valueFormat, stacked, hidden, showBarLabels } = p;
  const categoryKey = p.categoryKey ?? "label";
  const defs = (p.series ?? []).filter((s) => !hidden?.has(s.key));
  const categories = data.map((d) => String(d[categoryKey] ?? ""));

  const isBar = type === "bar" || type === "histogram";
  const isHistogram = type === "histogram";
  const isArea = type === "area";

  const series = defs.map((s, i) => {
    const color = s.color || colorAt(tokens, i);
    const values = data.map((d) => num(d[s.key]));
    if (isBar) {
      return {
        name: s.name,
        type: "bar" as const,
        stack: stacked ? "total" : undefined,
        colorBy: p.colorByData ? ("data" as const) : ("series" as const),
        barMaxWidth: isHistogram ? undefined : 28,
        barCategoryGap: isHistogram ? "0%" : "20%",
        itemStyle: {
          color: p.colorByData ? undefined : color,
          borderRadius: stacked ? 0 : ([4, 4, 0, 0] as [number, number, number, number]),
        },
        label: showBarLabels && !stacked
          ? { show: true, position: "top" as const, color: tokens.textMuted, fontSize: 10, formatter: (o: { value: number }) => fmt(valueFormat, num(o.value)) }
          : { show: false },
        emphasis: { focus: "series" as const },
        data: values,
      };
    }
    // line / area
    return {
      name: s.name,
      type: "line" as const,
      smooth: true,
      symbol: "circle",
      symbolSize: 6,
      showSymbol: values.length <= 24,
      stack: stacked && isArea ? "total" : undefined,
      lineStyle: { width: 2.5, color },
      itemStyle: { color },
      areaStyle: isArea
        ? { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + "55" }, { offset: 1, color: color + "05" }] } }
        : undefined,
      emphasis: { focus: "series" as const },
      data: values,
    };
  });

  return {
    color: tokens.categorical,
    animation: true,
    animationDuration: 700,
    animationEasing: "cubicOut",
    grid: { top: 24, right: 16, bottom: 40, left: 48, containLabel: true },
    tooltip: {
      ...tooltipBase(),
      trigger: "axis",
      axisPointer: { type: isBar ? "shadow" : "line", shadowStyle: { color: tokens.surfaceElevated } },
      valueFormatter: (v: unknown) => fmt(valueFormat, num(v)),
    },
    legend: {
      type: "scroll",
      bottom: 0,
      textStyle: { color: tokens.textMuted, fontSize: 11 },
      icon: "roundRect",
      data: defs.map((s) => s.name),
    },
    xAxis: {
      type: "category",
      data: categories,
      axisLine: { lineStyle: { color: tokens.border } },
      axisTick: { show: false },
      axisLabel: { color: tokens.textMuted, fontSize: 11 },
      boundaryGap: isBar,
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: tokens.border, type: "dashed" } },
      axisLabel: { color: tokens.textMuted, fontSize: 11, formatter: (v: number) => fmt(valueFormat, v) },
    },
    series,
  };
}

/** Colunas 3D reais via echarts-gl (bar3D). Categoria no eixo X, séries no eixo Y, valor no Z. */
function buildBar3D(p: BuildParams): EChartsCoreOption {
  const { data, tokens, valueFormat } = p;
  const categoryKey = p.categoryKey ?? "label";
  const defs = (p.series ?? []).filter((s) => !p.hidden?.has(s.key));
  const categories = data.map((d) => String(d[categoryKey] ?? ""));
  const seriesNames = defs.map((s) => s.name);

  // Dados no formato [xIndex, yIndex, valor].
  const points: Array<[number, number, number]> = [];
  let maxV = 0;
  data.forEach((d, xi) => {
    defs.forEach((s, yi) => {
      const v = num(d[s.key]);
      if (v > maxV) maxV = v;
      points.push([xi, yi, v]);
    });
  });

  return {
    animation: true,
    tooltip: {
      ...tooltipBase(),
      formatter: (params: { value: [number, number, number] }) => {
        const [xi, yi, v] = params.value;
        return `${categories[xi] ?? ""} · ${seriesNames[yi] ?? ""}<br/><b>${fmt(valueFormat, v)}</b>`;
      },
    },
    visualMap: {
      show: false,
      min: 0,
      max: maxV || 1,
      inRange: { color: [tokens.categorical[0]!, tokens.categorical[2]!, tokens.categorical[3]!] },
    },
    xAxis3D: { type: "category", data: categories, axisLabel: { color: tokens.textMuted } },
    yAxis3D: { type: "category", data: seriesNames, axisLabel: { color: tokens.textMuted } },
    zAxis3D: { type: "value", axisLabel: { color: tokens.textMuted } },
    grid3D: {
      boxWidth: 100,
      boxDepth: Math.max(30, seriesNames.length * 20),
      viewControl: { autoRotate: false, distance: 200 },
      light: { main: { intensity: 1.2, shadow: true }, ambient: { intensity: 0.3 } },
      axisLine: { lineStyle: { color: tokens.border } },
      splitLine: { lineStyle: { color: tokens.border } },
    },
    series: [
      {
        type: "bar3D",
        shading: "lambert",
        data: points,
        barSize: seriesNames.length > 1 ? 6 : 10,
        label: { show: false },
        emphasis: { label: { show: true, formatter: (o: { value: [number, number, number] }) => fmt(valueFormat, o.value[2]) } },
      },
    ],
  };
}

/** Dispatcher: monta o `option` do ECharts para qualquer tipo suportado. */
export function buildOption(p: BuildParams): EChartsCoreOption {
  if (p.type === "bar3d") return buildBar3D(p);
  if (isCategorical(p.type)) return buildCategorical(p);
  return buildSeries(p);
}
