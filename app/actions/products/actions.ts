"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { productCreateSchema, productPatchSchema } from "@/lib/schemas/products-catalog";
import { computeProductPricing, type ProductPricingResult } from "@/lib/pricing/engine";
import { revalidatePath } from "next/cache";

export interface ExtraCost { label: string; cost_cents: number }

export interface ProductView {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  images: string[];
  filamentClientId: string | null;
  filamentName: string | null;
  filamentGrams: number;
  printTimeSeconds: number;
  printerClientId: string | null;
  extraCosts: ExtraCost[];
  extraCostTotal: number; // reais
  marginPct: number;
  salePriceCents: number | null;
  pricing: ProductPricingResult;
}

interface ProdRow {
  id: string; name: string; category: string | null; description: string | null;
  images: unknown; filament_client_id: string | null; filament_grams: number | string;
  print_time_seconds: number | string; printer_client_id: string | null; extra_costs: unknown;
  margin_pct: number | string; sale_price_cents: number | string | null;
}
interface FilRow { client_id: string; name: string; cost_per_gram: number | string }
interface PrnRow { client_id: string; name: string; power_draw: number | string; depreciation_per_hour: number | string }

const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v));

export async function fetchProductsData() {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const supabase = await createClient();
  const [prodRes, filRes, prnRes, orgRes] = await Promise.all([
    supabase.from("products").select("*").order("created_at", { ascending: false }),
    supabase.from("filaments").select("client_id, name, cost_per_gram"),
    supabase.from("printers").select("client_id, name, power_draw, depreciation_per_hour"),
    supabase.from("organizations").select("settings").eq("id", activeOrg.orgId).single(),
  ]);

  const filaments = ((filRes.data as FilRow[] | null) ?? []);
  const printers = ((prnRes.data as PrnRow[] | null) ?? []);
  const filMap = new Map(filaments.map((f) => [f.client_id, f]));
  const prnMap = new Map(printers.map((p) => [p.client_id, p]));
  const kEnergy = ((orgRes.data?.settings as Record<string, unknown>)?.k_energy as number) || 0.85;

  const products = ((prodRes.data as ProdRow[] | null) ?? []).map((r): ProductView => {
    const fil = r.filament_client_id ? filMap.get(r.filament_client_id) : undefined;
    const prn = r.printer_client_id ? prnMap.get(r.printer_client_id) : undefined;
    const extras = (Array.isArray(r.extra_costs) ? (r.extra_costs as ExtraCost[]) : []);
    const extraCents = extras.reduce((s, e) => s + num(e.cost_cents), 0);
    const pricing = computeProductPricing({
      filamentGrams: num(r.filament_grams),
      costPerGram: fil ? num(fil.cost_per_gram) : 0,
      printTimeSeconds: num(r.print_time_seconds),
      kEnergy,
      powerDraw: prn ? num(prn.power_draw) : 200,
      depreciationPerHour: prn ? num(prn.depreciation_per_hour) : 0.4,
      extraCostCents: extraCents,
      marginPct: num(r.margin_pct),
    });
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      description: r.description,
      images: Array.isArray(r.images) ? (r.images as string[]) : [],
      filamentClientId: r.filament_client_id,
      filamentName: fil?.name ?? null,
      filamentGrams: num(r.filament_grams),
      printTimeSeconds: num(r.print_time_seconds),
      printerClientId: r.printer_client_id,
      extraCosts: extras,
      extraCostTotal: extraCents / 100,
      marginPct: num(r.margin_pct),
      salePriceCents: r.sale_price_cents == null ? null : num(r.sale_price_cents),
      pricing,
    };
  });

  return {
    ok: true as const,
    orgId: activeOrg.orgId,
    products,
    filaments: filaments.map((f) => ({ id: f.client_id, name: f.name, costPerGram: num(f.cost_per_gram) })),
    printers: printers.map((p) => ({ id: p.client_id, name: p.name })),
  };
}

function extrasFromReais(extraCost?: number): ExtraCost[] {
  if (!extraCost || extraCost <= 0) return [];
  return [{ label: "Insumos", cost_cents: Math.round(extraCost * 100) }];
}

export async function createProduct(raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const parsed = productCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    organization_id: activeOrg.orgId,
    name: d.name,
    category: d.category || null,
    description: d.description || null,
    images: d.images ?? [],
    filament_client_id: d.filamentClientId ?? null,
    filament_grams: d.filamentGrams,
    print_time_seconds: Math.round((d.printTimeMinutes ?? 0) * 60),
    printer_client_id: d.printerClientId ?? null,
    extra_costs: extrasFromReais(d.extraCost),
    margin_pct: d.marginPct,
    created_by: authUser.id,
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/products");
  return { ok: true as const };
}

export async function updateProduct(id: string, raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const parsed = productPatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const d = parsed.data;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (d.name !== undefined) patch.name = d.name;
  if (d.category !== undefined) patch.category = d.category || null;
  if (d.description !== undefined) patch.description = d.description || null;
  if (d.images !== undefined) patch.images = d.images;
  if (d.filamentClientId !== undefined) patch.filament_client_id = d.filamentClientId;
  if (d.filamentGrams !== undefined) patch.filament_grams = d.filamentGrams;
  if (d.printTimeMinutes !== undefined) patch.print_time_seconds = Math.round(d.printTimeMinutes * 60);
  if (d.printerClientId !== undefined) patch.printer_client_id = d.printerClientId;
  if (d.extraCost !== undefined) patch.extra_costs = extrasFromReais(d.extraCost);
  if (d.marginPct !== undefined) patch.margin_pct = d.marginPct;

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update(patch)
    .eq("organization_id", activeOrg.orgId)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/products");
  return { ok: true as const };
}

export async function deleteProduct(id: string) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("organization_id", activeOrg.orgId)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/products");
  return { ok: true as const };
}
