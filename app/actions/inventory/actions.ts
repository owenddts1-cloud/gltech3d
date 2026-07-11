"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import {
  inventoryAssetCreateSchema,
  inventoryAssetPatchSchema,
  type InventoryCategory,
  type InventoryStatus,
} from "@/lib/schemas/inventory";
import { revalidatePath } from "next/cache";

export interface InventoryAssetView {
  id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  purchaseValueCents: number;      // unitário
  purchaseDate: string | null;
  usefulLifeMonths: number;
  status: InventoryStatus;
  notes: string;
  /** valor de compra total (unitário × quantidade) */
  totalValueCents: number;
  /** valor atual depreciado (linear), total */
  currentValueCents: number;
}

export interface InventoryData {
  assets: InventoryAssetView[];
  kpis: {
    totalAssets: number;         // soma de quantidade
    patrimonyCents: number;      // soma do valor atual (depreciado)
    printers: number;            // itens categoria impressora (linhas)
    maintenance: number;         // itens em manutenção (linhas)
  };
}

interface AssetRow {
  id: string; name: string; category: InventoryCategory; quantity: number | string;
  purchase_value_cents: number | string; purchase_date: string | null;
  useful_life_months: number | string; status: InventoryStatus; notes: string | null;
}

const num = (v: unknown) => (v == null ? 0 : Number(v));

/** Fator remanescente da depreciação linear (0..1). */
function remainingFactor(purchaseDate: string | null, usefulLifeMonths: number): number {
  if (!purchaseDate || usefulLifeMonths <= 0) return 1;
  const start = new Date(purchaseDate).getTime();
  if (Number.isNaN(start)) return 1;
  const monthsElapsed = (Date.now() - start) / (1000 * 60 * 60 * 24 * 30.4375);
  return Math.max(0, Math.min(1, 1 - monthsElapsed / usefulLifeMonths));
}

function mapRow(r: AssetRow): InventoryAssetView {
  const qty = Math.max(1, Math.round(num(r.quantity)));
  const unit = num(r.purchase_value_cents);
  const life = Math.max(1, Math.round(num(r.useful_life_months)));
  const totalValueCents = unit * qty;
  const currentValueCents = Math.round(totalValueCents * remainingFactor(r.purchase_date, life));
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    quantity: qty,
    purchaseValueCents: unit,
    purchaseDate: r.purchase_date,
    usefulLifeMonths: life,
    status: r.status,
    notes: r.notes ?? "",
    totalValueCents,
    currentValueCents,
  };
}

export async function fetchInventoryData(): Promise<{ ok: false } | { ok: true; data: InventoryData }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false };

  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory_assets")
    .select("id, name, category, quantity, purchase_value_cents, purchase_date, useful_life_months, status, notes")
    .order("created_at", { ascending: false });

  const assets = ((data as AssetRow[] | null) ?? []).map(mapRow);
  const kpis = {
    totalAssets: assets.reduce((s, a) => s + a.quantity, 0),
    patrimonyCents: assets.reduce((s, a) => s + a.currentValueCents, 0),
    printers: assets.filter((a) => a.category === "impressora").length,
    maintenance: assets.filter((a) => a.status === "manutencao").length,
  };

  return { ok: true, data: { assets, kpis } };
}

export async function createInventoryAsset(raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const parsed = inventoryAssetCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_assets").insert({
    organization_id: activeOrg.orgId,
    name: d.name,
    category: d.category,
    quantity: d.quantity,
    purchase_value_cents: Math.round((d.purchaseValue ?? 0) * 100),
    purchase_date: d.purchaseDate || null,
    useful_life_months: d.usefulLifeMonths,
    status: d.status,
    notes: d.notes || null,
    created_by: authUser.id,
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/inventory");
  return { ok: true as const };
}

export async function updateInventoryAsset(id: string, raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const parsed = inventoryAssetPatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const d = parsed.data;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (d.name !== undefined) patch.name = d.name;
  if (d.category !== undefined) patch.category = d.category;
  if (d.quantity !== undefined) patch.quantity = d.quantity;
  if (d.purchaseValue !== undefined) patch.purchase_value_cents = Math.round(d.purchaseValue * 100);
  if (d.purchaseDate !== undefined) patch.purchase_date = d.purchaseDate || null;
  if (d.usefulLifeMonths !== undefined) patch.useful_life_months = d.usefulLifeMonths;
  if (d.status !== undefined) patch.status = d.status;
  if (d.notes !== undefined) patch.notes = d.notes || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_assets")
    .update(patch)
    .eq("organization_id", activeOrg.orgId)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/inventory");
  return { ok: true as const };
}

export async function deleteInventoryAsset(id: string) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_assets")
    .delete()
    .eq("organization_id", activeOrg.orgId)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/inventory");
  return { ok: true as const };
}
