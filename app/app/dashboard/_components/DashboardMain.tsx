'use client';

import { useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  // Ícones canônicos Phosphor (ADR-05) — consistente com o resto do CRM.
  // Aliases mantêm os nomes usados no arquivo sem editar cada uso.
  ArrowDownRight,
  ArrowUpRight,
  Cube as Boxes,
  CalendarBlank as CalendarDays,
  ChartLineUp as ChartNoAxesCombined,
  ClipboardText as ClipboardList,
  Package,
  Coins as PackageOpen,
  Plus,
  Receipt as ReceiptText,
  MagnifyingGlass as Search,
  ShoppingCart as ShoppingBag,
  Sparkle as Sparkles,
  Wallet as WalletCards,
} from '@/lib/ui/icons';
import { DynamicChart } from '@/components/charts/DynamicChart';
import { cn } from '@/lib/utils';
import { fetchDashboardData, type ActivityRow, type DashboardData } from '@/app/actions/dashboard/analytics';
import { PERIOD_LABEL, type Period } from '@/lib/dashboard/period';

const brl = (cents: number, fractionDigits = 2) =>
  (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

const brlChart = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const PERIOD_BUTTONS: Array<{ key: Period; label: string }> = [
  { key: 'semanal', label: '7 dias' },
  { key: 'mensal', label: '30 dias' },
  { key: 'trimestral', label: '90 dias' },
  { key: 'semestral', label: '6 meses' },
  { key: 'anual', label: '12 meses' },
];

const ACTIVITY_LABEL: Record<ActivityRow['kind'], string> = {
  venda: 'Venda',
  os: 'O.S.',
  impressao: 'Impressão',
  estoque: 'Estoque',
};

const ACTIVITY_COLOR: Record<ActivityRow['kind'], string> = {
  venda: 'bg-emerald-500/15 text-emerald-500',
  os: 'bg-blue-500/15 text-blue-500',
  impressao: 'bg-violet-500/15 text-violet-500',
  estoque: 'bg-amber-500/15 text-amber-500',
};

/**
 * Sparkline SVG inline (sem lib) — desenha a tendência do período no KPI, como no
 * dashboard de referência. Cor herdada via `currentColor`.
 */
function Sparkline({ points, className }: { points: number[]; className?: string }) {
  if (points.length < 2) return null;
  const w = 96;
  const h = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const path = points
    .map((v, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(h - ((v - min) / span) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden className={cn("h-7 w-24", className)}>
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[11px] text-text-muted-foreground">sem comparação</span>;
  const positive = value >= 0;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold', positive ? 'text-emerald-500' : 'text-rose-500')}>
      {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {positive ? '+' : ''}{value.toFixed(1)}% <span className="font-normal text-text-muted-foreground">vs. período anterior</span>
    </span>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  change,
  tone = 'orange',
  loading = false,
  spark,
  href,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof WalletCards;
  change?: number | null;
  tone?: 'orange' | 'green' | 'blue' | 'violet' | 'amber';
  loading?: boolean;
  /** Série do período para o sparkline (opcional — só onde há dados reais). */
  spark?: number[];
  /** Se informado, o card vira um link para o módulo correspondente. */
  href?: string;
}) {
  const tones = {
    orange: 'bg-accent-soft text-accent',
    green: 'bg-emerald-500/12 text-emerald-500',
    blue: 'bg-blue-500/12 text-blue-500',
    violet: 'bg-violet-500/12 text-violet-500',
    amber: 'bg-amber-500/12 text-amber-500',
  };
  const sparkTone = {
    orange: 'text-accent-400',
    green: 'text-emerald-500/60',
    blue: 'text-blue-500/60',
    violet: 'text-violet-500/60',
    amber: 'text-amber-500/60',
  };
  const card = (
    <article className="group relative h-full overflow-hidden rounded-2xl border border-border/80 bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg">
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-text-muted-foreground">{label}</p>
          <p className={cn('mt-3 truncate text-2xl font-bold tracking-tight text-foreground md:text-[27px]', loading && 'animate-pulse opacity-50')}>
            {value}
          </p>
          <div className="mt-2 min-h-4">
            {change !== undefined ? <Change value={change} /> : <span className="text-[11px] text-text-muted-foreground">{note}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={cn('relative rounded-xl p-2.5', tones[tone])}>
            <Icon className="h-5 w-5" />
          </span>
          {spark && spark.length > 1 && <Sparkline points={spark} className={sparkTone[tone]} />}
        </div>
      </div>
    </article>
  );
  return href ? (
    <Link
      href={href}
      aria-label={`Abrir ${label}`}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      {card}
    </Link>
  ) : (
    card
  );
}

function Panel({ title, subtitle, icon: Icon, children, className }: { title: string; subtitle?: string; icon?: typeof ChartNoAxesCombined; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-border/80 bg-surface p-5 shadow-sm md:p-6', className)}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {Icon && <span className="rounded-lg bg-accent-soft p-2 text-accent"><Icon className="h-4 w-4" /></span>}
          <div>
            <h2 className="text-sm font-bold tracking-tight text-foreground">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function formatActivityDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function DashboardMain({ initial }: { initial: DashboardData }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [period, setPeriod] = useState<Period>(initial.period);
  const [pending, startTransition] = useTransition();

  function changePeriod(next: Period) {
    setPeriod(next);
    startTransition(async () => {
      const result = await fetchDashboardData(next);
      if (result.ok) setData(result.data);
    });
  }

  const periodLabel = PERIOD_LABEL[period].toLowerCase();
  const lineData = data.salesSeries;
  // Séries reais para os sparklines dos KPIs (só onde temos o dado por bucket).
  const sparkRevenue = data.salesSeries.map((d) => d.faturamento);
  const sparkProfit = data.salesSeries.map((d) => d.lucro);

  return (
    <main className="min-h-full bg-bg px-4 py-5 md:px-8 md:py-7">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-5 flex items-center gap-2 text-xs text-text-muted-foreground">
              <span>Geral</span><span>/</span><span className="font-semibold text-foreground">Dashboard</span>
            </div>
            <div className="flex items-start gap-3">
              <div>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Bom dia, {data.welcomeName} <span aria-hidden>☀️</span></h1>
                <p className="mt-2 text-sm text-text-muted-foreground">Aqui está o resumo da sua operação GLTech3D.</p>
              </div>
              {pending && <span className="mt-2 h-2.5 w-2.5 animate-pulse rounded-full bg-accent" aria-label="Atualizando" />}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex h-10 min-w-[190px] items-center gap-2 rounded-xl border border-border bg-surface/70 px-3 text-sm text-text-muted-foreground">
              <Search className="h-4 w-4" />
              <input className="w-full bg-transparent outline-none placeholder:text-text-muted-foreground" placeholder="Buscar no CRM" aria-label="Buscar no CRM" />
            </label>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-surface/75 p-1" role="group" aria-label="Período">
              {PERIOD_BUTTONS.map((item) => (
                <button key={item.key} type="button" aria-pressed={period === item.key} onClick={() => changePeriod(item.key)} className={cn('rounded-lg px-2.5 py-2 text-[11px] font-semibold transition-colors sm:px-3', period === item.key ? 'bg-accent text-white shadow-sm' : 'text-text-muted-foreground hover:bg-muted hover:text-foreground')}>
                  {item.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => router.push('/app/sales')} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white shadow-sm transition hover:bg-accent-hover">
              <Plus className="h-4 w-4" /> Nova venda
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Receita bruta" value={brl(data.kpis.faturamentoCents.value)} note="Receitas lançadas" change={data.kpis.faturamentoCents.changePct} icon={WalletCards} tone="orange" loading={pending} spark={sparkRevenue} href="/app/sales" />
          <MetricCard label="Lucro líquido" value={brl(data.kpis.lucroLiquidoCents.value)} note="Receitas menos despesas" change={data.kpis.lucroLiquidoCents.changePct} icon={ChartNoAxesCombined} tone="green" loading={pending} spark={sparkProfit} href="/app/reports" />
          <MetricCard label="Total de vendas" value={data.kpis.totalVendas.value.toLocaleString('pt-BR')} note="Lançamentos de receita" change={data.kpis.totalVendas.changePct} icon={ShoppingBag} tone="blue" loading={pending} href="/app/sales" />
          <MetricCard label="Ticket médio" value={brl(data.kpis.ticketMedioCents.value)} note="Por venda registrada" change={data.kpis.ticketMedioCents.changePct} icon={ReceiptText} tone="violet" loading={pending} href="/app/sales" />
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Estoque de produtos" value={brl(data.inventory.productsValueCents)} note={`${data.inventory.productsCount.toLocaleString('pt-BR')} unidades em estoque`} icon={Boxes} tone="orange" loading={pending} href="/app/products" />
          <MetricCard label="Estoque de filamentos" value={brl(data.inventory.filamentValueCents)} note={`${data.inventory.filamentSpools} rolos cadastrados`} icon={Package} tone="blue" loading={pending} href="/app/printers" />
          <MetricCard label="Lucro potencial" value={brl(data.inventory.potentialProfitCents)} note="Se todo o estoque for vendido" icon={ChartNoAxesCombined} tone="green" loading={pending} href="/app/products" />
          <MetricCard label="Total investido" value={brl(data.inventory.investedCents)} note="Máquinas, filamentos, ferramentas e insumos" icon={PackageOpen} tone="amber" loading={pending} href="/app/inventory" />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
          <Panel title="Receita × Custo × Lucro" subtitle={`Visão ${periodLabel}`} icon={ChartNoAxesCombined}>
            <DynamicChart data={lineData} series={[{ key: 'faturamento', name: 'Receita', color: '#f97316' }, { key: 'despesa', name: 'Custo', color: '#ef4444' }, { key: 'lucro', name: 'Lucro', color: '#10b981' }]} type="line" allowedTypes={['line', 'area', 'bar']} height={310} valueFormat={brlChart} />
          </Panel>

          <Panel title="Vendas por canal" subtitle={`Distribuição de receita no período`} icon={ShoppingBag}>
            {data.channelSeries.length === 0 ? (
              <div className="flex h-[310px] flex-col items-center justify-center gap-3 text-center text-sm text-text-muted-foreground"><ShoppingBag className="h-8 w-8 opacity-40" /><span>Nenhuma venda com canal informado.</span></div>
            ) : (
              <DynamicChart data={data.channelSeries} nameKey="name" valueKey="value" valueLabel="Receita" type="donut" allowedTypes={['donut']} height={310} currency />
            )}
          </Panel>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title="O.S. em andamento" subtitle="Prioridade operacional da oficina" icon={ClipboardList}>
            {data.activeOrders.length === 0 ? <EmptyState icon={ClipboardList} text="Nenhuma O.S. em andamento." /> : (
              <ul className="divide-y divide-border/70">
                {data.activeOrders.slice(0, 6).map((order) => (
                  <li key={order.id}>
                    <button type="button" onClick={() => router.push(`/app/service-orders?os=${order.id}`)} className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-muted/40">
                      <span className="rounded-lg bg-accent-soft p-2 text-accent"><ClipboardList className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{order.title}</span><span className="block truncate text-xs text-text-muted-foreground">{order.contactName}</span></span>
                      <span className="text-right"><span className="block font-mono text-sm font-semibold">{brl(order.totalCents)}</span><span className="text-[10px] capitalize text-text-muted-foreground">{order.status.replace('_', ' ')}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Atividade recente" subtitle="Últimos movimentos do CRM" icon={CalendarDays}>
            {data.activities.length === 0 ? <EmptyState icon={Sparkles} text={`Nada registrado ${periodLabel}.`} /> : (
              <ul className="divide-y divide-border/70">
                {data.activities.slice(0, 6).map((activity) => (
                  <li key={activity.id} className="flex items-center gap-3 py-3">
                    <span className={cn('rounded-lg p-2', ACTIVITY_COLOR[activity.kind])}><Sparkles className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{activity.text}</span><span className="block truncate text-xs text-text-muted-foreground">{ACTIVITY_LABEL[activity.kind]}{activity.sub ? ` · ${activity.sub}` : ''}</span></span>
                    <time className="shrink-0 text-[11px] text-text-muted-foreground">{formatActivityDate(activity.at)}</time>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      </div>
    </main>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof ClipboardList; text: string }) {
  return <div className="flex min-h-[190px] flex-col items-center justify-center gap-3 text-center text-sm text-text-muted-foreground"><Icon className="h-8 w-8 opacity-40" /><span>{text}</span></div>;
}
