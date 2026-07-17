"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import {
  computeReportBreakdowns,
  type ReportBreakdowns, type FinRow, type SoRow, type MoRow, type ProjRow,
} from "@/app/app/reports/_lib/breakdowns-compute";

// Re-exporta os tipos para os consumidores existentes (page/ReportsClient).
export type { ReportBreakdowns, Breakdown, BreakdownGroup, BreakdownKey, BreakdownDrillRow } from "@/app/app/reports/_lib/breakdowns-compute";

/**
 * Breakdowns para os gráficos dinâmicos + drill-down dos Relatórios.
 * A lógica pura de agregação vive em `_lib/breakdowns-compute.ts` (testável sem banco);
 * aqui só buscamos as linhas (filtrando organization_id explicitamente + RLS) e delegamos.
 */
export async function fetchReportBreakdowns(): Promise<
  { ok: false; error: string } | { ok: true; data: ReportBreakdowns }
> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "Nenhuma organização ativa" };
  const org = activeOrg.orgId;

  const supabase = await createClient();
  const [finRes, soRes, moRes, projRes] = await Promise.all([
    supabase
      .from("financial_records")
      .select("id, date, description, type, category, platform, revenue_cents, expense_cents")
      .eq("organization_id", org),
    supabase
      .from("service_orders")
      .select("id, title, contact_name, status, total_cents, created_at")
      .eq("organization_id", org),
    // marketplace_orders só existe depois da migration 0048 — tolera ausência.
    supabase
      .from("marketplace_orders")
      .select("id, customer_name, platform, status, total_cents, sold_at")
      .eq("organization_id", org),
    supabase
      .from("projects")
      .select("id, name, weight_grams, print_hours, filament_cost_per_kg, wattage, kwh_price, depreciation_per_hour")
      .eq("organization_id", org),
  ]);

  const data = computeReportBreakdowns({
    fin: (finRes.data as FinRow[] | null) ?? [],
    so: (soRes.data as SoRow[] | null) ?? [],
    mo: (moRes.data as MoRow[] | null) ?? [],
    proj: (projRes.data as ProjRow[] | null) ?? [],
  });

  return { ok: true, data };
}
