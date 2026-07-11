"use client";

import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartLineUp,
  Printer,
  Receipt,
  Clock,
  Toolbox,
  CaretUp,
  CaretDown,
  ArrowsClockwise,
  FileText,
  Sparkle,
} from "@/lib/ui/icons";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";
import { toast } from "sonner";

// Monthly cumulative revenue data
const MONTHLY_REVENUE_TREND = [
  { name: "Jan", receita: 8200, maquinas: 3 },
  { name: "Fev", receita: 9500, maquinas: 3 },
  { name: "Mar", receita: 11000, maquinas: 4 },
  { name: "Abr", receita: 10400, maquinas: 4 },
  { name: "Mai", receita: 12500, maquinas: 4 },
  { name: "Jun", receita: 13000, maquinas: 4 },
  { name: "Jul", receita: 14850, maquinas: 4 },
];

// Sales channels data
const CHANNEL_DATA = [
  { name: "Shopee", faturamento: 5400, pedidos: 120, color: "#F97316" },
  { name: "Mercado Livre", faturamento: 4200, pedidos: 85, color: "#EAB308" },
  { name: "WhatsApp / Direto", faturamento: 3800, pedidos: 64, color: "#10B981" },
  { name: "Instagram", faturamento: 1450, pedidos: 28, color: "#A855F7" },
];

