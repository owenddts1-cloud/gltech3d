"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartLineUp, Printer, Receipt, Clock, Toolbox, CaretUp, CaretDown, FileText, Sparkle, ClipboardText,
} from "@/lib/ui/icons";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { toast } from "sonner";
import type { ReportsData } from "@/app/actions/reports/actions";

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

export function ReportsClient({ data }: { data: ReportsData }) {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [activeTab, setActiveTab] = useState<"revenue" | "sources">("revenue");
  // Recharts mede 0×0 no SSR; só renderiza os gráficos após montar no cliente.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  function exportCsv() {
    const header = "Mes,Faturamento (R$),Filamento (g),Horas ativas,Jobs";
    const rows = data.monthly.map(
      (m) => `${m.month},${(m.revenueCents / 100).toFixed(2)},${m.filamentGrams},${m.activeHours},${m.jobs}`,
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-gltech3d-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado em CSV.");
  }

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
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 rounded-lg font-semibold text-xs border-border bg-surface hover:bg-muted"
              onClick={exportCsv}
            >
              <FileText size={14} />
              <span>Exportar CSV</span>
            </Button>
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
        <Card className="lg:col-span-2 p-5 rounded-xl border border-border bg-surface flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-sm font-bold text-foreground">Desempenho Comercial</h2>
                <p className="text-[11px] text-muted-foreground">Faturamento mensal (12 meses) e origem dos contatos</p>
              </div>
              <div className="flex rounded-lg bg-muted p-1 border w-fit">
                <button onClick={() => setActiveTab("revenue")}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeTab === "revenue" ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}>
                  Evolução Mensal
                </button>
                <button onClick={() => setActiveTab("sources")}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeTab === "sources" ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}>
                  Origem de Contatos
                </button>
              </div>
            </div>

            <div className="h-[270px] w-full mt-4">
              {!mounted ? (
                <div className="h-full w-full animate-pulse rounded-lg bg-muted/40" />
              ) : activeTab === "revenue" ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.monthly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} className="fill-muted-foreground text-[10px] font-semibold" />
                    <YAxis tickLine={false} axisLine={false} className="fill-muted-foreground text-[10px] font-semibold" tickFormatter={(v) => `R$${Math.round(v / 100)}`} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length && payload[0]) {
                          const d = payload[0].payload as ReportsData["monthly"][number];
                          return (
                            <div className="rounded-lg border border-border bg-surface p-2.5 shadow-md text-xs">
                              <p className="font-bold text-foreground">{d.month}</p>
                              <p className="text-muted-foreground mt-0.5">Faturamento: <span className="font-bold text-foreground">{brl(d.revenueCents)}</span></p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{d.jobs} jobs · {d.activeHours}h</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="revenueCents" stroke="var(--color-accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : data.sources.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem contatos cadastrados ainda.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.sources} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} className="fill-muted-foreground text-[10px] font-semibold" />
                    <YAxis tickLine={false} axisLine={false} className="fill-muted-foreground text-[10px] font-semibold" allowDecimals={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length && payload[0]) {
                          const d = payload[0].payload as ReportsData["sources"][number];
                          return (
                            <div className="rounded-lg border border-border bg-surface p-2.5 shadow-md text-xs">
                              <p className="font-bold text-foreground">{d.name}</p>
                              <p className="text-muted-foreground mt-0.5">Contatos: <span className="font-bold text-foreground">{d.value}</span></p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {data.sources.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-3 border-t border-border/40 text-[10px] font-semibold text-muted-foreground">
            {activeTab === "revenue" ? (
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-accent" /><span>Faturamento mensal (OS concluídas)</span></div>
            ) : (
              data.sources.map((s, idx) => (
                <div key={idx} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} /><span>{s.name} ({s.value})</span></div>
              ))
            )}
          </div>
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
    </div>
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
