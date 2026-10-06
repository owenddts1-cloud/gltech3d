"use client";

import { useMemo, useState, useEffect } from "react";
import { type FinancialRecord } from "@/app/actions/control/actions";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, BarChart,
  type TooltipValueType
} from "recharts";
import { Wallet, TrendingUp, TrendingDown, Filter, Calendar, Layers, Tag, RotateCcw } from "lucide-react";
import {
  MONTH_ORDER, computeTotals, computeMonthlyData,
  computeExpenseCategories, computeRevenueCategories
} from "../_lib/aggregate";
import { CHART, CARD, tooltipStyle, tooltipLabelStyle, tooltipCursorFill } from "@/lib/ui/chart-theme";

interface ControlDashboardProps {
  records: FinancialRecord[];
}

export function ControlDashboard({ records }: ControlDashboardProps) {
  // Filter States
  const [selectedYear, setSelectedYear] = useState<string>("Todos");
  const [selectedMonth, setSelectedMonth] = useState<string>("Todos");
  const [selectedType, setSelectedType] = useState<string>("Todos");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [selectedProduct, setSelectedProduct] = useState<string>("Todos");

  // Helper to extract year from date formats (ISO or Brazilian DD/MM/YYYY)
  const getYearFromDate = (dateStr: string) => {
    if (!dateStr) return null;
    if (dateStr.includes("-")) {
      return dateStr.split("-")[0]; // YYYY-MM-DD -> YYYY
    }
    if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      if (parts[2]) {
        return parts[2].trim(); // DD/MM/YYYY -> YYYY
      }
    }
    return null;
  };

  // Dynamic filter options generated from input records
  const years = useMemo(() => {
    const list = new Set<string>();
    records.forEach(r => {
      const y = getYearFromDate(r.date);
      if (y) list.add(y);
    });
    return Array.from(list).sort();
  }, [records]);

  const categories = useMemo(() => {
    const list = new Set<string>();
    records.forEach(r => {
      if (r.category) list.add(r.category);
    });
    return Array.from(list).sort();
  }, [records]);

  const products = useMemo(() => {
    const list = new Set<string>();
    records.forEach(r => {
      if (r.description) list.add(r.description);
    });
    return Array.from(list).sort();
  }, [records]);

  // Months available for the selected year (dynamic update)
  const availableMonths = useMemo(() => {
    const list = new Set<string>();
    records.forEach(r => {
      const y = getYearFromDate(r.date);
      if (selectedYear === "Todos" || y === selectedYear) {
        if (r.month) list.add(r.month);
      }
    });
    return Array.from(list).sort((a, b) => {
      const idxA = MONTH_ORDER.indexOf(a);
      const idxB = MONTH_ORDER.indexOf(b);
      return idxA - idxB;
    });
  }, [records, selectedYear]);

  // Adjust month selection if it becomes unavailable in newly selected year
  useEffect(() => {
    if (selectedMonth !== "Todos" && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth("Todos");
    }
  }, [selectedYear, availableMonths, selectedMonth]);

  // Filtered records based on selection
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (selectedYear !== "Todos") {
        const y = getYearFromDate(r.date);
        if (y !== selectedYear) return false;
      }
      if (selectedMonth !== "Todos" && r.month !== selectedMonth) {
        return false;
      }
      if (selectedType !== "Todos") {
        if (selectedType === "Receitas" && r.type !== "Receita") return false;
        if (selectedType === "Despesas" && r.type !== "Despesa") return false;
      }
      if (selectedCategory !== "Todas" && r.category !== selectedCategory) {
        return false;
      }
      if (selectedProduct !== "Todos" && r.description !== selectedProduct) {
        return false;
      }
      return true;
    });
  }, [records, selectedYear, selectedMonth, selectedType, selectedCategory, selectedProduct]);

  // Aggregations live in _lib/aggregate.ts as pure functions so they can be unit-tested.
  const { totalRevenue, totalExpense, balance } = useMemo(
    () => computeTotals(filteredRecords), [filteredRecords]);
  const monthlyData = useMemo(() => computeMonthlyData(filteredRecords), [filteredRecords]);
  const expenseCategories = useMemo(() => computeExpenseCategories(filteredRecords), [filteredRecords]);
  const revenueCategories = useMemo(() => computeRevenueCategories(filteredRecords), [filteredRecords]);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  // Eixos e grid saem do tema: viram atributo de texto/stroke, onde var() resolve.
  const chartGridColor = "var(--color-border)";
  const chartTextColor = "var(--color-text-muted-foreground)";

  return (
    <div className="p-6 space-y-5 min-h-full">
      
      {/* Filter Toolbar */}
      <div className={`${CARD} flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-muted-foreground font-bold text-xs uppercase tracking-wider pr-3 border-r border-border">
            <Filter size={14} className="text-blue-500" />
            <span>Filtros</span>
          </div>

          {/* Year Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 select-none">
              <Calendar size={10} />
              Ano
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-surface-elevated border border-border rounded-md px-2.5 py-1 text-xs text-text focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="Todos">Todos os Anos</option>
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 select-none">
              <Calendar size={10} />
              Mês
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-surface-elevated border border-border rounded-md px-2.5 py-1 text-xs text-text focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="Todos">Todos os Meses</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 select-none">
              <Layers size={10} />
              Fluxo
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-surface-elevated border border-border rounded-md px-2.5 py-1 text-xs text-text focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="Todos">Receitas & Despesas</option>
              <option value="Receitas">Apenas Receitas</option>
              <option value="Despesas">Apenas Despesas</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 select-none">
              <Tag size={10} />
              Categoria
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-surface-elevated border border-border rounded-md px-2.5 py-1 text-xs text-text focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[160px] truncate"
            >
              <option value="Todas">Todas as Categorias</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Product/Description Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 select-none">
              <Tag size={10} />
              Produto / Descrição
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="bg-surface-elevated border border-border rounded-md px-2.5 py-1 text-xs text-text focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[180px] truncate"
            >
              <option value="Todos">Todos os Itens</option>
              {products.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters Button */}
        {(selectedYear !== "Todos" || selectedMonth !== "Todos" || selectedType !== "Todos" || selectedCategory !== "Todas" || selectedProduct !== "Todos") && (
          <button
            onClick={() => {
              setSelectedYear("Todos");
              setSelectedMonth("Todos");
              setSelectedType("Todos");
              setSelectedCategory("Todas");
              setSelectedProduct("Todos");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated text-text hover:border-border-strong text-xs font-semibold transition-all border border-border shadow-xs"
          >
            <RotateCcw size={12} />
            <span>Limpar Filtros</span>
          </button>
        )}
      </div>
      
      {/* Overview Cards — mesmo desenho do KPI do dashboard principal. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {([
          { label: "Despesas Totais", value: totalExpense, sub: "Fluxo de caixa de saída",
            icon: TrendingDown, tone: "text-red-600" },
          { label: "Receitas Totais", value: totalRevenue, sub: "Entradas operacionais",
            icon: TrendingUp, tone: "text-emerald-600" },
          { label: "Saldo Líquido", value: balance, sub: "Resultado acumulado",
            icon: Wallet, tone: balance >= 0 ? "text-emerald-600" : "text-red-600" },
        ] as const).map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="group rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Icon size={16} className="text-text-subtle" /> {card.label}
                </span>
              </div>
              <div className={`mt-3 text-[26px] font-bold leading-none tracking-tight tabular-nums ${card.tone}`}>
                {formatBRL(card.value)}
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">{card.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Balance Progression Chart (Análise de Saldo) */}
        <div className={`${CARD} flex flex-col h-96`}>
          <div className="flex items-center justify-between border-b border-border pb-2 mb-4 shrink-0">
            <h2 className="text-sm font-semibold text-text">Progresso do Saldo</h2>
            <span className="text-xs text-muted-foreground">Saldo Mensal vs Acumulado</span>
          </div>
          <div className="flex-1 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={chartGridColor} vertical={false} />
                <XAxis dataKey="month" stroke={chartTextColor} fontSize={10} />
                <YAxis stroke={chartTextColor} fontSize={10} tickFormatter={(v) => `R$ ${v}`}>
                </YAxis>
                <Tooltip
                  cursor={{ fill: tooltipCursorFill }}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(val: TooltipValueType | undefined) => [formatBRL(Number(val))]}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Saldo Mês" name="Saldo no Mês" fill={CHART.blue} maxBarSize={32} radius={[4, 4, 0, 0]} opacity={0.8} />
                <Line type="monotone" dataKey="Saldo Acumulado" name="Saldo Acumulado" stroke={CHART.ink} strokeWidth={3} dot={{ r: 4, fill: CHART.ink }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue x Expenses Chart */}
        <div className={`${CARD} flex flex-col h-96`}>
          <div className="flex items-center justify-between border-b border-border pb-2 mb-4 shrink-0">
            <h2 className="text-sm font-semibold text-text">Receitas x Despesas</h2>
            <span className="text-xs text-muted-foreground">Comparativo Mensal</span>
          </div>
          <div className="flex-1 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={chartGridColor} vertical={false} />
                <XAxis dataKey="month" stroke={chartTextColor} fontSize={10} />
                <YAxis stroke={chartTextColor} fontSize={10} tickFormatter={(v) => `R$ ${v}`}>
                </YAxis>
                <Tooltip
                  cursor={{ fill: tooltipCursorFill }}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(val: TooltipValueType | undefined) => [formatBRL(Number(val))]}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Receita" fill={CHART.emerald} radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Bar dataKey="Despesa" fill={CHART.red} radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Categories Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Distribuição por categoria.
            Barra ranqueada, não rosca: o leitor quer saber QUAL categoria pesa mais — isso é
            comparação de magnitude, e ângulo é o pior canal para isso. Com poucas categorias a
            rosca vira literalmente uma pizza de 2 fatias. Uma barra por categoria, um hue só
            (a categoria já é nomeada no rótulo — cor não precisa carregar identidade). */}
        <CategoryBreakdown
          title="Distribuição de Despesas"
          items={expenseCategories}
          total={totalExpense}
          barClass="bg-red-500/70"
          emptyText="Nenhuma despesa registrada."
          formatBRL={formatBRL}
        />
        <CategoryBreakdown
          title="Distribuição de Receitas"
          items={revenueCategories}
          total={totalRevenue}
          barClass="bg-emerald-500/70"
          emptyText="Nenhuma receita registrada."
          formatBRL={formatBRL}
        />
      </div>

    </div>
  );
}

/**
 * Categorias ordenadas por valor, com barra de proporção. Substituiu a rosca: para "qual
 * categoria pesa mais" a barra é a forma certa, e o valor fica sempre legível como texto —
 * nunca só na cor ou no tooltip.
 */
function CategoryBreakdown({
  title, items, total, barClass, emptyText, formatBRL,
}: {
  title: string;
  items: { name: string; value: number }[];
  total: number;
  barClass: string;
  emptyText: string;
  formatBRL: (v: number) => string;
}) {
  return (
    <div className={`${CARD} flex flex-col`}>
      <div className="flex items-center justify-between border-b border-border pb-2 mb-3 shrink-0">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        <span className="text-xs text-muted-foreground">Por Categoria</span>
      </div>
      {items.length === 0 ? (
        <p className="py-12 text-center text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          <div className="mb-3 text-xl font-bold tabular-nums text-text">{formatBRL(total)}</div>
          <ul className="space-y-3 overflow-y-auto">
            {items.map((item) => {
              const pct = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <li key={item.name}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-muted-foreground" title={item.name}>{item.name}</span>
                    <span className="shrink-0 tabular-nums font-medium text-text">
                      {formatBRL(item.value)}
                      <span className="ml-1.5 font-normal text-muted-foreground">{pct.toFixed(1)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
                    <span className={`block h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
