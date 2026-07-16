"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { computeProductPricing, type ProductPricingResult } from "@/lib/pricing/engine";
import { revalidateLanding } from "@/lib/landing/repository";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import {
  bestsellerRankSchema,
  commissionPatchSchema,
  createLandingProductSchema,
  landingProductPatchSchema,
  landingSettingsPatchSchema,
  renameCategorySchema,
  reassignCategorySchema,
  PLATFORMS,
} from "@/lib/schemas/landing-edit";
import type { LandingSection } from "@/lib/landing/types";

/**
 * Server Actions do Landing Edit.
 *
 * Toda action: autentica → resolve a org da sessão (nunca do body) → valida com
 * Zod → grava com o client que respeita RLS → invalida o cache da landing
 * pública (`revalidateLanding`) para a edição ir ao ar sem redeploy.
 * O audit log sai do trigger `trg_products_audit` (migration 0030).
 */

export interface LandingProductAdmin {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  category: string | null;
  heroCopy: string | null;
  priceRange: string | null;
  material: string | null;
  dimensions: string | null;
  salePriceCents: number | null;
  colors: string[];
  images: string[];
  videos: string[];
  links: Record<string, string>;
  isPublished: boolean;
  isTop: boolean;
  bestsellerRank: number | null;
  sortOrder: number | null;
  stockQty: number;
  soldQty: number;
  filamentClientId: string | null;
  filamentGrams: number;
  printTimeMinutes: number;
  printerClientId: string | null;
  extraCost: number;
  marginPct: number;
  pricing: ProductPricingResult;
}

export interface PlatformCommission {
  platform: string;
  commissionPct: number;
}

const num = (v: number | string | null | undefined): number => (v == null ? 0 : Number(v));
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

interface Ctx {
  orgId: string;
  userId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

async function requireCtx(): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "Nenhuma organização ativa" };
  return {
    ok: true,
    ctx: { orgId: activeOrg.orgId, userId: authUser.id, supabase: await createClient() },
  };
}

/** Invalida a landing pública e a própria tela de edição. */
function refresh(): void {
  revalidateLanding();
  revalidatePath("/app/landing-edit");
}

export async function fetchLandingEditData() {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };
  const { supabase, orgId } = c.ctx;

  const [prodRes, filRes, prnRes, orgRes, setRes, comRes] = await Promise.all([
    supabase.from("products").select("*").order("sort_order", { ascending: true, nullsFirst: false }),
    supabase.from("filaments").select("client_id, name, cost_per_gram"),
    supabase.from("printers").select("client_id, name, power_draw, depreciation_per_hour"),
    supabase.from("organizations").select("settings").eq("id", orgId).single(),
    supabase.from("landing_settings").select("sections, links").eq("organization_id", orgId).maybeSingle(),
    supabase.from("platform_commissions").select("platform, commission_pct").eq("organization_id", orgId),
  ]);

  if (prodRes.error) return { ok: false as const, error: prodRes.error.message };

  const filaments = (filRes.data ?? []) as { client_id: string; name: string; cost_per_gram: number | string }[];
  const printers = (prnRes.data ?? []) as {
    client_id: string; name: string; power_draw: number | string; depreciation_per_hour: number | string;
  }[];
  const filMap = new Map(filaments.map((f) => [f.client_id, f]));
  const prnMap = new Map(printers.map((p) => [p.client_id, p]));
  // Tarifa de energia da org (R$/kWh) — mesma fonte que /app/products usa.
  const kEnergy = ((orgRes.data?.settings as Record<string, unknown>)?.k_energy as number) || 0.85;

  const products: LandingProductAdmin[] = (prodRes.data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const fil = row.filament_client_id ? filMap.get(row.filament_client_id as string) : undefined;
    const prn = row.printer_client_id ? prnMap.get(row.printer_client_id as string) : undefined;
    const extras = Array.isArray(row.extra_costs)
      ? (row.extra_costs as { label: string; cost_cents: number }[])
      : [];
    const extraCents = extras.reduce((s, e) => s + num(e.cost_cents), 0);

    return {
      id: row.id as string,
      slug: (row.slug as string | null) ?? null,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      category: (row.category as string | null) ?? null,
      heroCopy: (row.hero_copy as string | null) ?? null,
      priceRange: (row.price_range as string | null) ?? null,
      material: (row.material as string | null) ?? null,
      dimensions: (row.dimensions as string | null) ?? null,
      salePriceCents: row.sale_price_cents == null ? null : num(row.sale_price_cents as number),
      colors: strArray(row.colors),
      images: strArray(row.images),
      videos: strArray(row.videos),
      links: (typeof row.links === "object" && row.links !== null ? row.links : {}) as Record<string, string>,
      isPublished: Boolean(row.is_published),
      isTop: Boolean(row.is_top),
      bestsellerRank: row.bestseller_rank == null ? null : num(row.bestseller_rank as number),
      sortOrder: row.sort_order == null ? null : num(row.sort_order as number),
      stockQty: num(row.stock_qty as number),
      soldQty: num(row.sold_qty as number),
      filamentClientId: (row.filament_client_id as string | null) ?? null,
      filamentGrams: num(row.filament_grams as number),
      printTimeMinutes: Math.round(num(row.print_time_seconds as number) / 60),
      printerClientId: (row.printer_client_id as string | null) ?? null,
      extraCost: extraCents / 100,
      marginPct: num(row.margin_pct as number),
      pricing: computeProductPricing({
        filamentGrams: num(row.filament_grams as number),
        costPerGram: fil ? num(fil.cost_per_gram) : 0,
        printTimeSeconds: num(row.print_time_seconds as number),
        kEnergy,
        powerDraw: prn ? num(prn.power_draw) : 200,
        depreciationPerHour: prn ? num(prn.depreciation_per_hour) : 0.4,
        extraCostCents: extraCents,
        marginPct: num(row.margin_pct as number),
      }),
    };
  });

  const commissionRows = (comRes.data ?? []) as { platform: string; commission_pct: number | string }[];
  const byPlatform = new Map(commissionRows.map((r) => [r.platform, num(r.commission_pct)]));
  // Garante as 7 na UI mesmo se a org tiver sido criada antes da 0041.
  const commissions: PlatformCommission[] = PLATFORMS.map((platform) => ({
    platform,
    commissionPct: byPlatform.get(platform) ?? 0,
  }));

  const settingsRow = setRes.data as { sections: unknown; links: unknown } | null;

  // A landing pública serve UMA org (env.LANDING_ORG_SLUG). Se a org ativa da
  // sessão for outra, esta tela edita um catálogo que não está no ar — o preview
  // mostraria uma coisa e o site outra. Avisa em vez de enganar.
  const { data: orgRow } = await supabase.from("organizations").select("slug").eq("id", orgId).single();
  const landingOrgSlug = env.LANDING_ORG_SLUG;
  const orgMismatch = orgRow?.slug !== landingOrgSlug ? (orgRow?.slug ?? null) : null;

  return {
    ok: true as const,
    orgMismatch,
    landingOrgSlug,
    products,
    commissions,
    settings: {
      sections: (settingsRow?.sections ?? {}) as Record<string, LandingSection>,
      links: (settingsRow?.links ?? {}) as Record<string, string>,
    },
    filaments: filaments.map((f) => ({ id: f.client_id, name: f.name, costPerGram: num(f.cost_per_gram) })),
    printers: printers.map((p) => ({ id: p.client_id, name: p.name })),
    kEnergy,
  };
}