// Printers efficiency log
const PRINTERS_EFFICIENCY = [
  { name: "Vortigon Core 300", jobs: 142, successRate: 98.5, activeHours: 420, status: "active", statusLabel: "Ativa" },
  { name: "Bambu Lab X1C", jobs: 198, successRate: 99.1, activeHours: 512, status: "active", statusLabel: "Ativa" },
  { name: "Creality K1 Max", jobs: 94, successRate: 94.6, activeHours: 248, status: "warning", statusLabel: "Manut. Pendente" },
  { name: "Ender 3 S1 Pro", jobs: 62, successRate: 91.2, activeHours: 102, status: "error", statusLabel: "Calibração" },
];

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState<"30d" | "3m" | "1y">("30d");
  const [activeTab, setActiveTab] = useState<"revenue" | "channels">("revenue");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleExport = (format: string) => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      toast.success(`Relatório exportado em formato ${format.toUpperCase()}!`);
    }, 1200);
  };

  const currentKPIs = useMemo(() => {
    if (period === "30d") {
      return {
        revenue: "R$ 14.850,00",
        revenueTrend: "+14.2%",
        revenueTrendUp: true,
        weight: "48.6 kg",
        weightTrend: "-3.1%",
        weightTrendUp: false,
        successRate: "96.5%",
        successTrend: "+1.2%",
        successTrendUp: true,
        hours: "1.280h",
        hoursTrend: "+8.5%",
        hoursTrendUp: true,
      };
    } else if (period === "3m") {
      return {
        revenue: "R$ 40.350,00",
        revenueTrend: "+18.5%",
        revenueTrendUp: true,
        weight: "135.2 kg",
        weightTrend: "+5.4%",
        weightTrendUp: true,
        successRate: "95.8%",
        successTrend: "+0.8%",
        successTrendUp: true,
        hours: "3.640h",
        hoursTrend: "+12.1%",
        hoursTrendUp: true,
      };
    } else {
      return {
        revenue: "R$ 79.450,00",
        revenueTrend: "+24.0%",
        revenueTrendUp: true,
        weight: "264.8 kg",
        weightTrend: "+15.2%",
        weightTrendUp: true,
        successRate: "96.1%",
        successTrend: "+1.5%",
        successTrendUp: true,
        hours: "7.120h",
        hoursTrend: "+19.4%",
        hoursTrendUp: true,
      };
    }
  }, [period]);

  if (!mounted) {
    return (
      <div className="space-y-6 p-6 mx-auto max-w-7xl">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-[350px] rounded-xl" />
          <Skeleton className="h-[350px] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 mx-auto max-w-7xl animate-in fade-in duration-300">
      {/* ─── Premium Header ─── */}
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
                Business Intelligence operacional: faturamento, canais de venda e telemetria da farm 3D.
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Period Selector Tabs */}
            <div className="flex rounded-lg bg-muted p-1 border">
              {(["30d", "3m", "1y"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                    period === p
                      ? "bg-surface text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p === "30d" ? "30 Dias" : p === "3m" ? "3 Meses" : "Anual"}
                </button>
              ))}
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              disabled={isExporting} 
              className="gap-1.5 h-9 rounded-lg font-semibold text-xs border-border bg-surface hover:bg-muted"
              onClick={() => handleExport("pdf")}
            >
              <FileText size={14} />
              <span>{isExporting ? "Exportando..." : "Exportar Relatório"}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Brisk-Style KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Revenue */}
        <Card className="p-5 rounded-xl border border-border bg-surface relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Faturamento</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Receipt size={15} weight="duotone" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-foreground tabular-nums">{currentKPIs.revenue}</span>
            <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold ${
              currentKPIs.revenueTrendUp 
                ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" 
                : "bg-rose-500/10 text-rose-600"
            }`}>
              {currentKPIs.revenueTrendUp ? <CaretUp size={10} /> : <CaretDown size={10} />}
              {currentKPIs.revenueTrend}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground block mt-1">Total recebido no período</span>
        </Card>

        {/* Card 2: Filament */}
        <Card className="p-5 rounded-xl border border-border bg-surface relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Filamento</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <Printer size={15} weight="duotone" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-foreground tabular-nums">{currentKPIs.weight}</span>
            <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold ${
              currentKPIs.weightTrendUp 
                ? "bg-emerald-500/10 text-emerald-600" 
                : "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
            }`}>
              {currentKPIs.weightTrendUp ? <CaretUp size={10} /> : <CaretDown size={10} />}
              {currentKPIs.weightTrend}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground block mt-1">consumo líquido estimado</span>
        </Card>

        {/* Card 3: Success Rate */}
        <Card className="p-5 rounded-xl border border-border bg-surface relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Taxa de Sucesso</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Sparkle size={15} weight="duotone" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-foreground tabular-nums">{currentKPIs.successRate}</span>
            <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <CaretUp size={10} />
              {currentKPIs.successTrend}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground block mt-1">jobs concluídos com sucesso</span>
        </Card>

        {/* Card 4: Active Hours */}
        <Card className="p-5 rounded-xl border border-border bg-surface relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Tempo Ativo</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock size={15} weight="duotone" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-foreground tabular-nums">{currentKPIs.hours}</span>
            <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <CaretUp size={10} />
              {currentKPIs.hoursTrend}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground block mt-1">horas combinadas de impressão</span>
        </Card>
      </div>

      {/* ─── Main Graphics & Actions Split ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart View Card */}
        <Card className="lg:col-span-2 p-5 rounded-xl border border-border bg-surface flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-sm font-bold text-foreground">Desempenho Comercial</h2>
                <p className="text-[11px] text-muted-foreground">Análise consolidada de faturamento e canais</p>
              </div>
              
              {/* Tab Selector */}
              <div className="flex rounded-lg bg-muted p-1 border w-fit">
                <button
                  onClick={() => setActiveTab("revenue")}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                    activeTab === "revenue"
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Evolução Mensal
                </button>
                <button
                  onClick={() => setActiveTab("channels")}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                    activeTab === "channels"
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Canais de Venda
                </button>
              </div>
            </div>

            {/* Rendering Active Tab Graphic */}
            <div className="h-[270px] w-full mt-4">
              {activeTab === "revenue" ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={MONTHLY_REVENUE_TREND} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} className="fill-muted-foreground text-[10px] font-semibold" />
                    <YAxis tickLine={false} axisLine={false} className="fill-muted-foreground text-[10px] font-semibold" tickFormatter={(val) => `R$${val}`} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length && payload[0]) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-border bg-surface p-2.5 shadow-md text-xs">
                              <p className="font-bold text-foreground">{data.name}</p>
                              <p className="text-muted-foreground mt-0.5">
                                Faturamento: <span className="font-bold text-foreground">R$ {data.receita.toLocaleString()}</span>
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Máquinas operando: <span className="font-semibold text-foreground">{data.maquinas}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="receita" stroke="var(--color-accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={CHANNEL_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} className="fill-muted-foreground text-[10px] font-semibold" />
                    <YAxis tickLine={false} axisLine={false} className="fill-muted-foreground text-[10px] font-semibold" tickFormatter={(val) => `R$${val}`} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length && payload[0]) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-border bg-surface p-2.5 shadow-md text-xs">
                              <p className="font-bold text-foreground">{data.name}</p>
                              <p className="text-muted-foreground mt-0.5">
                                Faturamento: <span className="font-bold text-foreground">R$ {data.faturamento.toLocaleString()}</span>
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Pedidos: <span className="font-semibold text-foreground">{data.pedidos}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="faturamento" radius={[6, 6, 0, 0]}>
                      {CHANNEL_DATA.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Graph Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-3 border-t border-border/40 text-[10px] font-semibold text-muted-foreground">
            {activeTab === "revenue" ? (
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                <span>Curva de Receita Acumulada</span>
              </div>
            ) : (
              CHANNEL_DATA.map((ch, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ch.color }} />
                  <span>{ch.name} (R$ {ch.faturamento})</span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* AI Actionable Insights Panel */}
        <Card className="p-5 rounded-xl border border-border bg-surface flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-foreground font-semibold">Decisões Recomendadas</h2>
                <p className="text-[11px] text-muted-foreground">Recomendações e ações imediatas geradas pela IA</p>
              </div>
              <Badge variant="default" className="text-[9px] font-bold bg-accent/15 text-accent border-accent/20">IA Ativa</Badge>
            </div>

            {/* List of Insights with interactive buttons linking actions */}
            <div className="space-y-4">
              {/* Insight 1 */}
              <div className="flex gap-3 items-start p-3 rounded-xl bg-amber-500/[0.04] border border-amber-500/10">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 mt-0.5">
                  <Toolbox size={14} />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Lubrificação Vortigon</h4>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      A impressora atingiu 420h ativas. Agende uma preventiva de eixos para evitar perda de passos.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[9px] font-bold rounded-md bg-surface hover:bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                    onClick={() => {
                      toast.success("Preventiva de lubrificação recomendada!");
                      window.location.href = "/app/calendar";
                    }}
                  >
                    Agendar no Calendário
                  </Button>
                </div>
              </div>

              {/* Insight 2 */}
              <div className="flex gap-3 items-start p-3 rounded-xl bg-orange-500/[0.04] border border-orange-500/10">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 mt-0.5">
                  <Printer size={14} />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Estoque PLA Grey Baixo</h4>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Consumo disparou 35% na Shopee. Estoque remanescente dura apenas 6 dias úteis.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[9px] font-bold rounded-md bg-surface hover:bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400"
                    onClick={() => {
                      toast.success("Redirecionando para cotações com parceiros.");
                      window.location.href = "/app/suppliers";
                    }}
                  >
                    Cotar com Fornecedores
                  </Button>
                </div>
              </div>

              {/* Insight 3 */}
              <div className="flex gap-3 items-start p-3 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/10">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5">
                  <ChartLineUp size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-foreground">Margem da Shopee</h4>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Volume recorde de chaveiros aumentou a eficiência média do peso bruto do fatiamento.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full mt-4 justify-center text-xs font-semibold hover:bg-muted border border-border/40"
            onClick={() => toast.info("Relatório de BI avançado em desenvolvimento...")}
          >
            Ver Histórico Completo
          </Button>
        </Card>
      </div>

      {/* ─── Printer Farm Performance Table ─── */}
      <Card className="p-5 rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-foreground font-semibold">Desempenho da Farm de Impressão</h2>
            <p className="text-[11px] text-muted-foreground">Telemetria de falhas, aproveitamento de filamento e horas ativas das máquinas</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full border hover:bg-muted"
            onClick={() => {
              toast.success("Telemetria das impressoras sincronizada!");
            }}
            title="Sincronizar telemetria"
          >
            <ArrowsClockwise size={15} />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground font-bold">
                <th className="py-3 px-3">Impressora</th>
                <th className="py-3 px-3">Jobs Executados</th>
                <th className="py-3 px-3">Taxa de Sucesso</th>
                <th className="py-3 px-3">Tempo Ativo (Mês)</th>
                <th className="py-3 px-3">Status Operacional</th>
              </tr>
            </thead>
            <tbody>
              {PRINTERS_EFFICIENCY.map((pr, idx) => (
                <tr key={idx} className="border-b border-border/40 hover:bg-muted/50 transition-colors">
                  <td className="py-3.5 px-3 font-semibold text-foreground flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground border">
                      <Printer size={14} />
                    </div>
                    <span>{pr.name}</span>
                  </td>
                  <td className="py-3.5 px-3 font-mono text-muted-foreground">{pr.jobs} peças</td>
                  <td className="py-3.5 px-3">
                    <div className="space-y-1 max-w-[120px]">
                      <div className="flex justify-between items-center text-[10px] font-bold text-foreground">
                        <span>{pr.successRate}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            pr.successRate >= 98 ? "bg-emerald-500" :
                            pr.successRate >= 94 ? "bg-amber-500" : "bg-rose-500"
                          }`}
                          style={{ width: `${pr.successRate}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 font-mono text-foreground font-semibold">{pr.activeHours} horas</td>
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        pr.status === "active" ? "bg-emerald-500 animate-pulse" :
                        pr.status === "warning" ? "bg-amber-500" : "bg-rose-500"
                      }`} />
                      <span className="font-semibold text-foreground text-[11px]">{pr.statusLabel}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
