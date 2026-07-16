'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PackageCheck,
  ClipboardList,
  PiggyBank,
  Loader2,
  ShoppingCart,
  Printer,
  Boxes,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PERIODS, PERIOD_LABEL, type Period } from '@/lib/dashboard/period';
import { fetchDashboardData, type DashboardData } from '@/app/actions/dashboard/analytics';
import DataTable, { type Column } from './DataTable';
import type { SalesRow, OsRow, ActivityRow } from '@/app/actions/dashboard/analytics';

const brl = (cents: number): string =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const brlPlain = (v: number): string =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const dateBR = (iso: string): string =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });

/**
 * Cores dos gráficos vindas dos tokens do tema, não de hex fixo — é o que faz o
 * gráfico acompanhar o modo claro/escuro em vez de sumir no fundo.
 */
const CHART = {
  accent: 'var(--color-accent-500)',
  accentSoft: 'var(--color-accent-300)',
  muted: 'var(--color-neutral-400)',
  grid: 'var(--color-border)',
  text: 'var(--color-text-muted)',
};

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-[11px] text-muted-foreground">sem base anterior</span>;
  }
  if (Math.abs(pct) < 0.05) {
    return <span className="text-[11px] text-muted-foreground">estável</span>;
  }
  const up = pct > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'flex items-center gap-1 text-[11px] font-medium',
        up ? 'text-success' : 'text-error',
      )}
    >
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  );
}