export async function updateLandingProduct(id: string, raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = landingProductPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const d = parsed.data;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (d.name !== undefined) patch.name = d.name;
  if (d.slug !== undefined) patch.slug = d.slug;
  if (d.description !== undefined) patch.description = d.description || null;
  if (d.category !== undefined) patch.category = d.category || null;
  if (d.heroCopy !== undefined) patch.hero_copy = d.heroCopy || null;
  if (d.priceRange !== undefined) patch.price_range = d.priceRange || null;
  if (d.material !== undefined) patch.material = d.material || null;
  if (d.dimensions !== undefined) patch.dimensions = d.dimensions || null;
  if (d.salePriceCents !== undefined) patch.sale_price_cents = d.salePriceCents;
  if (d.colors !== undefined) patch.colors = d.colors;
  if (d.images !== undefined) patch.images = d.images;
  if (d.videos !== undefined) patch.videos = d.videos;
  if (d.links !== undefined) patch.links = d.links;
  if (d.isTop !== undefined) patch.is_top = d.isTop;
  if (d.stockQty !== undefined) patch.stock_qty = d.stockQty;
  if (d.soldQty !== undefined) patch.sold_qty = d.soldQty;
  if (d.sortOrder !== undefined) patch.sort_order = d.sortOrder;
  if (d.filamentClientId !== undefined) patch.filament_client_id = d.filamentClientId;
  if (d.filamentGrams !== undefined) patch.filament_grams = d.filamentGrams;
  if (d.printTimeMinutes !== undefined) patch.print_time_seconds = Math.round(d.printTimeMinutes * 60);
  if (d.printerClientId !== undefined) patch.printer_client_id = d.printerClientId;
  if (d.extraCost !== undefined) {
    patch.extra_costs = d.extraCost > 0 ? [{ label: "Insumos", cost_cents: Math.round(d.extraCost * 100) }] : [];
  }
  if (d.marginPct !== undefined) patch.margin_pct = d.marginPct;

  // Publicar exige preço: uma peça no ar sem preço vira "R$ 0,00" na vitrine.
  if (d.isPublished !== undefined) {
    if (d.isPublished) {
      const { data: current } = await c.ctx.supabase
        .from("products")
        .select("sale_price_cents")
        .eq("organization_id", c.ctx.orgId)
        .eq("id", id)
        .maybeSingle();
      const priceAfter = d.salePriceCents !== undefined ? d.salePriceCents : current?.sale_price_cents;
      if (priceAfter == null || Number(priceAfter) <= 0) {
        return { ok: false as const, error: "Defina o valor de venda antes de publicar." };
      }
    }
    patch.is_published = d.isPublished;
  }

  const { error } = await c.ctx.supabase
    .from("products")
    .update(patch)
    .eq("organization_id", c.ctx.orgId)
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { ok: false as const, error: "Esse slug já existe em outra peça." };
    return { ok: false as const, error: error.message };
  }

  refresh();
  return { ok: true as const };
}

