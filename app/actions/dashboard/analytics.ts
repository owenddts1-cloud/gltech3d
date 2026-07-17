"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import {
  buildBuckets,
  bucketKey,
  isPeriod,
  pctChange,
  resolveWindow,
  type Period,
} from "@/lib/dashboard/period";

/**
 * Dados do Dashboard principal, recortados pela periodicidade ativa.
 *
 * Um único fetch alimenta KPIs, os dois gráficos, as duas tabelas e o feed — o
 * filtro global vale para tudo de uma vez, que é o requisito. Filtro de coluna e
 * ordenação ficam no cliente: o volume aqui é pequeno e ida ao servidor a cada
 * clique de sort deixaria a tabela lenta à toa.
 */

export interface Kpi {
  value: number;
  /** Variação vs. período anterior. Null = sem base de comparação. */
  changePct: number | null;
}

export interface SalesRow {
  id: string;
  date: string;
  description: string;
  category: string;
  platform: string | null;
  quantity: number;
  revenueCents: number;
  expenseCents: number;
  type: string;
}

export interface OsRow {
  id: string;
  createdAt: string;
  title: string;
  contactName: string;
  status: string;
  totalCents: number;
  slaDueAt: string | null;
  /** Plataforma da venda que originou a O.S. (do marketplace_orders ligado). */
  platform: string | null;
  /** Data da venda (sold_at). Cai para createdAt quando não há venda ligada. */
  saleDate: string;
}

export interface ActivityRow {
  id: string;
  kind: "venda" | "os" | "impressao" | "estoque";
  text: string;
  sub: string;
  at: string;
}

export interface DashboardData {
  period: Period;
  kpis: {
    faturamentoCents: Kpi;
    pedidosConcluidos: Kpi;
    osAtivas: Kpi;
    lucroLiquidoCents: Kpi;
  };
  /** Gráfico 1 — faturamento vs. despesa por bucket. */
  salesSeries: { label: string; faturamento: number; despesa: number }[];
  /** Gráfico 2 — O.S. criadas vs. concluídas por bucket. */
  osSeries: { label: string; criadas: number; concluidas: number }[];
  salesRows: SalesRow[];
  osRows: OsRow[];
  activities: ActivityRow[];
}

const num = (v: number | string | null | undefined): number => (v == null ? 0 : Number(v));

interface FinRow {
  id: string;
  date: string;
  description: string | null;
  type: string;
  category: string | null;
  platform: string | null;
  quantity: number | string | null;
  revenue_cents: number | string;
  expense_cents: number | string;
}

interface SoRow {
  id: string;
  title: string | null;
  contact_name: string | null;
  status: string;
  total_cents: number | string;
  sla_due_at: string | null;
  created_at: string;
  updated_at: string | null;
  /** Só existe depois da migration 0043 — undefined em banco sem ela. */
  concluded_at?: string | null;
}

