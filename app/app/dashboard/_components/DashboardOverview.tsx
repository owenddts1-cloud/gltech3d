"use client";

import { useMemo, useState } from "react";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell,
} from "recharts";
import { ChartLineUp, ClipboardText, Cube, Users, Clock, CaretUp, CaretDown, TrendUp } from "@/lib/ui/icons";
import type { DashboardOverview as TOverview } from "@/app/actions/dashboard/overview";
import { PerformanceCard } from "./PerformanceCard";
import { ActiveOrdersTable } from "./ActiveOrdersTable";
import { PendingTasks } from "./PendingTasks";

// ── Paleta local "Mesh" (navy/azul sóbrio, cards brancos) ──────────────────
const INK = "#1e293b";   // slate-800 — linha do gráfico
const BLUE = "#3b82f6";  // preenchimento gradiente + destaque
const DONUT = ["#3b82f6", "#94a3b8", "#cbd5e1"];
const STATUS = [
  { key: "orcamento", label: "Orçamentos", color: "#64748b" },
  { key: "aprovado", label: "Aprovadas", color: "#3b82f6" },
  { key: "em_producao", label: "Em produção", color: "#f59e0b" },
  { key: "concluido", label: "Concluídas", color: "#10b981" },
] as const;

const RANGES = [
  { key: "3M", months: 3 },
  { key: "6M", months: 6 },
  { key: "1A", months: 12 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)}min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`;
  return `há ${Math.floor(s / 86400)}d`;
}

type Tone = "up" | "down" | "warn" | "neutral";
function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const cls =
    tone === "up" ? "bg-emerald-500/10 text-emerald-600"
    : tone === "down" ? "bg-red-500/10 text-red-600"
    : tone === "warn" ? "bg-amber-500/10 text-amber-600"
    : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {tone === "up" && <CaretUp size={10} weight="bold" />}
      {tone === "down" && <CaretDown size={10} weight="bold" />}
      {children}
    </span>
  );
}

function EmptyChart({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">{text}</div>;
}

export function DashboardOverview({ data }: { data: TOverview }) {
  const [range, setRange] = useState<RangeKey>("6M");

  const k = data.kpis;
  const fatDelta = k.faturamentoPrevCents > 0
    ? Math.round(((k.faturamentoMesCents - k.faturamentoPrevCents) / k.faturamentoPrevCents) * 100)
    : k.faturamentoMesCents > 0 ? 100 : 0;

  // Chips de período funcionais: fatia os últimos N meses da série disponível.
  const series = useMemo(() => {
    const months = RANGES.find((r) => r.key === range)?.months ?? 6;
    return data.revenueSeries.slice(-months);
  }, [data.revenueSeries, range]);
  const revenueTotal = series.reduce((s, r) => s + r.cents, 0);
  const hasRevenue = series.some((r) => r.cents > 0);

  const spendingData = [
    { name: "Filamento", value: data.spending.filament },
    { name: "Energia", value: data.spending.energy },
    { name: "Depreciação", value: data.spending.depreciation },
  ].filter((d) => d.value > 0);
  const hasSpending = spendingData.length > 0;
  const osTotal = Object.values(data.osByStatus).reduce((a, b) => a + b, 0);

  const kpis: { label: string; value: string; icon: typeof ChartLineUp; badge: { tone: Tone; text: string }; sub: string }[] = [
    { label: "Faturamento (mês)", value: brl(k.faturamentoMesCents), icon: ChartLineUp,
      badge: { tone: fatDelta >= 0 ? "up" : "down", text: `${Math.abs(fatDelta)}%` }, sub: "vs mês anterior" },
    { label: "OS Ativas", value: String(k.osAtivas), icon: ClipboardText,
      badge: { tone: "neutral", text: `${data.osByStatus.em_producao} em produção` }, sub: "aguardando entrega" },
    { label: "Filamento (mês)", value: `${k.filamentoMesGramas} g`, icon: Cube,
      badge: k.lowStock > 0 ? { tone: "warn", text: `${k.lowStock} baixo` } : { tone: "up", text: "ok" }, sub: "consumido" },
    { label: "Clientes", value: String(k.clientes), icon: Users,
      badge: { tone: "neutral", text: "base" }, sub: "cadastrados" },
    { label: "Lucro estimado", value: brl(k.lucroEstimadoCents), icon: TrendUp,
      badge: k.lucroEstimadoCents > 0 ? { tone: "up", text: "positivo" } : { tone: "neutral", text: "—" }, sub: "faturamento − custos" },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Central de comando da GLTech3D — em tempo real.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Atualizado agora
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="group rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Icon size={16} weight="duotone" className="text-text-subtle" /> {kpi.label}
                </span>
                <Badge tone={kpi.badge.tone}>{kpi.badge.text}</Badge>
              </div>
              <div className="mt-3 text-[26px] font-bold leading-none tracking-tight text-text">{kpi.value}</div>
              <div className="mt-2 text-[11px] text-muted-foreground">{kpi.sub}</div>
            </div>
          );
        })}
      </div>

      {/* ── Faturamento (2/3) + Mini-calendário (1/3) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Faturamento</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-2xl font-bold tracking-tight text-text">{brl(revenueTotal)}</span>
                <Badge tone={fatDelta >= 0 ? "up" : "down"}>{Math.abs(fatDelta)}% mês</Badge>
              </div>
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    range === r.key ? "bg-surface text-text shadow-xs" : "text-muted-foreground hover:text-text"
                  }`}
                >
                  {r.key}
                </button>
              ))}
            </div>
          </div>
          <div className="h-52">
            {hasRevenue ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BLUE} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${Math.round(v / 100)}`} />
                  <Tooltip
                    cursor={{ stroke: "var(--color-border-strong)", strokeDasharray: "4 4" }}
                    contentStyle={{ background: "#0f172a", border: "none", borderRadius: 10, fontSize: 12, color: "#fff", boxShadow: "0 8px 24px -6px rgba(0,0,0,0.35)" }}
                    labelStyle={{ color: "#94a3b8", marginBottom: 2 }}
                    itemStyle={{ color: "#fff" }}
                    formatter={(v) => [brl(Number(v)), "Faturamento"]}
                  />
                  <Area type="monotone" dataKey="cents" stroke={INK} strokeWidth={2.5} fill="url(#rev)" dot={false} activeDot={{ r: 4, fill: INK, stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyChart text="Sem faturamento ainda — conclua uma OS para ver a curva." />}
          </div>
        </div>

        <PerformanceCard successRate={data.performance.successRate} goals={data.performance.goals} />
      </div>

      {/* ── Ordens ativas (2/3) + Tarefas pendentes (1/3) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActiveOrdersTable orders={data.activeOrders} />
        </div>
        <PendingTasks />
      </div>

      {/* ── Trio: OS por status + Anatomia do custo + Atividade recente ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text">Ordens por status</h2>
            <span className="text-xs text-muted-foreground">{osTotal} no total</span>
          </div>
          <div className="mb-4 flex h-2 overflow-hidden rounded-full bg-muted">
            {STATUS.map((s) => {
              const n = data.osByStatus[s.key];
              const w = osTotal > 0 ? (n / osTotal) * 100 : 0;
              return <span key={s.key} style={{ width: `${w}%`, backgroundColor: s.color }} />;
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {STATUS.map((s) => (
              <div key={s.key} className="rounded-xl border border-border bg-surface-elevated/40 p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} /> {s.label}
                </div>
                <div className="mt-1 text-xl font-bold text-text">{data.osByStatus[s.key]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-text">Anatomia do custo</h2>
          <div className="h-40">
            {hasSpending ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={spendingData} dataKey="value" nameKey="name" innerRadius={46} outerRadius={70} paddingAngle={3} stroke="none">
                    {spendingData.map((_, i) => <Cell key={i} fill={DONUT[i % DONUT.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "var(--color-text)" }} formatter={(v, n) => [brl(Math.round(Number(v) * 100)), String(n)]} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart text="Sem custos — dispare a telemetria em Impressoras." />}
          </div>
          {hasSpending && (
            <div className="mt-3 space-y-1.5">
              {spendingData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: DONUT[i % DONUT.length] }} />{d.name}</span>
                  <span className="tabular-nums font-medium text-text">{brl(Math.round(d.value * 100))}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
            <Clock size={16} className="text-muted-foreground" /> Atividade recente
          </h2>
          {data.feed.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma atividade ainda.</p>
          ) : (
            <ul className="space-y-3">
              {data.feed.slice(0, 6).map((f) => (
                <li key={f.id} className="flex items-center gap-3">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: f.kind === "job" ? BLUE : "#94a3b8" }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-text">{f.text}</div>
                    <div className="truncate text-xs text-muted-foreground">{f.sub}</div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(f.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