/**
 * Move uma peça no pódio. O índice único parcial (0041) garante um só produto
 * por degrau, então liberamos o degrau do ocupante antes de gravar — senão o
 * update estoura 23505.
 */
export async function setBestsellerRank(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = bestsellerRankSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const { productId, rank } = parsed.data;
  const { supabase, orgId } = c.ctx;

  if (rank !== null) {
    const { error: clearError } = await supabase
      .from("products")
      .update({ bestseller_rank: null })
      .eq("organization_id", orgId)
      .eq("bestseller_rank", rank)
      .neq("id", productId);
    if (clearError) return { ok: false as const, error: clearError.message };
  }

  const { error } = await supabase
    .from("products")
    .update({ bestseller_rank: rank })
    .eq("organization_id", orgId)
    .eq("id", productId);
  if (error) return { ok: false as const, error: error.message };

  refresh();
  return { ok: true as const };
}

export async function updateLandingSettings(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = landingSettingsPatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const { supabase, orgId, userId } = c.ctx;

  const { data: current } = await supabase
    .from("landing_settings")
    .select("sections, links")
    .eq("organization_id", orgId)
    .maybeSingle();

  const next = {
    organization_id: orgId,
    sections: parsed.data.sections ?? current?.sections ?? {},
    links: parsed.data.links ?? current?.links ?? {},
    created_by: userId,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("landing_settings")
    .upsert(next, { onConflict: "organization_id" });
  if (error) return { ok: false as const, error: error.message };

  refresh();
  return { ok: true as const };
}

export async function updatePlatformCommission(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = commissionPatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };

  const { error } = await c.ctx.supabase.from("platform_commissions").upsert(
    {
      organization_id: c.ctx.orgId,
      platform: parsed.data.platform,
      commission_pct: parsed.data.commissionPct,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,platform" },
  );
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/landing-edit");
  return { ok: true as const };
}

export async function createLandingProduct(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = createLandingProductSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Informe o nome da peça." };

  const { data, error } = await c.ctx.supabase
    .from("products")
    .insert({
      organization_id: c.ctx.orgId,
      name: parsed.data.name,
      category: parsed.data.category || null,
      created_by: c.ctx.userId,
      // Nasce como rascunho: só vai ao ar quando você publicar.
      is_published: false,
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };

  refresh();
  return { ok: true as const, id: data.id as string };
}

export async function deleteLandingProduct(id: string) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const { error } = await c.ctx.supabase
    .from("products")
    .delete()
    .eq("organization_id", c.ctx.orgId)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  refresh();
  return { ok: true as const };
}

/**
 * Categorias não têm tabela própria: são a coluna `products.category` (text).
 * Renomear é update em massa; excluir é reatribuir. Manter assim evita uma
 * tabela de 7 linhas que só existiria para guardar um nome — a doutrina DIRC do
 * repo manda calcular em vez de duplicar.
 */
export async function renameCategory(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = renameCategorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Nome inválido" };
  const { from, to } = parsed.data;
  if (from === to) return { ok: true as const, updated: 0 };

  const { data, error } = await c.ctx.supabase
    .from("products")
    .update({ category: to, updated_at: new Date().toISOString() })
    .eq("organization_id", c.ctx.orgId)
    .eq("category", from)
    .select("id");
  if (error) return { ok: false as const, error: error.message };

  refresh();
  return { ok: true as const, updated: data?.length ?? 0 };
}

/**
 * "Excluir" categoria = mover as peças dela para outra (ou deixar sem nicho).
 * Nunca apaga produto — perder peça por causa de um rótulo seria desastroso.
 */
export async function reassignCategory(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = reassignCategorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };

  const { data, error } = await c.ctx.supabase
    .from("products")
    .update({ category: parsed.data.to || null, updated_at: new Date().toISOString() })
    .eq("organization_id", c.ctx.orgId)
    .eq("category", parsed.data.from)
    .select("id");
  if (error) return { ok: false as const, error: error.message };

  refresh();
  return { ok: true as const, moved: data?.length ?? 0 };
}