export async function fetchDashboardData(
  rawPeriod: unknown,
): Promise<{ ok: false; error: string } | { ok: true; data: DashboardData }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "Nenhuma organização ativa" };

  const period: Period = isPeriod(rawPeriod) ? rawPeriod : "mensal";
  const now = new Date();
  const w = resolveWindow(period, now);
  const buckets = buildBuckets(w, now);

  const supabase = await createClient();
  // Busca desde o período ANTERIOR: a variação percentual precisa da base.
  const sinceIso = w.prevStart.toISOString();
  const sinceDate = w.prevStart.toISOString().slice(0, 10);

  const [finRes, osRes, jobsRes, filRes, moRes] = await Promise.all([
    supabase
      .from("financial_records")
      .select("id, date, description, type, category, platform, quantity, revenue_cents, expense_cents")
      .gte("date", sinceDate)
      .order("date", { ascending: false }),
    supabase
      // `*` e não lista explícita de propósito: `concluded_at` só existe depois
      // da migration 0043, e pedir a coluna pelo nome num banco sem ela devolve
      // 42703 e derruba o Dashboard inteiro. Com `*`, a coluna simplesmente vem
      // ausente e o fallback para `updated_at` assume. Aqui não há risco de
      // vazamento como na landing — é tela interna, atrás de login.
      .from("service_orders")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("print_jobs")
      .select("filename, printer_name, completed_at")
      .gte("completed_at", sinceIso)
      .order("completed_at", { ascending: false })
      .limit(30),
    supabase.from("filaments").select("name, weight_grams, min_weight_alert"),
    // Venda ligada a cada O.S. (plataforma + data da venda). Existe após a migration 0048.
    supabase
      .from("marketplace_orders")
      .select("service_order_id, platform, sold_at, customer_name")
      .not("service_order_id", "is", null),
  ]);

  const fin = (finRes.data as FinRow[] | null) ?? [];
  const os = (osRes.data as SoRow[] | null) ?? [];
  const jobs = (jobsRes.data as Array<{ filename: string | null; printer_name: string | null; completed_at: string }> | null) ?? [];
  const filaments = (filRes.data as Array<{ name: string; weight_grams: number | string; min_weight_alert: number | string }> | null) ?? [];
  // Mapa O.S. → venda (plataforma + data). Só O.S. geradas pelo Sincronizar têm venda ligada.
  const moBySo = new Map<string, { platform: string | null; soldAt: string | null; customerName: string | null }>();
  for (const m of (moRes.data as Array<{ service_order_id: string | null; platform: string | null; sold_at: string | null; customer_name: string | null }> | null) ?? []) {
    if (m.service_order_id) moBySo.set(m.service_order_id, { platform: m.platform, soldAt: m.sold_at, customerName: m.customer_name });
  }

  const inCurrent = (d: Date): boolean => d >= w.start;
  const inPrevious = (d: Date): boolean => d >= w.prevStart && d < w.start;

  // ── KPIs ────────────────────────────────────────────────────────────────
  const sumFin = (pick: (r: FinRow) => number, when: (d: Date) => boolean): number =>
    fin.filter((r) => when(new Date(`${r.date}T00:00:00`))).reduce((s, r) => s + pick(r), 0);

  const faturamentoAtual = sumFin((r) => num(r.revenue_cents), inCurrent);
  const faturamentoPrev = sumFin((r) => num(r.revenue_cents), inPrevious);
  const despesaAtual = sumFin((r) => num(r.expense_cents), inCurrent);
  const despesaPrev = sumFin((r) => num(r.expense_cents), inPrevious);

  // "Pedidos concluídos NO PERÍODO" é sobre quando FECHOU, não quando abriu:
  // uma O.S. criada em janeiro e fechada hoje conta para hoje.
  const concludedDate = (o: SoRow): Date | null => {
    if (o.status !== "concluido") return null;
    const iso = o.concluded_at ?? o.updated_at;
    return iso ? new Date(iso) : null;
  };
  const concluidasAtual = os.filter((o) => {
    const d = concludedDate(o);
    return d !== null && inCurrent(d);
  }).length;
  const concluidasPrev = os.filter((o) => {
    const d = concludedDate(o);
    return d !== null && inPrevious(d);
  }).length;

  // O.S. ativas é um retrato de AGORA, não do período — não faz sentido somar
  // "ativas no trimestre". A variação compara com as que já existiam no início.
  const osAtivasAgora = os.filter((o) => o.status !== "concluido").length;
  const osAtivasAntes = os.filter(
    (o) => o.status !== "concluido" && new Date(o.created_at) < w.start,
  ).length;

  const lucroAtual = faturamentoAtual - despesaAtual;
  const lucroPrev = faturamentoPrev - despesaPrev;

  // ── Séries ──────────────────────────────────────────────────────────────
  const salesMap = new Map(buckets.map((b) => [b.key, { faturamento: 0, despesa: 0 }]));
  for (const r of fin) {
    const d = new Date(`${r.date}T00:00:00`);
    if (!inCurrent(d)) continue;
    const slot = salesMap.get(bucketKey(d, w.bucket));
    if (!slot) continue;
    slot.faturamento += num(r.revenue_cents) / 100;
    slot.despesa += num(r.expense_cents) / 100;
  }

  const osMap = new Map(buckets.map((b) => [b.key, { criadas: 0, concluidas: 0 }]));
  for (const o of os) {
    const created = new Date(o.created_at);
    if (inCurrent(created)) {
      const slot = osMap.get(bucketKey(created, w.bucket));
      if (slot) slot.criadas += 1;
    }
    // `concluded_at` (migration 0043) é carimbado por trigger na transição para
    // "concluido". O fallback para `updated_at` cobre banco onde a 0043 ainda
    // não rodou — lá o número volta a ser aproximado, mas a tela não quebra.
    const doneAt = o.concluded_at ?? (o.status === "concluido" ? o.updated_at : null);
    if (doneAt) {
      const done = new Date(doneAt);
      if (inCurrent(done)) {
        const slot = osMap.get(bucketKey(done, w.bucket));
        if (slot) slot.concluidas += 1;
      }
    }
  }

  const salesSeries = buckets.map((b) => ({
    label: b.label,
    faturamento: Math.round((salesMap.get(b.key)?.faturamento ?? 0) * 100) / 100,
    despesa: Math.round((salesMap.get(b.key)?.despesa ?? 0) * 100) / 100,
  }));
  const osSeries = buckets.map((b) => ({
    label: b.label,
    criadas: osMap.get(b.key)?.criadas ?? 0,
    concluidas: osMap.get(b.key)?.concluidas ?? 0,
  }));

  // ── Tabelas ─────────────────────────────────────────────────────────────
  const salesRows: SalesRow[] = fin
    .filter((r) => inCurrent(new Date(`${r.date}T00:00:00`)))
    .map((r) => ({
      id: r.id,
      date: r.date,
      description: r.description ?? "—",
      category: r.category ?? "—",
      platform: r.platform || null,
      quantity: num(r.quantity) || 1,
      revenueCents: num(r.revenue_cents),
      expenseCents: num(r.expense_cents),
      type: r.type,
    }));

  const osRows: OsRow[] = os
    .filter((o) => inCurrent(new Date(o.created_at)))
    .map((o) => {
      const mo = moBySo.get(o.id);
      return {
        id: o.id,
        createdAt: o.created_at,
        title: o.title ?? "Sem título",
        contactName: o.contact_name || mo?.customerName || "—",
        status: o.status,
        totalCents: num(o.total_cents),
        slaDueAt: o.sla_due_at,
        platform: mo?.platform ?? null,
        saleDate: mo?.soldAt ?? o.created_at,
      };
    });

  // ── Feed ────────────────────────────────────────────────────────────────
  const activities: ActivityRow[] = [];
  for (const r of salesRows.slice(0, 12)) {
    activities.push({
      id: `fin-${r.id}`,
      kind: "venda",
      text: r.description,
      sub: `${r.category}${r.platform ? ` · ${r.platform}` : ""}`,
      at: `${r.date}T12:00:00`,
    });
  }
  for (const o of osRows.slice(0, 12)) {
    activities.push({
      id: `os-${o.id}`,
      kind: "os",
      text: o.title,
      sub: `${o.contactName} · ${o.status}`,
      at: o.createdAt,
    });
  }
  for (const j of jobs.slice(0, 12)) {
    activities.push({
      id: `job-${j.completed_at}-${j.filename ?? ""}`,
      kind: "impressao",
      text: `Impressão concluída · ${j.filename ?? "peça"}`,
      sub: j.printer_name ?? "",
      at: j.completed_at,
    });
  }
  for (const f of filaments.filter((x) => num(x.weight_grams) <= num(x.min_weight_alert))) {
    activities.push({
      id: `fil-${f.name}`,
      kind: "estoque",
      text: `Filamento acabando · ${f.name}`,
      sub: `${Math.round(num(f.weight_grams))}g restantes`,
      at: now.toISOString(),
    });
  }
  activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    ok: true,
    data: {
      period,
      kpis: {
        faturamentoCents: { value: faturamentoAtual, changePct: pctChange(faturamentoAtual, faturamentoPrev) },
        pedidosConcluidos: { value: concluidasAtual, changePct: pctChange(concluidasAtual, concluidasPrev) },
        osAtivas: { value: osAtivasAgora, changePct: pctChange(osAtivasAgora, osAtivasAntes) },
        lucroLiquidoCents: { value: lucroAtual, changePct: pctChange(lucroAtual, lucroPrev) },
      },
      salesSeries,
      osSeries,
      salesRows,
      osRows,
      activities: activities.slice(0, 30),
    },
  };
}
