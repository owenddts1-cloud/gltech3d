"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { assertProAccess } from "@/lib/plan/server";

export interface RecordSiteOrderRevenueParams {
  order_id: string;
  customer_name: string;
  total_cents: number;
  payment_method: string;
  channel?: string;
  pix_e2e_id?: string;
  platform_fee_cents?: number;
}

export async function recordSiteOrderRevenueAction(params: RecordSiteOrderRevenueParams) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "No active organization" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false, error: denied };

  const supabase = await createClient();

  const netCents = Math.max(0, params.total_cents - (params.platform_fee_cents || 0));
  const dateStr = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("financial_records")
    .insert({
      organization_id: activeOrg.orgId,
      order_id: params.order_id,
      description: `Receita Pedido #${params.order_id.slice(0, 8)} - ${params.customer_name}`,
      type: "Receita",
      category: "Venda de Filamento",
      channel: params.channel || "site_filaments",
      payment_method: params.payment_method || "pix",
      pix_e2e_id: params.pix_e2e_id || null,
      revenue_cents: params.total_cents,
      expense_cents: 0,
      platform_fee_cents: params.platform_fee_cents || 0,
      net_cents: netCents,
      status: "reconciled",
      reconciled_at: new Date().toISOString(),
      date: dateStr,
      month: new Date().toLocaleString("pt-BR", { month: "short" }).toUpperCase(),
      created_by: authUser.id,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, transaction_id: data?.id };
}

export interface RecordFarmJobCostParams {
  job_id: string;
  order_id?: string;
  consumed_mass_g: number;
  spool_cost_per_kg: number;
  print_time_hours: number;
  hourly_machine_rate_brl: number;
}

export async function recordFarmJobCostAction(params: RecordFarmJobCostParams) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "No active organization" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false, error: denied };

  const supabase = await createClient();

  const cpv_filament_cost_cents = Math.round(
    params.consumed_mass_g * (params.spool_cost_per_kg / 1000) * 100
  );
  const cpv_machine_cost_cents = Math.round(
    params.print_time_hours * params.hourly_machine_rate_brl * 100
  );
  const totalCpvCents = cpv_filament_cost_cents + cpv_machine_cost_cents;
  const dateStr = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("financial_records")
    .insert({
      organization_id: activeOrg.orgId,
      production_job_id: params.job_id,
      order_id: params.order_id || null,
      description: `CPV Produção 3D #${params.job_id.slice(0, 8)} (${params.consumed_mass_g}g filamento + ${params.print_time_hours}h máq)`,
      type: "Despesa",
      category: "CPV Impressão 3D",
      channel: "demand_printing",
      revenue_cents: 0,
      expense_cents: totalCpvCents,
      net_cents: -totalCpvCents,
      cpv_filament_cost_cents,
      cpv_machine_cost_cents,
      status: "reconciled",
      date: dateStr,
      month: new Date().toLocaleString("pt-BR", { month: "short" }).toUpperCase(),
      created_by: authUser.id,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    transaction_id: data?.id,
    cpv_filament_cost_cents,
    cpv_machine_cost_cents,
  };
}

export interface CreateOperationalExpenseParams {
  description: string;
  category: string;
  amount_cents: number;
  due_date?: string;
  payment_method?: string;
  is_recurring?: boolean;
}

export async function createOperationalExpenseAction(params: CreateOperationalExpenseParams) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "No active organization" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false, error: denied };

  const supabase = await createClient();

  const dateStr = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("financial_records")
    .insert({
      organization_id: activeOrg.orgId,
      description: params.description,
      type: "Despesa",
      category: params.category,
      channel: "manual",
      payment_method: params.payment_method || "pix",
      revenue_cents: 0,
      expense_cents: params.amount_cents,
      net_cents: -params.amount_cents,
      due_date: params.due_date || null,
      status: "pending",
      date: dateStr,
      month: new Date().toLocaleString("pt-BR", { month: "short" }).toUpperCase(),
      created_by: authUser.id,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, transaction_id: data?.id };
}
