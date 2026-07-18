"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartLineUp, Printer, Receipt, Clock, Toolbox, CaretUp, CaretDown, FileText, Sparkle, ClipboardText,
} from "@/lib/ui/icons";
import { FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import type { ReportsData } from "@/app/actions/reports/actions";
import type { ReportBreakdowns, Breakdown } from "@/app/actions/reports/types";
import { DynamicChart } from "@/components/charts/DynamicChart";
import { ChartDrilldownSheet, type DrilldownRow } from "@/components/charts/ChartDrilldownSheet";
import { exportReportsCSV, exportReportsXLSX, exportReportsPDF, type ReportsExportPayload } from "../_lib/export";

const PERIODS = [
  { key: "30d", label: "30 Dias", months: 1 },
  { key: "3m", label: "3 Meses", months: 3 },
  { key: "1y", label: "Anual", months: 12 },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

function windowSums(monthly: ReportsData["monthly"], months: number, offset = 0) {
  const end = monthly.length - offset;
  const slice = monthly.slice(Math.max(0, end - months), end);
  return {
    revenueCents: slice.reduce((s, m) => s + m.revenueCents, 0),
    filamentGrams: slice.reduce((s, m) => s + m.filamentGrams, 0),
    activeHours: slice.reduce((s, m) => s + m.activeHours, 0),
    jobs: slice.reduce((s, m) => s + m.jobs, 0),
  };
}

function trendPct(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

function TrendPill({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">—</span>;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold ${
      up ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
         : "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
    }`}>
      {up ? <CaretUp size={10} /> : <CaretDown size={10} />}
      {Math.abs(pct)}%
    </span>
  );
}

export function ReportsClient({ data, breakdowns }: { data: ReportsData; breakdowns: ReportBreakdowns }) {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  // Drill-down: linhas por trás da fatia clicada.
  const [drill, setDrill] = useState<{ title: string; rows: DrilldownRow[] } | null>(null);

  const months = PERIODS.find((p) => p.key === period)?.months ?? 1;

  const kpis = useMemo(() => {
    const cur = windowSums(data.monthly, months);
    const prev = windowSums(data.monthly, months, months);
    const enoughForTrend = data.monthly.length >= months * 2;
    return {
      revenue: cur.revenueCents,
      revenueTrend: enoughForTrend ? trendPct(cur.revenueCents, prev.revenueCents) : null,
      filamentKg: cur.filamentGrams / 1000,
      filamentTrend: enoughForTrend ? trendPct(cur.filamentGrams, prev.filamentGrams) : null,
      hours: cur.activeHours,
      hoursTrend: enoughForTrend ? trendPct(cur.activeHours, prev.activeHours) : null,
      jobs: cur.jobs,
    };
  }, [data.monthly, months]);

  const completion = data.osTotal > 0 ? Math.round((data.osConcluidas / data.osTotal) * 100) : 0;

  // Faturamento mensal como série (para o gráfico dinâmico troca de tipo/animação).
  const monthlySeries = useMemo(
    () => data.monthly.map((m) => ({ label: m.month, Faturamento: m.revenueCents })),
    [data.monthly],
  );

  const exportPayload = useMemo<ReportsExportPayload>(() => ({
    periodLabel: PERIODS.find((p) => p.key === period)?.label ?? "",
    kpis: [
      { label: "Faturamento", value: brl(kpis.revenue) },
      { label: "Filamento", value: `${kpis.filamentKg.toFixed(1)} kg` },
      { label: "OS Concluídas", value: `${completion}%` },
      { label: "Tempo Ativo", value: `${kpis.hours}h` },
    ],
    monthly: data.monthly,
    breakdowns: [breakdowns.client, breakdowns.category, breakdowns.project, breakdowns.platform]
      .map((b) => ({ title: b.title, isCurrency: b.isCurrency, groups: b.groups })),
  }), [period, kpis, completion, data.monthly, breakdowns]);

  async function handleExport(format: "csv" | "xlsx" | "pdf") {
    try {
      if (format === "csv") { exportReportsCSV(exportPayload); toast.success("Relatório exportado em CSV."); }
      else if (format === "xlsx") { await exportReportsXLSX(exportPayload); toast.success("Planilha XLSX exportada."); }
      else { await exportReportsPDF(exportPayload); toast.success("PDF gerado."); }
    } catch (err) {
      toast.error("Erro ao exportar: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  // Abre o painel de detalhamento com as linhas do grupo clicado.
  function openDrill(b: Breakdown, label: string) {
    const rows = b.drill[label] ?? [];
    setDrill({ title: `${b.title} · ${label}`, rows });
  }

  const drillValueFmt = (v: number) => brl(v);

  return (
    <div className="space-y-6 p-6 mx-auto max-w-7xl animate-in fade-in duration-300">
      {/* Header */}
      <header className="relative overflow-hidden rounded-xl border border-border bg-surface p-6">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-24" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent border border-accent/20 shadow-sm">
              <ChartLineUp size={26} weight="duotone" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Relatórios Analíticos</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Business Intelligence operacional — dados reais de OS, telemetria 3D e origem de contatos.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-muted p-1 border">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    period === p.key ? "bg-surface text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}
                className="gap-1.5 h-9 rounded-lg font-semibold text-xs border-border bg-surface hover:bg-muted">
                <FileText size={14} className="text-red-500" /> <span>Imprimir PDF</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("xlsx")}
                className="gap-1.5 h-9 rounded-lg font-semibold text-xs border-border bg-surface hover:bg-muted">
                <FileSpreadsheet size={14} className="text-emerald-600" /> <span>Planilha</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("csv")}
                className="gap-1.5 h-9 rounded-lg font-semibold text-xs border-border bg-surface hover:bg-muted">
                <Download size={14} className="text-blue-500" /> <span>CSV</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Faturamento" icon={Receipt} iconCls="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          value={brl(kpis.revenue)} pill={<TrendPill pct={kpis.revenueTrend} />} sub="OS concluídas no período" />
        <KpiCard label="Filamento" icon={Printer} iconCls="bg-orange-500/10 text-orange-600 dark:text-orange-400"
          value={`${kpis.filamentKg.toFixed(1)} kg`} pill={<TrendPill pct={kpis.filamentTrend} />} sub="consumo por telemetria" />
        <KpiCard label="OS Concluídas" icon={ClipboardText} iconCls="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
          value={`${completion}%`} pill={<span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">{data.osConcluidas}/{data.osTotal}</span>}
          sub="do total de ordens" />
        <KpiCard label="Tempo Ativo" icon={Clock} iconCls="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          value={`${kpis.hours}h`} pill={<TrendPill pct={kpis.hoursTrend} />} sub={`${kpis.jobs} jobs no período`} />
      </div>

      {/* Chart + insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5 rounded-xl border border-border bg-surface">
          <div className="mb-2">
            <h2 className="text-sm font-bold text-foreground">Desempenho Comercial</h2>
            <p className="text-[11px] text-muted-foreground">Faturamento mensal (12 meses) — troque o tipo de gráfico no seletor</p>
          </div>
          <DynamicChart
            data={monthlySeries}
            series={[{ key: "Faturamento", name: "Faturamento" }]}
            categoryKey="label"
            type="area"
            height={270}
            valueFormat={(v) => brl(v)}
            showBarLabels
          />
        </Card>

        {/* Insights (reais) */}
        <Card className="p-5 rounded-xl border border-border bg-surface flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-foreground">Decisões Recomendadas</h2>
                <p className="text-[11px] text-muted-foreground">Geradas de thresholds reais do seu operacional</p>
              </div>
              <Badge variant="default" className="text-[9px] font-bold bg-accent/15 text-accent border-accent/20">Automático</Badge>
            </div>

            <div className="space-y-4">
              {data.insights.map((ins) => {
                const tone = ins.tone === "warn"
                  ? { wrap: "bg-amber-500/[0.04] border-amber-500/10", icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400", Icon: Toolbox, btn: "hover:bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400" }
                  : ins.tone === "success"
                  ? { wrap: "bg-emerald-500/[0.04] border-emerald-500/10", icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", Icon: ChartLineUp, btn: "hover:bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" }
                  : { wrap: "bg-cyan-500/[0.04] border-cyan-500/10", icon: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400", Icon: Sparkle, btn: "hover:bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400" };
                const Icon = tone.Icon;
                return (
                  <div key={ins.id} className={`flex gap-3 items-start p-3 rounded-xl border ${tone.wrap}`}>
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5 ${tone.icon}`}>
                      <Icon size={14} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{ins.title}</h4>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{ins.text}</p>
                      </div>
                      {ins.href && ins.cta && (
                        <Button variant="outline" size="sm"
                          className={`h-6 px-2 text-[9px] font-bold rounded-md bg-surface ${tone.btn}`}
                          onClick={() => { window.location.href = ins.href!; }}>
                          {ins.cta}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Detalhamento — clique numa fatia para abrir o drill-down */}
      <div>
        <div className="mb-3">
          <h2 className="text-sm font-bold text-foreground">Detalhamento (drill-down)</h2>
          <p className="text-[11px] text-muted-foreground">
            Clique numa fatia/barra para ver os lançamentos por trás. Troque o tipo de gráfico no seletor de cada painel.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BreakdownPanel b={breakdowns.category} onDrill={openDrill} />
          <BreakdownPanel b={breakdowns.client} onDrill={openDrill} />
          <BreakdownPanel b={breakdowns.platform} onDrill={openDrill} />
          <BreakdownPanel b={breakdowns.project} onDrill={openDrill} />
        </div>
      </div>

      {/* Printer farm — real */}
      <Card className="p-5 rounded-xl border border-border bg-surface">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-foreground">Desempenho da Farm de Impressão</h2>
          <p className="text-[11px] text-muted-foreground">Jobs executados e horas ativas por máquina (telemetria real)</p>
        </div>

        {data.printers.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma impressora cadastrada — adicione em Impressoras.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-bold">
                  <th className="py-3 px-3">Impressora</th>
                  <th className="py-3 px-3">Jobs Executados</th>
                  <th className="py-3 px-3">Tempo Ativo (Total)</th>
                  <th className="py-3 px-3">Status Operacional</th>
                </tr>
              </thead>
              <tbody>
                {data.printers.map((pr, idx) => (
                  <tr key={idx} className="border-b border-border/40 hover:bg-muted/50 transition-colors">
                    <td className="py-3.5 px-3 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground border">
                          <Printer size={14} />
                        </div>
                        <span>{pr.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-muted-foreground">{pr.jobs} peças</td>
                    <td className="py-3.5 px-3 font-mono text-foreground font-semibold">{pr.activeHours} horas</td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 rounded-full ${
                          pr.status === "printing" ? "bg-orange-500 animate-pulse" :
                          pr.status === "error" ? "bg-rose-500" :
                          pr.status === "offline" ? "bg-zinc-400" : "bg-emerald-500"
                        }`} />
                        <span className="font-semibold text-foreground text-[11px]">{pr.statusLabel}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Painel de drill-down */}
      <ChartDrilldownSheet
        open={!!drill}
        onOpenChange={(v) => { if (!v) setDrill(null); }}
        title={drill?.title ?? ""}
        rows={drill?.rows ?? []}
        valueFormat={drillValueFmt}
      />
    </div>
  );
}

/** Card de breakdown: gráfico categórico dinâmico + drill-down ao clicar. */
function BreakdownPanel({ b, onDrill }: { b: Breakdown; onDrill: (b: Breakdown, label: string) => void }) {
  const brlLocal = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);
  return (
    <Card className="p-5 rounded-xl border border-border bg-surface">
      <div className="mb-2">
        <h3 className="text-sm font-bold text-foreground">{b.title}</h3>
        <p className="text-[11px] text-muted-foreground">{b.groups.length} grupo(s) · clique numa fatia para detalhar</p>
      </div>
      <DynamicChart
        data={b.groups.slice(0, 12)}
        nameKey="name"
        valueKey="value"
        valueLabel={b.title}
        type="donut"
        height={260}
        valueFormat={b.isCurrency ? brlLocal : (v) => v.toLocaleString("pt-BR")}
        onDrill={(info) => onDrill(b, info.label)}
        emptyText="Sem dados neste grupo."
      />
    </Card>
  );
}

function KpiCard({
  label, icon: Icon, iconCls, value, pill, sub,
}: {
  label: string; icon: typeof Receipt; iconCls: string; value: string; pill: React.ReactNode; sub: string;
}) {
  return (
    <Card className="p-5 rounded-xl border border-border bg-surface relative overflow-hidden flex flex-col justify-between">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconCls}`}>
          <Icon size={15} weight="duotone" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-extrabold text-foreground tabular-nums">{value}</span>
        {pill}
      </div>
      <span className="text-[10px] text-muted-foreground block mt-1">{sub}</span>
    </Card>
  );
}
