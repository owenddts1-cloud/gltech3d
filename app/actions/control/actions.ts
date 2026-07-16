"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { revalidatePath } from "next/cache";

export interface FinancialRecord {
  id: string;
  date: string;         // 'YYYY-MM-DD'
  month: string;        // 'FEV.', 'MAR.', etc.
  quantity: number;
  description: string;
  type: 'Receita' | 'Despesa';
  /** Rótulo livre (Venda, Insumo, Filamentos, Ferramentas, ...). Absorveu a antiga
   *  coluna `classification`, que era presa a Venda/Insumo/Outro por check constraint. */
  category: string;
  revenue: number;      // raw value in R$, e.g. 100.00
  expense: number;      // raw value in R$, e.g. 3808.30
  installments: string; // e.g. '12'
  platform?: string;    // e.g. B2B, Shopee, Facebook, Mercado Livre, TikTok Shop, Olx
  // User-defined columns. The grid only ever writes strings into these, but the jsonb column
  // can hold anything a previous version wrote, so readers must narrow before use.
  custom_fields?: Record<string, unknown>;
}

export async function fetchFinancialRecords(): Promise<{ ok: false; error?: string } | { ok: true; data: FinancialRecord[] }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "No active organization" };

  const supabase = await createClient();
  
  // Fetch current records
  const { data, error } = await supabase
    .from("financial_records")
    .select("*")
    .eq("organization_id", activeOrg.orgId)
    .order("date", { ascending: false });

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    data: (data ?? []).map(r => ({
      id: r.id,
      date: r.date,
      month: r.month,
      quantity: r.quantity,
      description: r.description,
      type: r.type as 'Receita' | 'Despesa',
      category: r.category,
      revenue: r.revenue_cents / 100,
      expense: r.expense_cents / 100,
      installments: r.installments || "",
      platform: r.platform || "",
      custom_fields: r.custom_fields || {}
    }))
  };
}

export async function saveFinancialRecords(
  records: Partial<FinancialRecord>[]
): Promise<{ ok: false; error: string } | { ok: true; idMap: Record<string, string> }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "No active organization" };

  const supabase = await createClient();

  // Rows still carrying a client-side 'temp-' id have never been persisted. Mint their uuid here
  // instead of letting the default fill it in, so the caller can swap the temp id for the real one.
  // Without that swap the next save re-inserts the same row under yet another uuid.
  const idMap: Record<string, string> = {};

  const upsertPayload = records.map(r => {
    // Determine type automatically from values or vice-versa
    const type = r.type || (r.revenue && r.revenue > 0 ? 'Receita' : 'Despesa');
    const revenueCents = r.revenue !== undefined ? Math.round(Number(r.revenue) * 100) : 0;
    const expenseCents = r.expense !== undefined ? Math.round(Number(r.expense) * 100) : 0;

    let id = r.id;
    if (!id || id.startsWith("temp-")) {
      const newId = randomUUID();
      if (id) idMap[id] = newId;
      id = newId;
    }

    return {
      id,
      organization_id: activeOrg.orgId,
      date: r.date || new Date().toISOString().split('T')[0],
      month: r.month || "FEV.",
      quantity: r.quantity ?? 1,
      description: r.description || "",
      type,
      category: r.category || "Outros",
      revenue_cents: revenueCents,
      expense_cents: expenseCents,
      installments: r.installments || "",
      platform: r.platform || "",
      custom_fields: r.custom_fields || {},
      created_by: authUser.id,
      updated_at: new Date().toISOString()
    };
  });

  const { error } = await supabase
    .from("financial_records")
    .upsert(upsertPayload);

  if (error) {
    console.error("Save financial records error:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/app/control");
  return { ok: true, idMap };
}

export async function deleteFinancialRecord(id: string): Promise<{ ok: boolean; error?: string }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "No active organization" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("financial_records")
    .delete()
    .eq("organization_id", activeOrg.orgId)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/control");
  return { ok: true };
}
