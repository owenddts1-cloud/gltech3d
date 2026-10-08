"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { assertProAccess } from "@/lib/plan/server";

export interface CashflowTransactionItem {
  id: string;
  date: string;
  due_date?: string;
  description: string;
  type: "Receita" | "Despesa";
  category: string;
  revenue_cents: number;
  expense_cents: number;
  net_cents: number;
  payment_method: string;
  pix_e2e_id?: string;
  status: string;
  is_projected: boolean;
}

export interface CashflowSummary {
  currentBalanceCents: number;
  projectedInflowCents: number;
  projectedOutflowCents: number;
  projectedBalanceCents: number;
  unreconciledPixCount: number;
  recentTransactions: CashflowTransactionItem[];
}

export async function fetchCashflowSummaryAction(): Promise<{
  ok: boolean;
  data?: CashflowSummary;
  error?: string;
}> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "No active organization" };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("financial_records")
    .select("*")
    .eq("organization_id", activeOrg.orgId);

  if (error) {
    return { ok: false, error: error.message };
  }

  const records = data || [];

  let currentBalanceCents = 0;
  let projectedInflowCents = 0;
  let projectedOutflowCents = 0;
  let unreconciledPixCount = 0;

  for (const r of records) {
    if (r.status === "cancelled") continue;

    const isProjected = Boolean(r.is_projected || r.status === "pending");

    if (isProjected) {
      if (r.type === "Receita") {
        projectedInflowCents += r.revenue_cents || 0;
      } else {
        projectedOutflowCents += r.expense_cents || 0;
      }
    } else {
      if (r.type === "Receita") {
        currentBalanceCents += r.revenue_cents || 0;
      } else {
        currentBalanceCents -= r.expense_cents || 0;
      }
    }

    if (r.payment_method === "pix" && r.status === "pending") {
      unreconciledPixCount++;
    }
  }

  const projectedBalanceCents = currentBalanceCents + projectedInflowCents - projectedOutflowCents;

  const recentTransactions: CashflowTransactionItem[] = records
    .slice(0, 50)
    .map((r: any) => ({
      id: r.id,
      date: r.date,
      due_date: r.due_date || undefined,
      description: r.description,
      type: r.type,
      category: r.category,
      revenue_cents: r.revenue_cents || 0,
      expense_cents: r.expense_cents || 0,
      net_cents: r.net_cents || (r.revenue_cents - r.expense_cents),
      payment_method: r.payment_method || "pix",
      pix_e2e_id: r.pix_e2e_id || undefined,
      status: r.status || "reconciled",
      is_projected: Boolean(r.is_projected),
    }));

  return {
    ok: true,
    data: {
      currentBalanceCents,
      projectedInflowCents,
      projectedOutflowCents,
      projectedBalanceCents,
      unreconciledPixCount,
      recentTransactions,
    },
  };
}

export interface ReconcilePixTransactionParams {
  transaction_id: string;
  pix_e2e_id?: string;
}

export async function reconcilePixTransactionAction(params: ReconcilePixTransactionParams) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "No active organization" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false, error: denied };

  const supabase = await createClient();

  const { error } = await supabase
    .from("financial_records")
    .update({
      status: "reconciled",
      is_projected: false,
      pix_e2e_id: params.pix_e2e_id || null,
      reconciled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", activeOrg.orgId)
    .eq("id", params.transaction_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
