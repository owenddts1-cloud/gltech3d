"use client";

import { useState, useMemo } from "react";
import {
  calculateRealtimeDRE,
  type FinancialTransactionItem,
  type FinancialChannel,
} from "@/lib/financial/dre-engine";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Layers,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
} from "lucide-react";

interface DreClientProps {
  initialTransactions: FinancialTransactionItem[];
}

export function DreClient({ initialTransactions }: DreClientProps) {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "all">("all");
  const [channel, setChannel] = useState<FinancialChannel>("all");

  const dre = useMemo(() => {
    return calculateRealtimeDRE(initialTransactions, {
      period,
      channel,
    });
  }, [initialTransactions, period, channel]);

  const formatBRL = (cents: number) => {
    return (cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const getPercent = (cents: number) => {
    if (!dre.grossRevenueCents) return "0.0%";
    const pct = (cents / dre.grossRevenueCents) * 100;
    return `${pct.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-emerald-500" />
            DRE Gerencial em Tempo Real
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Apuração contábil em cascata: Receita Bruta ➔ CPV Real (Bobinas + Farm) ➔ Margem ➔ Lucro Operacional
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border/50 text-xs">
            <span className="text-muted-foreground px-2 font-medium flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Período:
            </span>
            {(
              [
                ["daily", "Hoje"],
                ["weekly", "Semana"],
                ["monthly", "Mês"],
                ["all", "Todos"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setPeriod(val)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  period === val
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border/50 text-xs">
            <span className="text-muted-foreground px-2 font-medium">Canal:</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as FinancialChannel)}
              className="bg-transparent text-foreground font-medium text-xs focus:outline-none cursor-pointer pr-2"
            >
              <option value="all">Todos os Canais</option>
              <option value="site_filaments">Loja de Filamentos</option>
              <option value="demand_printing">Impressão 3D sob Demanda</option>
              <option value="whatsapp">Vendas WhatsApp</option>
              <option value="manual">Manual / Oficina</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Receita Bruta */}
        <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
            <span>Receita Bruta</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-foreground">
            {formatBRL(dre.grossRevenueCents)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {dre.transactionCount} lançamento(s)
          </p>
        </div>

        {/* CPV Direto */}
        <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
            <span>CPV / Custos Diretos</span>
            <Package className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-500">
            {formatBRL(dre.totalCPVCents)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Filamentos + Energia da Farm
          </p>
        </div>

        {/* Margem de Contribuição */}
        <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
            <span>Margem de Contribuição</span>
            <Layers className="h-4 w-4 text-sky-500" />
          </div>
          <div className="text-xl font-bold text-sky-500">
            {formatBRL(dre.contributionMarginCents)}
          </div>
          <p className="text-[11px] text-sky-600 dark:text-sky-400 font-medium mt-1">
            {dre.contributionMarginPct}% da receita
          </p>
        </div>

        {/* Custos Fixos */}
        <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
            <span>Custos Fixos</span>
            <ArrowDownRight className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-foreground">
            {formatBRL(dre.fixedExpensesCents)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Despesas operacionais
          </p>
        </div>

        {/* Lucro Líquido Operacional */}
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
            <span>Lucro Líquido Operacional</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatBRL(dre.netOperatingProfitCents)}
          </div>
          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 font-medium mt-1">
            {dre.netMarginPct}% margem líquida
          </p>
        </div>
      </div>

      {/* Cascading DRE Statement Table */}
      <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/20">
          <h2 className="text-sm font-semibold text-foreground tracking-tight">
            Demonstrativo de Resultado do Exercício
          </h2>
          <p className="text-xs text-muted-foreground">
            Detalhamento das contas do período selecionado
          </p>
        </div>

        <div className="divide-y divide-border/30 text-sm">
          {/* (+) Receita Bruta */}
          <div className="flex items-center justify-between px-5 py-3 hover:bg-muted/10 font-medium">
            <span className="flex items-center gap-2">
              <span className="text-emerald-500 font-bold">(+)</span> Receita Bruta de Vendas & Impressão
            </span>
            <div className="flex items-center gap-6">
              <span className="w-16 text-right text-xs text-muted-foreground">100.0%</span>
              <span className="w-28 text-right font-semibold text-foreground">
                {formatBRL(dre.grossRevenueCents)}
              </span>
            </div>
          </div>

          {/* (-) Taxas e Comissões */}
          <div className="flex items-center justify-between px-5 py-3 hover:bg-muted/10 text-muted-foreground pl-8">
            <span className="flex items-center gap-2">
              <span className="text-rose-500">(-)</span> Taxas de Meios de Pagamento & Gateway
            </span>
            <div className="flex items-center gap-6">
              <span className="w-16 text-right text-xs">{getPercent(dre.platformFeesCents)}</span>
              <span className="w-28 text-right text-rose-500">
                - {formatBRL(dre.platformFeesCents)}
              </span>
            </div>
          </div>

          {/* (=) Receita Líquida */}
          <div className="flex items-center justify-between px-5 py-3 bg-muted/20 font-semibold text-foreground">
            <span className="flex items-center gap-2">
              <span className="text-sky-500">(=)</span> Receita Líquida
            </span>
            <div className="flex items-center gap-6">
              <span className="w-16 text-right text-xs text-muted-foreground">{getPercent(dre.netRevenueCents)}</span>
              <span className="w-28 text-right">{formatBRL(dre.netRevenueCents)}</span>
            </div>
          </div>

          {/* (-) Custos Diretos de Filamento */}
          <div className="flex items-center justify-between px-5 py-3 hover:bg-muted/10 text-muted-foreground pl-8">
            <span className="flex items-center gap-2">
              <span className="text-amber-500">(-)</span> Custo Direto de Filamentos (Massa $g$ Consumida)
            </span>
            <div className="flex items-center gap-6">
              <span className="w-16 text-right text-xs">{getPercent(dre.filamentDirectCostCents)}</span>
              <span className="w-28 text-right text-amber-500">
                - {formatBRL(dre.filamentDirectCostCents)}
              </span>
            </div>
          </div>

          {/* (-) Custos Diretos de Máquina */}
          <div className="flex items-center justify-between px-5 py-3 hover:bg-muted/10 text-muted-foreground pl-8">
            <span className="flex items-center gap-2">
              <span className="text-amber-500">(-)</span> Custo Direto de Máquina (kWh + Depreciação)
            </span>
            <div className="flex items-center gap-6">
              <span className="w-16 text-right text-xs">{getPercent(dre.machineDirectCostCents)}</span>
              <span className="w-28 text-right text-amber-500">
                - {formatBRL(dre.machineDirectCostCents)}
              </span>
            </div>
          </div>

          {/* (=) Margem de Contribuição */}
          <div className="flex items-center justify-between px-5 py-3 bg-sky-500/10 font-bold text-sky-600 dark:text-sky-400">
            <span className="flex items-center gap-2">
              <span>(=)</span> Margem de Contribuição Bruta
            </span>
            <div className="flex items-center gap-6">
              <span className="w-16 text-right text-xs">{dre.contributionMarginPct}%</span>
              <span className="w-28 text-right">{formatBRL(dre.contributionMarginCents)}</span>
            </div>
          </div>

          {/* (-) Despesas Fixas */}
          <div className="flex items-center justify-between px-5 py-3 hover:bg-muted/10 text-muted-foreground pl-8">
            <span className="flex items-center gap-2">
              <span className="text-rose-500">(-)</span> Despesas Fixas, Aluguel & Administrativo
            </span>
            <div className="flex items-center gap-6">
              <span className="w-16 text-right text-xs">{getPercent(dre.fixedExpensesCents)}</span>
              <span className="w-28 text-right text-rose-500">
                - {formatBRL(dre.fixedExpensesCents)}
              </span>
            </div>
          </div>

          {/* (=) Lucro Líquido Operacional */}
          <div className="flex items-center justify-between px-5 py-4 bg-emerald-500/15 font-bold text-emerald-600 dark:text-emerald-400 text-base">
            <span className="flex items-center gap-2">
              <span>(=)</span> Lucro Líquido Operacional
            </span>
            <div className="flex items-center gap-6">
              <span className="w-16 text-right text-xs">{dre.netMarginPct}%</span>
              <span className="w-28 text-right">{formatBRL(dre.netOperatingProfitCents)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
