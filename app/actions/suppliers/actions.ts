"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { fetchPrintersAndFilaments } from "@/app/actions/printers/actions";
import {
  supplierCreateSchema, supplierPurchaseCreateSchema, type SupplierCategory,
} from "@/lib/schemas/suppliers";
import { revalidatePath } from "next/cache";

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

export async function deleteSupplier(id: string) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers").delete()
    .eq("organization_id", activeOrg.orgId).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/suppliers");
  return { ok: true as const };
}

export async function createPurchase(raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const parsed = supplierPurchaseCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();

  // Se veio supplierId, confirme que pertence a ESTA org antes de vincular
  // (evita ligar a compra a um fornecedor de outro tenant). RLS já esconde a
  // linha; aqui reforçamos a integridade do vínculo.
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

  const { error } = await supabase.from("supplier_purchases").insert({
    organization_id: activeOrg.orgId,
    supplier_id: linkedSupplierId,
    supplier_name: d.supplierName,
    item_name: d.itemName,
    qty: d.qty,
    unit_price_cents: Math.round((d.unitPrice ?? 0) * 100),
    created_by: authUser.id,
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/suppliers");
  return { ok: true as const };
}