function KpiCard({
  label,
  hint,
  value,
  changePct,
  icon: Icon,
  loading,
}: {
  label: string;
  hint: string;
  value: string;
  changePct: number | null;
  icon: typeof Wallet;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 transition-shadow hover:shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{label}</div>
          <div className="truncate text-[11px] text-muted-foreground">{hint}</div>
        </div>
        <span className="shrink-0 rounded-xl bg-accent-soft p-2 text-accent">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div
        className={cn(
          'font-mono text-3xl font-semibold tracking-tight transition-opacity',
          loading && 'opacity-40',
        )}
      >
        {value}
      </div>
      <div className="mt-2">
        <ChangeBadge pct={changePct} />
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const ACTIVITY_META: Record<ActivityRow['kind'], { label: string; icon: typeof Wallet }> = {
  venda: { label: 'Vendas', icon: ShoppingCart },
  os: { label: 'Ordens de Serviço', icon: FileText },
  impressao: { label: 'Impressões', icon: Printer },
  estoque: { label: 'Estoque', icon: Boxes },
};

export default function DashboardMain({ initial }: { initial: DashboardData }) {
  const [data, setData] = useState(initial);
  const [period, setPeriod] = useState<Period>(initial.period);
  const [pending, startTransition] = useTransition();
  const [tableKind, setTableKind] = useState<'vendas' | 'os'>('vendas');
  const [activityKind, setActivityKind] = useState<ActivityRow['kind'] | 'todas'>('todas');

  function changePeriod(next: Period) {
    setPeriod(next);
    startTransition(async () => {
      const r = await fetchDashboardData(next);
      if (r.ok) setData(r.data);
    });
  }

  const salesColumns: Column<SalesRow>[] = useMemo(
    () => [
      { key: 'date', header: 'Data', value: (r) => r.date, cell: (r) => dateBR(r.date) },
      { key: 'description', header: 'Descrição', value: (r) => r.description },
      {
        key: 'category',
        header: 'Categoria',
        value: (r) => r.category,
        cell: (r) => (
          <Badge variant="secondary" className="font-normal">
            {r.category}
          </Badge>
        ),
      },
      { key: 'platform', header: 'Canal', value: (r) => r.platform ?? '—' },
      { key: 'quantity', header: 'Qtd', value: (r) => r.quantity, align: 'right' },
      {
        key: 'revenue',
        header: 'Valor',
        value: (r) => (r.type === 'Receita' ? r.revenueCents : -r.expenseCents),
        align: 'right',
        cell: (r) => (
          <span
            className={cn(
              'font-mono text-xs font-medium',
              r.type === 'Receita' ? 'text-success' : 'text-error',
            )}
          >
            {r.type === 'Receita' ? brl(r.revenueCents) : `- ${brl(r.expenseCents)}`}
          </span>
        ),
      },
    ],
    [],
  );

  const osColumns: Column<OsRow>[] = useMemo(
    () => [
      { key: 'date', header: 'Criada em', value: (r) => r.createdAt, cell: (r) => dateBR(r.createdAt) },
      { key: 'title', header: 'Ordem', value: (r) => r.title },
      { key: 'contact', header: 'Cliente', value: (r) => r.contactName },
      {
        key: 'status',
        header: 'Status',
        value: (r) => r.status,
        cell: (r) => (
          <Badge
            variant={r.status === 'concluido' ? 'default' : 'secondary'}
            className="font-normal capitalize"
          >
            {r.status.replace('_', ' ')}
          </Badge>
        ),
      },
      {
        key: 'total',
        header: 'Valor',
        value: (r) => r.totalCents,
        align: 'right',
        cell: (r) => <span className="font-mono text-xs font-medium">{brl(r.totalCents)}</span>,
      },
    ],
    [],
  );

  const activities = useMemo(
    () =>
      activityKind === 'todas'
        ? data.activities
        : data.activities.filter((a) => a.kind === activityKind),
    [data.activities, activityKind],
  );

  const periodNote = `no período ${PERIOD_LABEL[period].toLowerCase()}`;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      {/* Filtro global — governa cards, gráficos, tabela e feed de uma vez. */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <p className="text-sm text-muted-foreground">
            Como a operação foi {periodNote}.
            {pending && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                atualizando
              </span>
            )}
          </p>
        </div>

        <div
          className="flex items-center gap-0.5 rounded-xl border border-border bg-muted/50 p-0.5"
          role="group"
          aria-label="Periodicidade"
        >
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => changePeriod(p)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                period === p
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </header>

      {/* 4 KPIs, no máximo 2 colunas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard
          label="Faturamento"
          hint={`Receitas lançadas ${periodNote}`}
          value={brl(data.kpis.faturamentoCents.value)}
          changePct={data.kpis.faturamentoCents.changePct}
          icon={Wallet}
          loading={pending}
        />
        <KpiCard
          label="Pedidos concluídos"
          hint={`Ordens fechadas ${periodNote}`}
          value={String(data.kpis.pedidosConcluidos.value)}
          changePct={data.kpis.pedidosConcluidos.changePct}
          icon={PackageCheck}
          loading={pending}
        />
        <KpiCard
          label="O.S. ativas"
          hint="Em aberto agora, na oficina"
          value={String(data.kpis.osAtivas.value)}
          changePct={data.kpis.osAtivas.changePct}
          icon={ClipboardList}
          loading={pending}
        />
        <KpiCard
          label="Lucro líquido"
          hint="Receitas menos despesas"
          value={brl(data.kpis.lucroLiquidoCents.value)}
          changePct={data.kpis.lucroLiquidoCents.changePct}
          icon={PiggyBank}
          loading={pending}
        />
      </div>

      {/* Gráfico 1 — vendas e faturamento */}
      <Panel
        title="Vendas e faturamento"
        subtitle={`Entradas e saídas ${periodNote}`}
        action={
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: CHART.accent }} />
              Faturamento
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: CHART.muted }} />
              Despesa
            </span>
          </div>
        }
      >
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.salesSeries} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={CHART.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: CHART.text }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: CHART.text }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <Tooltip
                formatter={(v, name) => [
                  brlPlain(typeof v === 'number' ? v : Number(v) || 0),
                  name === 'faturamento' ? 'Faturamento' : 'Despesa',
                ]}
                contentStyle={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12,
                  fontSize: 12,
                  color: 'var(--color-text)',
                }}
              />
              <Area
                type="monotone"
                dataKey="faturamento"
                stroke={CHART.accent}
                strokeWidth={2}
                fill="url(#gradFat)"
              />
              <Area
                type="monotone"
                dataKey="despesa"
                stroke={CHART.muted}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="none"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Gráfico 2 — fluxo de O.S., empilhado abaixo do primeiro */}
      <Panel
        title="Fluxo de ordens de serviço"
        subtitle={`Criadas contra concluídas ${periodNote}`}
      >
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.osSeries} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: CHART.text }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: CHART.text }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-surface-elevated)' }}
                contentStyle={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12,
                  fontSize: 12,
                  color: 'var(--color-text)',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: CHART.text }}
                formatter={(v) => (v === 'criadas' ? 'Criadas' : 'Concluídas')}
              />
              <Bar dataKey="criadas" fill={CHART.accentSoft} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="concluidas" fill={CHART.accent} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Tabela alternável, com filtro por coluna */}
      <Panel
        title={tableKind === 'vendas' ? 'Vendas lançadas' : 'Ordens de serviço'}
        subtitle="Cada coluna tem filtro e ordenação própria"
        action={
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5">
            {(['vendas', 'os'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={tableKind === k}
                onClick={() => setTableKind(k)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  tableKind === k
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {k === 'vendas' ? 'Vendas' : 'O.S.'}
              </button>
            ))}
          </div>
        }
      >
        {tableKind === 'vendas' ? (
          <DataTable
            rows={data.salesRows}
            columns={salesColumns}
            empty={`Nenhum lançamento ${periodNote}.`}
          />
        ) : (
          <DataTable rows={data.osRows} columns={osColumns} empty={`Nenhuma O.S. ${periodNote}.`} />
        )}
      </Panel>

      {/* Feed de atividades, filtrável por tipo */}
      <Panel
        title="Atividades recentes"
        subtitle="O que aconteceu no sistema"
        action={
          <div className="flex flex-wrap items-center gap-1">
            {(['todas', 'venda', 'os', 'impressao', 'estoque'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={activityKind === k}
                onClick={() => setActivityKind(k)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  activityKind === k
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {k === 'todas' ? 'Todas' : ACTIVITY_META[k].label}
              </button>
            ))}
          </div>
        }
      >
        {activities.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            Nada por aqui {periodNote}.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {activities.map((a) => {
              const Icon = ACTIVITY_META[a.kind].icon;
              return (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <span className="shrink-0 rounded-lg bg-muted p-1.5 text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{a.text}</div>
                    {a.sub && <div className="truncate text-[11px] text-muted-foreground">{a.sub}</div>}
                  </div>
                  <time className="shrink-0 text-[11px] text-muted-foreground">{dateBR(a.at)}</time>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
