"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { assertProAccess } from "@/lib/plan/server";

export interface AccountPayableItem {
  id: string;
  supplier_id?: string;
  supplier_name: string;
  category: string;
  description: string;
  amount_cents: number;
  due_date: string;
  status: "pending" | "approved" | "paid" | "cancelled";
  paid_at?: string;
  payment_method: string;
  purchase_request_id?: string;
  created_at: string;
}

export async function fetchAccountsPayableAction(filters?: {
  status?: string;
  category?: string;
}): Promise<{ ok: boolean; data?: AccountPayableItem[]; error?: string }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "No active organization" };

  const supabase = await createClient();

  let query = supabase
    .from("accounts_payable")
    .select("*")
    .eq("organization_id", activeOrg.orgId)
    .order("due_date", { ascending: true });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.category) {
    query = query.eq("category", filters.category);
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: data || [] };
}

export interface CreateAccountPayableParams {
  supplier_id?: string;
  supplier_name: string;
  category: string;
  description: string;
  amount_cents: number;
  due_date: string;
  payment_method?: string;
  purchase_request_id?: string;
}

export async function createAccountPayableAction(params: CreateAccountPayableParams) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "No active organization" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false, error: denied };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("accounts_payable")
    .insert({
      organization_id: activeOrg.orgId,
      supplier_id: params.supplier_id || null,
      supplier_name: params.supplier_name,
      category: params.category,
      description: params.description,
      amount_cents: params.amount_cents,
      due_date: params.due_date,
      payment_method: params.payment_method || "pix",
      purchase_request_id: params.purchase_request_id || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data?.id };
}

export async function markPayableAsPaidAction(id: string) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "No active organization" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false, error: denied };

  const supabase = await createClient();

  const paidAt = new Date().toISOString();

  // 1. Fetch payable record
  const { data: payable, error: fetchErr } = await supabase
    .from("accounts_payable")
    .select("*")
    .eq("organization_id", activeOrg.orgId)
    .eq("id", id)
    .single();

  if (fetchErr || !payable) {
    return { ok: false, error: fetchErr?.message || "Conta a pagar não encontrada" };
  }

  // 2. Mark as paid
  const { error: updateErr } = await supabase
    .from("accounts_payable")
    .update({
      status: "paid",
      paid_at: paidAt,
      updated_at: paidAt,
    })
    .eq("organization_id", activeOrg.orgId)
    .eq("id", id);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  // 3. Sync to financial_records
  const dateStr = paidAt.split("T")[0];
  await supabase
    .from("financial_records")
    .insert({
      organization_id: activeOrg.orgId,
      description: `Pagamento Fornecedor: ${payable.supplier_name} - ${payable.description}`,
      type: "Despesa",
      category: payable.category,
      channel: "manual",
      payment_method: payable.payment_method || "pix",
      revenue_cents: 0,
      expense_cents: payable.amount_cents,
      net_cents: -payable.amount_cents,
      status: "reconciled",
      reconciled_at: paidAt,
      date: dateStr,
      month: new Date().toLocaleString("pt-BR", { month: "short" }).toUpperCase(),
      created_by: authUser.id,
    });

  return { ok: true };
}
