"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import {
  consumableCreateSchema, consumablePatchSchema, type ConsumableCategory,
} from "@/lib/schemas/consumables";
import { revalidatePath } from "next/cache";

export interface ConsumableView {
  id: string;
  name: string;
  category: ConsumableCategory;
  material: string;
  color: string;
  stockGrams: number;
  minStockGrams: number;
  costPerKgCents: number;
  supplier: string;
  notes: string;
  /** Estoque no ou abaixo do mínimo. */
  low: boolean;
  /** Valor imobilizado neste consumível (estoque × custo). */
  stockValueCents: number;
}

export interface ConsumablesData {
  items: ConsumableView[];
  kpis: {
    total: number;             // linhas
    lowStock: number;          // itens no/abaixo do mínimo
    stockValueCents: number;   // capital em consumíveis
    totalKg: number;           // soma do estoque em kg
  };
}

interface Row {
  id: string; name: string; category: ConsumableCategory;
  material: string | null; color: string | null;
  stock_grams: number | string; min_stock_grams: number | string;
  cost_per_kg_cents: number | string; supplier: string | null; notes: string | null;
}

const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);

export async function fetchConsumables(): Promise<{ ok: false } | { ok: true; data: ConsumablesData }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consumables")
    .select("*")
    .eq("organization_id", activeOrg.orgId)
    .order("name", { ascending: true });
  if (error) return { ok: false };

  const items: ConsumableView[] = ((data as Row[] | null) ?? []).map((r) => {
    const stockGrams = num(r.stock_grams);
    const minStockGrams = num(r.min_stock_grams);
    const costPerKgCents = num(r.cost_per_kg_cents);
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      material: r.material ?? "",
      color: r.color ?? "",
      stockGrams,
      minStockGrams,
      costPerKgCents,
      supplier: r.supplier ?? "",
      notes: r.notes ?? "",
      low: minStockGrams > 0 && stockGrams <= minStockGrams,
      stockValueCents: Math.round((stockGrams / 1000) * costPerKgCents),
    };
  });

  return {
    ok: true,
    data: {
      items,
      kpis: {
        total: items.length,
        lowStock: items.filter((i) => i.low).length,
        stockValueCents: items.reduce((s, i) => s + i.stockValueCents, 0),
        totalKg: Math.round(items.reduce((s, i) => s + i.stockGrams, 0) / 1000 * 10) / 10,
      },
    },
  };
}

export async function createConsumable(raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const parsed = consumableCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("consumables").insert({
    organization_id: activeOrg.orgId,
    name: d.name,
    category: d.category,
    material: d.material || null,
    color: d.color || null,
    stock_grams: d.stockGrams,
    min_stock_grams: d.minStockGrams,
    cost_per_kg_cents: Math.round((d.costPerKg ?? 0) * 100),
    supplier: d.supplier || null,
    notes: d.notes || null,
    created_by: authUser.id,
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/consumables");
  return { ok: true as const };
}

export async function updateConsumable(id: string, raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const parsed = consumablePatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const d = parsed.data;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (d.name !== undefined) patch.name = d.name;
  if (d.category !== undefined) patch.category = d.category;
  if (d.material !== undefined) patch.material = d.material || null;
  if (d.color !== undefined) patch.color = d.color || null;
  if (d.stockGrams !== undefined) patch.stock_grams = d.stockGrams;
  if (d.minStockGrams !== undefined) patch.min_stock_grams = d.minStockGrams;
  if (d.costPerKg !== undefined) patch.cost_per_kg_cents = Math.round(d.costPerKg * 100);
  if (d.supplier !== undefined) patch.supplier = d.supplier || null;
  if (d.notes !== undefined) patch.notes = d.notes || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("consumables")
    .update(patch)
    .eq("organization_id", activeOrg.orgId)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/consumables");
  return { ok: true as const };
}

export async function deleteConsumable(id: string) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("consumables")
    .delete()
    .eq("organization_id", activeOrg.orgId)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/consumables");
  return { ok: true as const };
}
