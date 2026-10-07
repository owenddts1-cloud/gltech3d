"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { deleteDeniedMessage } from "@/lib/auth/delete-policy";
import { assertProAccess } from "@/lib/plan/server";
import { fetchPrintersAndFilaments } from "@/app/actions/printers/actions";
import {
  supplierCreateSchema, supplierPurchaseCreateSchema, supplierUpdateSchema, supplierPatchToRow,
  type SupplierCategory,
} from "@/lib/schemas/suppliers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const idSchema = z.string().uuid();

export interface SupplierView {
  id: string;
  name: string;
  category: SupplierCategory;
  contactPerson: string;
  phone: string;
  website: string;
  rating: number;
  avgDeliveryDays: number;
  notes: string;
}

export interface PurchaseView {
  id: string;
  supplierId: string | null;
  supplierName: string;
  itemName: string;
  qty: number;
  unitPriceCents: number;
  purchasedAt: string;
}

export interface FilamentLite {
  id: string;
  name: string;
  material: string;
  costPerGram: number;
  supplier: string;
}

export interface SuppliersData {
  suppliers: SupplierView[];
  purchases: PurchaseView[];
  filaments: FilamentLite[];
}

const num = (v: unknown) => (v == null ? 0 : Number(v));

interface SupplierRow {
  id: string; name: string; category: SupplierCategory; contact_person: string | null;
  phone: string | null; website: string | null; rating: number | string;
  avg_delivery_days: number | string; notes: string | null;
}
interface PurchaseRow {
  id: string; supplier_id: string | null; supplier_name: string; item_name: string;
  qty: number | string; unit_price_cents: number | string; purchased_at: string;
}

export async function fetchSuppliersData(): Promise<{ ok: false } | { ok: true; data: SuppliersData }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false };

  const supabase = await createClient();
  const [supRes, purRes, farm] = await Promise.all([
    supabase.from("suppliers").select("*").order("created_at", { ascending: false }),
    supabase.from("supplier_purchases").select("*").order("purchased_at", { ascending: false }).limit(500),
    fetchPrintersAndFilaments(),
  ]);

  const suppliers: SupplierView[] = ((supRes.data as SupplierRow[] | null) ?? []).map((r) => ({
    id: r.id, name: r.name, category: r.category, contactPerson: r.contact_person ?? "",
    phone: r.phone ?? "", website: r.website ?? "", rating: num(r.rating),
    avgDeliveryDays: num(r.avg_delivery_days), notes: r.notes ?? "",
  }));
  const purchases: PurchaseView[] = ((purRes.data as PurchaseRow[] | null) ?? []).map((r) => ({
    id: r.id, supplierId: r.supplier_id, supplierName: r.supplier_name, itemName: r.item_name,
    qty: num(r.qty), unitPriceCents: num(r.unit_price_cents), purchasedAt: r.purchased_at,
  }));
  const filaments: FilamentLite[] = (farm.ok && farm.filaments ? farm.filaments : []).map((f) => ({
    id: f.id, name: f.name, material: f.material, costPerGram: f.costPerGram, supplier: f.supplier,
  }));

  return { ok: true, data: { suppliers, purchases, filaments } };
}

export async function createSupplier(raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false as const, error: denied };

  const parsed = supplierCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").insert({
    organization_id: activeOrg.orgId,
    name: d.name,
    category: d.category,
    contact_person: d.contactPerson || null,
    phone: d.phone || null,
    website: d.website || null,
    rating: d.rating,
    avg_delivery_days: d.avgDeliveryDays,
    notes: d.notes || null,
    created_by: authUser.id,
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/suppliers");
  return { ok: true as const };
}

export async function updateSupplier(id: string, raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false as const, error: denied };

  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { ok: false as const, error: "Fornecedor inválido" };
  const parsed = supplierUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .update({ ...supplierPatchToRow(parsed.data), updated_at: new Date().toISOString() })
    .eq("organization_id", activeOrg.orgId)
    .eq("id", idParsed.data)
    .select("id");
  if (error) return { ok: false as const, error: error.message };
  if (!data || data.length === 0) return { ok: false as const, error: "Fornecedor não encontrado" };

  revalidatePath("/app/suppliers");
  return { ok: true as const };
}

export async function deleteSupplier(id: string) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false as const, error: denied };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers").delete()
    .eq("organization_id", activeOrg.orgId).eq("id", id)
    .select("id");
  if (error) return { ok: false as const, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false as const, error: deleteDeniedMessage("suppliers") };
  }

  revalidatePath("/app/suppliers");
  return { ok: true as const };
}

export async function createPurchase(raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false as const, error: denied };

  const parsed = supplierPurchaseCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();

  let linkedSupplierId: string | null = null;
  if (d.supplierId) {
    const { data: sup } = await supabase
      .from("suppliers")
      .select("id")
      .eq("organization_id", activeOrg.orgId)
      .eq("id", d.supplierId)
      .maybeSingle();
    if (!sup) return { ok: false as const, error: "Fornecedor inválido" };
    linkedSupplierId = d.supplierId;
  }

  const unitPriceCents = Math.round((d.unitPrice ?? 0) * 100);
  const totalExpenseCents = unitPriceCents * (d.qty || 1);

  // 1. Create corresponding Financial Record expense
  const finId = randomUUID();
  const today = new Date().toISOString().split("T")[0]!;
  const monthNames = ["JAN.", "FEV.", "MAR.", "ABR.", "MAI.", "JUN.", "JUL.", "AGO.", "SET.", "OUT.", "NOV.", "DEZ."];
  const curMonth = monthNames[new Date().getMonth()]!;

  const category = (d.itemName || "").toLowerCase().includes("ferramenta") || (d.itemName || "").toLowerCase().includes("bico") || (d.itemName || "").toLowerCase().includes("peça")
    ? "Ferramentas"
    : "Insumo";

  await supabase.from("financial_records").insert({
    id: finId,
    organization_id: activeOrg.orgId,
    date: today,
    month: curMonth,
    quantity: d.qty,
    description: `[Compra Fornecedor] ${d.itemName} (${d.supplierName})`,
    type: "Despesa",
    category,
    revenue_cents: 0,
    expense_cents: totalExpenseCents,
    platform_fee_cents: 0,
    net_cents: totalExpenseCents,
    status: "reconciled",
    reconciled_at: new Date().toISOString(),
    created_by: authUser.id,
  });

  // 2. Insert purchase record linked to financial record
  const { error } = await supabase.from("supplier_purchases").insert({
    organization_id: activeOrg.orgId,
    supplier_id: linkedSupplierId,
    financial_record_id: finId,
    supplier_name: d.supplierName,
    item_name: d.itemName,
    qty: d.qty,
    unit_price_cents: unitPriceCents,
    created_by: authUser.id,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/suppliers");
  revalidatePath("/app/control");
  return { ok: true as const };
}
