"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";

export interface ReportsData {
  /** 12 meses, do mais antigo ao mais recente. */
  monthly: { month: string; revenueCents: number; filamentGrams: number; activeHours: number; jobs: number }[];
  osConcluidas: number;
  osTotal: number;
  sources: { name: string; value: number; color: string }[];
  printers: { name: string; jobs: number; activeHours: number; status: string; statusLabel: string }[];
  insights: { id: string; tone: "warn" | "info" | "success"; title: string; text: string; href?: string; cta?: string }[];
}

const num = (v: unknown) => (v == null ? 0 : Number(v));
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const SOURCE_META: Record<string, { label: string; color: string }> = {
  whatsapp: { label: "WhatsApp", color: "#10B981" },
  instagram: { label: "Instagram", color: "#A855F7" },
  nuvemshop: { label: "Nuvemshop", color: "#3B82F6" },
  manual: { label: "Manual", color: "#EAB308" },
};
const sourceMeta = (s: string) => SOURCE_META[s.toLowerCase()] ?? { label: s || "Outros", color: "#94A3B8" };

const STATUS_LABEL: Record<string, string> = {
  idle: "Ociosa",
  printing: "Imprimindo",
  error: "Falha",
  offline: "Offline",
};

export async function fetchReportsData(): Promise<{ ok: false } | { ok: true; data: ReportsData }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false };

  const supabase = await createClient();
  const [osRes, jobsRes, filRes, printersRes, contactsRes] = await Promise.all([
    supabase.from("service_orders").select("status, total_cents, created_at"),
    supabase.from("print_jobs").select("weight_grams, print_time_seconds, printer_client_id, printer_name, completed_at").order("completed_at", { ascending: false }).limit(1000),
    supabase.from("filaments").select("name, weight_grams, min_weight_alert"),
    supabase.from("printers").select("client_id, name, status"),
    supabase.from("contacts").select("source").eq("organization_id", activeOrg.orgId).limit(3000),
  ]);

  const os = (osRes.data as Array<{ status: string; total_cents: number | string; created_at: string }> | null) ?? [];
  const jobs = (jobsRes.data as Array<{ weight_grams: number | string; print_time_seconds: number | string; printer_client_id: string | null; printer_name: string | null; completed_at: string }> | null) ?? [];
  const filaments = (filRes.data as Array<{ name: string; weight_grams: number | string; min_weight_alert: number | string }> | null) ?? [];
  const printers = (printersRes.data as Array<{ client_id: string; name: string; status: string }> | null) ?? [];
  const contacts = (contactsRes.data as Array<{ source: string | null }> | null) ?? [];

  const now = new Date();

  // ── Série mensal (12 meses) ──
  const monthly: ReportsData["monthly"] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const sameMonth = (iso: string) => {
      const dt = new Date(iso);
      return dt.getMonth() === m && dt.getFullYear() === y;
    };
    const revenueCents = os
      .filter((o) => o.status === "concluido" && sameMonth(o.created_at))
      .reduce((s, o) => s + num(o.total_cents), 0);
    const monthJobs = jobs.filter((j) => sameMonth(j.completed_at));
    monthly.push({
      month: MONTHS[m]!,
      revenueCents,
      filamentGrams: Math.round(monthJobs.reduce((s, j) => s + num(j.weight_grams), 0)),
      activeHours: Math.round(monthJobs.reduce((s, j) => s + num(j.print_time_seconds), 0) / 3600),
      jobs: monthJobs.length,
    });
  }

  // ── OS conclusão ──
  const osTotal = os.length;
  const osConcluidas = os.filter((o) => o.status === "concluido").length;

  // ── Origem de contatos (proxy real de "canais") ──
  const sourceCounts = new Map<string, number>();
  for (const c of contacts) {
    const key = (c.source ?? "outros").toLowerCase();
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }
  const sources: ReportsData["sources"] = Array.from(sourceCounts.entries())
    .map(([s, value]) => ({ name: sourceMeta(s).label, value, color: sourceMeta(s).color }))
    .sort((a, b) => b.value - a.value);

  // ── Impressoras: jobs + horas reais por máquina ──
  const jobsByPrinter = new Map<string, { jobs: number; seconds: number }>();
  for (const j of jobs) {
    const key = j.printer_client_id ?? j.printer_name ?? "—";
    const cur = jobsByPrinter.get(key) ?? { jobs: 0, seconds: 0 };
    cur.jobs += 1;
    cur.seconds += num(j.print_time_seconds);
    jobsByPrinter.set(key, cur);
  }
  const printersData: ReportsData["printers"] = printers.map((p) => {
    const agg = jobsByPrinter.get(p.client_id) ?? { jobs: 0, seconds: 0 };
    return {
      name: p.name,
      jobs: agg.jobs,
      activeHours: Math.round(agg.seconds / 3600),
      status: p.status,
      statusLabel: STATUS_LABEL[p.status] ?? p.status,
    };
  });

  // ── Insights de thresholds reais ──
  const insights: ReportsData["insights"] = [];
  const lowStock = filaments.filter((f) => num(f.weight_grams) <= num(f.min_weight_alert));
  if (lowStock.length > 0) {
    const first = lowStock[0]!;
    insights.push({
      id: "low-stock",
      tone: "warn",
      title: `Estoque baixo: ${first.name}`,
      text: `${lowStock.length} filamento(s) no ou abaixo do alerta mínimo. Reponha para não travar a fila.`,
      href: "/app/suppliers",
      cta: "Cotar com fornecedores",
    });
  }
  const topPrinter = [...printersData].sort((a, b) => b.activeHours - a.activeHours)[0];
  if (topPrinter && topPrinter.activeHours > 0) {
    insights.push({
      id: "top-printer",
      tone: "info",
      title: `${topPrinter.name} é a mais usada`,
      text: `${topPrinter.activeHours}h ativas em ${topPrinter.jobs} jobs. Considere manutenção preventiva de eixos.`,
      href: "/app/calendar",
      cta: "Agendar no calendário",
    });
  }
  const last = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];
  if (last && prev && last.revenueCents > prev.revenueCents && prev.revenueCents > 0) {
    const pct = Math.round(((last.revenueCents - prev.revenueCents) / prev.revenueCents) * 100);
    insights.push({
      id: "revenue-up",
      tone: "success",
      title: `Faturamento subiu ${pct}% no mês`,
      text: `Melhor mês recente. Reforce os canais de origem que mais convertem.`,
    });
  }
  if (insights.length === 0) {
    insights.push({
      id: "empty",
      tone: "info",
      title: "Sem alertas no momento",
      text: "Conforme OS forem concluídas e a telemetria rodar, recomendações aparecem aqui.",
    });
  }

  return {
    ok: true,
    data: { monthly, osConcluidas, osTotal, sources, printers: printersData, insights },
  };
}
