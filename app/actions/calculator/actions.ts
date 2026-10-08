"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";

/** Fetch registered printers and filaments for the calculator dropdowns */
export async function fetchCalculatorData() {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const supabase = await createClient();

  // Printers/filaments now live in dedicated RLS-scoped tables (migration 0028).
  // Queries degrade to [] if the migration hasn't been applied yet.
  const [printersRes, filamentsRes, contactsRes] = await Promise.all([
    supabase.from("printers").select("client_id, name, power_draw, depreciation_per_hour"),
    supabase.from("filaments").select("client_id, name, color, material, cost_per_gram"),
    supabase
      .from("contacts")
      .select("id, name, email, phone:phone_number")
      .eq("organization_id", activeOrg.orgId)
      .order("name", { ascending: true })
      .limit(200),
  ]);

  if (contactsRes.error) return { ok: false as const, error: contactsRes.error.message };

  type PRow = { client_id: string; name: string; power_draw: number | string; depreciation_per_hour: number | string };
  type FRow = { client_id: string; name: string; color: string | null; material: string | null; cost_per_gram: number | string };

  const printers = ((printersRes.data as PRow[] | null) ?? []).map((p) => ({
    id: p.client_id,
    name: p.name,
    powerDraw: Number(p.power_draw ?? 0),
    depreciationPerHour: Number(p.depreciation_per_hour ?? 0),
  }));
  const filaments = ((filamentsRes.data as FRow[] | null) ?? []).map((f) => ({
    id: f.client_id,
    name: f.name,
    color: f.color ?? "",
    material: f.material ?? "",
    costPerGram: Number(f.cost_per_gram ?? 0),
  }));

  return {
    ok: true as const,
    orgId: activeOrg.orgId,
    printers,
    filaments,
    contacts: contactsRes.data || [],
  };
}

export interface CalculatorProposalInput {
  title: string;
  totalRevenue: number;
  quantity: number;
  weightGrams: number;
  printHours: number;
  contactId?: string;
}

export async function saveCalculatorProposal(input: CalculatorProposalInput) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_orders")
    .insert({
      organization_id: activeOrg.orgId,
      title: input.title || "Orçamento Calc3D",
      status: "orcamento",
      total_cents: Math.round((input.totalRevenue || 0) * 100),
      qty: Math.max(1, input.quantity || 1),
      contact_id: input.contactId || null,
      slicer_notes: {
        weightGrams: input.weightGrams,
        printHours: input.printHours,
        source: "Calc3D Wizard PRO",
      },
    })
    .select("id")
    .single();

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, id: data.id };
}

export async function createCalculatorServiceOrder(input: CalculatorProposalInput) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_orders")
    .insert({
      organization_id: activeOrg.orgId,
      title: input.title || "Ordem de Produção Calc3D",
      status: "em_producao",
      total_cents: Math.round((input.totalRevenue || 0) * 100),
      qty: Math.max(1, input.quantity || 1),
      contact_id: input.contactId || null,
      slicer_notes: {
        weightGrams: input.weightGrams,
        printHours: input.printHours,
        source: "Calc3D Wizard PRO",
      },
    })
    .select("id")
    .single();

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, id: data.id };
}

