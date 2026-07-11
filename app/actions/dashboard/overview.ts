"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";

export interface DashboardOverview {
  kpis: {
    faturamentoMesCents: number;
    faturamentoPrevCents: number;
    osAtivas: number;
    filamentoMesGramas: number;
    lowStock: number;
    clientes: number;
    lucroEstimadoCents: number;
  };
  osByStatus: { orcamento: number; aprovado: number; em_producao: number; concluido: number };
  revenueSeries: { month: string; cents: number }[];
  spending: { filament: number; energy: number; depreciation: number };
  feed: { id: string; kind: "job" | "os" | "product"; text: string; sub: string; at: string }[];
  activeOrders: { id: string; title: string; contactName: string | null; status: string; totalCents: number; slaDueAt: string | null }[];
  performance: { successRate: number; goals: { label: string; done: boolean }[] };
}

const num = (v: unknown) => (v == null ? 0 : Number(v));
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export async function fetchDashboardOverview(): Promise<{ ok: false } | { ok: true; data: DashboardOverview }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false };

  const supabase = await createClient();
  // RLS scopes each query; missing tables (migration não aplicada) → data null → [].
  const [osRes, jobsRes, filRes, contactsRes] = await Promise.all([
    supabase.from("service_orders").select("id, title, contact_name, status, total_cents, sla_due_at, created_at"),
    supabase.from("print_jobs").select("weight_grams, material_cost, energy_cost, depreciation_cost, total_cost, filename, printer_name, completed_at").order("completed_at", { ascending: false }).limit(200),
    supabase.from("filaments").select("weight_grams, min_weight_alert"),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("organization_id", activeOrg.orgId),
  ]);

  const os = (osRes.data as Array<{ id: string; title: string | null; contact_name: string | null; status: string; total_cents: number | string; sla_due_at: string | null; created_at: string }> | null) ?? [];
  const jobs = (jobsRes.data as Array<{ weight_grams: number | string; material_cost: number | string | null; energy_cost: number | string | null; depreciation_cost: number | string | null; total_cost: number | string | null; filename: string | null; printer_name: string | null; completed_at: string }> | null) ?? [];
  const filaments = (filRes.data as Array<{ weight_grams: number | string; min_weight_alert: number | string }> | null) ?? [];

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  // KPIs
  const faturamentoMesCents = os
    .filter((o) => o.status === "concluido" && new Date(o.created_at).getMonth() === thisMonth && new Date(o.created_at).getFullYear() === thisYear)
    .reduce((s, o) => s + num(o.total_cents), 0);
  const prev = new Date(thisYear, thisMonth - 1, 1);
  const faturamentoPrevCents = os
    .filter((o) => o.status === "concluido" && new Date(o.created_at).getMonth() === prev.getMonth() && new Date(o.created_at).getFullYear() === prev.getFullYear())
    .reduce((s, o) => s + num(o.total_cents), 0);
  const osAtivas = os.filter((o) => o.status !== "concluido").length;
  const osByStatus = {
    orcamento: os.filter((o) => o.status === "orcamento").length,
    aprovado: os.filter((o) => o.status === "aprovado").length,
    em_producao: os.filter((o) => o.status === "em_producao").length,
    concluido: os.filter((o) => o.status === "concluido").length,
  };
  const filamentoMesGramas = Math.round(
    jobs.filter((j) => new Date(j.completed_at).getMonth() === thisMonth).reduce((s, j) => s + num(j.weight_grams), 0),
  );
  const lowStock = filaments.filter((f) => num(f.weight_grams) <= num(f.min_weight_alert)).length;

  // Revenue series (últimos 6 meses)
  const revenueSeries: { month: string; cents: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(thisYear, thisMonth - i, 1);
    const cents = os
      .filter((o) => o.status === "concluido" && new Date(o.created_at).getMonth() === d.getMonth() && new Date(o.created_at).getFullYear() === d.getFullYear())
      .reduce((s, o) => s + num(o.total_cents), 0);
    revenueSeries.push({ month: MONTHS[d.getMonth()]!, cents });
  }

  // Spending (donut) — soma dos custos dos jobs
  const spending = {
    filament: jobs.reduce((s, j) => s + num(j.material_cost), 0),
    energy: jobs.reduce((s, j) => s + num(j.energy_cost), 0),
    depreciation: jobs.reduce((s, j) => s + num(j.depreciation_cost), 0),
  };
  const custoTotal = jobs.reduce((s, j) => s + num(j.total_cost), 0);
  const lucroEstimadoCents = Math.max(0, Math.round(faturamentoMesCents - custoTotal * 100));

  // Feed — últimos jobs + OS recentes
  const feed: DashboardOverview["feed"] = [];
  for (const j of jobs.slice(0, 6)) {
    feed.push({
      id: `job-${j.completed_at}-${j.filename}`,
      kind: "job",
      text: `Impressão concluída · ${j.filename ?? "peça"}`,
      sub: j.printer_name ?? "",
      at: j.completed_at,
    });
  }
  for (const o of [...os].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 4)) {
    feed.push({ id: `os-${o.created_at}`, kind: "os", text: "Ordem de serviço", sub: o.status, at: o.created_at });
  }
  feed.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  // Ordens ativas (não concluídas) ordenadas por prazo (SLA) mais próximo primeiro.
  const activeOrders: DashboardOverview["activeOrders"] = os
    .filter((o) => o.status !== "concluido")
    .sort((a, b) => {
      const ta = a.sla_due_at ? new Date(a.sla_due_at).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.sla_due_at ? new Date(b.sla_due_at).getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    })
    .slice(0, 6)
    .map((o) => ({
      id: o.id,
      title: o.title?.trim() || "OS sem título",
      contactName: o.contact_name,
      status: o.status,
      totalCents: num(o.total_cents),
      slaDueAt: o.sla_due_at,
    }));

  // Performance operacional (dados reais): taxa de conclusão + metas por limiar.
  const osTotal = os.length;
  const successRate = osTotal > 0 ? Math.round((osByStatus.concluido / osTotal) * 100) : 0;
  const hasOverdue = os.some(
    (o) => o.status !== "concluido" && o.sla_due_at != null && new Date(o.sla_due_at).getTime() < now.getTime(),
  );
  const performance: DashboardOverview["performance"] = {
    successRate,
    goals: [
      { label: "Faturamento ≥ mês anterior", done: faturamentoMesCents >= faturamentoPrevCents && faturamentoMesCents > 0 },
      { label: "Nenhuma OS atrasada", done: !hasOverdue },
      { label: "Estoque de filamento saudável", done: lowStock === 0 },
    ],
  };

  return {
    ok: true,
    data: {
      kpis: {
        faturamentoMesCents,
        faturamentoPrevCents,
        osAtivas,
        filamentoMesGramas,
        lowStock,
        clientes: contactsRes.count ?? 0,
        lucroEstimadoCents,
      },
      osByStatus,
      revenueSeries,
      spending,
      feed: feed.slice(0, 8),
      activeOrders,
      performance,
    },
  };
}
