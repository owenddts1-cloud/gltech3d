"use server";

/**
 * Server actions of the filament catalog: products of kind 'filamento' + their
 * 1:1 technical sheet in `product_filament_specs` (migration 0087).
 *
 * Every action: authenticate → resolve the org from the SESSION (never the
 * body) → Zod → write with the user client (RLS is the second fence) filtering
 * `organization_id` AND `kind = 'filamento'` explicitly → audit → invalidate
 * the public catalog (`revalidateLanding`, same tag as the pieces catalog).
 *
 * Writes go through `requireCtx()`, which calls `assertProAccess`
 * (tests/unit/pro-write-gate-coverage.test.ts). Reads use `readCtx()` and stay
 * open after the trial, like the other CRM lists.
 *
 * `kind` is immutable after creation: no action here (or in the pieces
 * actions) ever writes it, so a filament cannot turn into a piece with an
 * orphan sheet.
 *
 * Specs are saved with UPSERT on `product_id`, never delete + insert: deleting
 * a sheet requires manager+ (RLS), and an agent editing a filament would lose it.
 */
import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { assertProAccess } from "@/lib/plan/server";
import { deleteDeniedMessage } from "@/lib/auth/delete-policy";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { revalidateLanding } from "@/lib/landing/repository";
import { slugifyWithSuffix } from "@/lib/utils/slug";
import { buildFilamentTitle } from "@/lib/filament-catalog/title";
import {
  ADMIN_SPEC_COLUMNS,
  asStringArray,
  firstEmbed,
  toSpecView,
} from "@/lib/filament-catalog/mappers";
import {
  filamentAvailabilitySchema,
  filamentCreateSchema,
  filamentIdSchema,
  filamentPatchSchema,
  filamentPublishBlockReason,
  filamentPublishSchema,
  filamentReorderSchema,
  type FilamentPatchInput,
} from "@/lib/filament-catalog/schemas";
import type { FilamentAdmin } from "@/lib/filament-catalog/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface Ctx {
  orgId: string;
  userId: string;
  supabase: Supabase;
}

type CtxResult = { ok: true; ctx: Ctx } | { ok: false; error: string };

export type FilamentActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Read context: authenticated member of the active org. No plan gate. */
async function readCtx(): Promise<CtxResult> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "Nenhuma organização ativa" };
  return { ok: true, ctx: { orgId: activeOrg.orgId, userId: authUser.id, supabase: await createClient() } };
}

/** Write context: read context + PRO plan gate. */
async function requireCtx(): Promise<CtxResult> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "Nenhuma organização ativa" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false, error: denied };
  return { ok: true, ctx: { orgId: activeOrg.orgId, userId: authUser.id, supabase: await createClient() } };
}

const PRODUCT_COLUMNS =
  "id, slug, name, description, images, material, sale_price_cents, is_published, sort_order, stock_qty, sold_qty, created_at, updated_at";
const SELECT = `${PRODUCT_COLUMNS}, product_filament_specs(${ADMIN_SPEC_COLUMNS})`;

interface Row {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  images: unknown;
  material: string | null;
  sale_price_cents: number | string | null;
  is_published: boolean | null;
  sort_order: number | string | null;
  stock_qty: number | string | null;
  sold_qty: number | string | null;
  created_at: string;
  updated_at: string | null;
  product_filament_specs: unknown;
}

function toAdmin(row: Row): FilamentAdmin {
  const specRow = firstEmbed(row.product_filament_specs);
  const spec = toSpecView(specRow, row.material);
  const autoTitle = buildFilamentTitle({
    material: spec.materialName,
    line: spec.line,
    colorName: spec.colorName,
    netWeightG: spec.netWeightG,
    brand: spec.brand,
  });
  return {
    ...spec,
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameIsAuto: autoTitle.length > 0 && autoTitle === row.name,
    description: row.description,
    salePriceCents: row.sale_price_cents == null ? null : Number(row.sale_price_cents),
    images: asStringArray(row.images),
    isPublished: Boolean(row.is_published),
    sortOrder: row.sort_order == null ? null : Number(row.sort_order),
    stockQty: Number(row.stock_qty ?? 0),
    soldQty: Number(row.sold_qty ?? 0),
    notes: typeof specRow?.notes === "string" && specRow.notes ? specRow.notes : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Postgres error → pt-BR message the form can show. */
function humanizeDbError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Esse endereço (slug) já existe em outro produto.";
  // Guards of 0087 (SECURITY DEFINER triggers): material/product of another org.
  if (error.code === "23514") return "Material ou produto inválido para esta organização.";
  if (error.code === "42703" || error.code === "42P01") {
    return `Falta aplicar a migration 0087 do banco (${error.message}). Rode: npx supabase db push`;
  }
  return error.message;
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos";
}

async function loadOne(ctx: Ctx, id: string): Promise<Row | null> {
  const { data, error } = await ctx.supabase
    .from("products")
    .select(SELECT)
    .eq("organization_id", ctx.orgId)
    .eq("kind", "filamento")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    logger.error("filament_load_failed", { orgId: ctx.orgId, code: error.code, details: error.message });
    return null;
  }
  return (data as unknown as Row | null) ?? null;
}

/** materials.name of the org, or an error when the id is not one of its materials. */
async function resolveMaterialName(
  ctx: Ctx,
  materialId: string | null | undefined,
): Promise<{ ok: true; name: string | null } | { ok: false; error: string }> {
  if (!materialId) return { ok: true, name: null };
  const { data, error } = await ctx.supabase
    .from("materials")
    .select("name")
    .eq("organization_id", ctx.orgId)
    .eq("id", materialId)
    .maybeSingle();
  if (error) return { ok: false, error: humanizeDbError(error) };
  if (!data) return { ok: false, error: "Material não encontrado nesta organização." };
  return { ok: true, name: (data as { name: string }).name };
}

type SpecFields = Pick<
  FilamentPatchInput,
  | "materialId"
  | "line"
  | "brand"
  | "colorName"
  | "colorHex"
  | "diameterMm"
  | "netWeightG"
  | "nozzleTempMin"
  | "nozzleTempMax"
  | "bedTempMin"
  | "bedTempMax"
  | "notes"
  | "tdsUrl"
  | "availability"
>;

/** camelCase spec fields present in the input → snake_case columns (absent = untouched). */
function specPatch(d: SpecFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (d.materialId !== undefined) out.material_id = d.materialId;
  if (d.line !== undefined) out.line = d.line;
  if (d.brand !== undefined) out.brand = d.brand;
  if (d.colorName !== undefined) out.color_name = d.colorName;
  if (d.colorHex !== undefined) out.color_hex = d.colorHex;
  if (d.diameterMm !== undefined) out.diameter_mm = d.diameterMm;
  if (d.netWeightG !== undefined) out.net_weight_g = d.netWeightG;
  if (d.nozzleTempMin !== undefined) out.nozzle_temp_min = d.nozzleTempMin;
  if (d.nozzleTempMax !== undefined) out.nozzle_temp_max = d.nozzleTempMax;
  if (d.bedTempMin !== undefined) out.bed_temp_min = d.bedTempMin;
  if (d.bedTempMax !== undefined) out.bed_temp_max = d.bedTempMax;
  if (d.notes !== undefined) out.notes = d.notes;
  if (d.tdsUrl !== undefined) out.tds_url = d.tdsUrl;
  if (d.availability !== undefined) out.availability = d.availability;
  return out;
}

function refresh(): void {
  revalidateLanding();
  revalidatePath("/");
  revalidatePath("/produtos");
  revalidatePath("/filamentos");
  revalidatePath("/app/filamentos");
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** All filaments of the active org (published or not), in the manual order, plus the material options. */
export async function listFilaments(): Promise<
  FilamentActionResult<{ filaments: FilamentAdmin[]; materials: Array<{ id: string; name: string }> }>
> {
  const c = await readCtx();
  if (!c.ok) return c;
  const { supabase, orgId } = c.ctx;

  const [prodRes, matRes] = await Promise.all([
    supabase
      .from("products")
      .select(SELECT)
      .eq("organization_id", orgId)
      .eq("kind", "filamento")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    supabase
      .from("materials")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
  ]);
  if (prodRes.error) return { ok: false, error: humanizeDbError(prodRes.error) };
  if (matRes.error) return { ok: false, error: humanizeDbError(matRes.error) };

  return {
    ok: true,
    filaments: ((prodRes.data ?? []) as unknown as Row[]).map(toAdmin),
    materials: ((matRes.data ?? []) as Array<{ id: string; name: string }>).map((m) => ({
      id: m.id,
      name: m.name,
    })),
  };
}

export async function getFilament(id: string): Promise<FilamentActionResult<{ filament: FilamentAdmin }>> {
  const c = await readCtx();
  if (!c.ok) return c;
  const parsedId = filamentIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Filamento inválido." };
  const row = await loadOne(c.ctx, parsedId.data);
  if (!row) return { ok: false, error: "Filamento não encontrado." };
  return { ok: true, filament: toAdmin(row) };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createFilament(raw: unknown): Promise<FilamentActionResult<{ filament: FilamentAdmin }>> {
  const c = await requireCtx();
  if (!c.ok) return c;
  const { ctx } = c;

  const parsed = filamentCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const d = parsed.data;

  const material = await resolveMaterialName(ctx, d.materialId);
  if (!material.ok) return material;

  const title = buildFilamentTitle({
    material: material.name,
    line: d.line,
    colorName: d.colorName,
    netWeightG: d.netWeightG,
    brand: d.brand,
  });
  const name = d.name ?? title;
  if (name.length < 2) return { ok: false, error: "Informe o material e a cor, ou um nome para o filamento." };

  const blocked = filamentPublishBlockReason(d.isPublished, d.salePriceCents ?? null);
  if (blocked) return { ok: false, error: blocked };

  // New filament goes to the END of the list (fractional order, like the pieces).
  const { data: last } = await ctx.supabase
    .from("products")
    .select("sort_order")
    .eq("organization_id", ctx.orgId)
    .eq("kind", "filamento")
    .not("sort_order", "is", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastOrder = (last as { sort_order: number | string | null } | null)?.sort_order;
  const sortOrder = lastOrder == null ? 1000 : Number(lastOrder) + 1000;

  // The slug index is partial (where slug is not null): ON CONFLICT cannot use
  // it, so collisions are resolved by retrying with a suffix.
  let productId: string | null = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const slug = slugifyWithSuffix(name, attempt) || null;
    const { data, error } = await ctx.supabase
      .from("products")
      .insert({
        organization_id: ctx.orgId,
        kind: "filamento",
        name,
        slug,
        description: d.description ?? null,
        sale_price_cents: d.salePriceCents ?? null,
        images: d.images ?? [],
        is_published: d.isPublished ?? false,
        material: material.name,
        sort_order: sortOrder,
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (!error && data) {
      productId = (data as { id: string }).id;
      break;
    }
    if (error?.code !== "23505") return { ok: false, error: humanizeDbError(error ?? { message: "Falha ao criar" }) };
  }
  if (!productId) return { ok: false, error: "Não consegui gerar um endereço único — mude o nome." };

  const { error: specErr } = await ctx.supabase.from("product_filament_specs").upsert(
    { product_id: productId, organization_id: ctx.orgId, ...specPatch(d) },
    { onConflict: "product_id" },
  );
  if (specErr) {
    // Compensate: the product row without its sheet would be a broken filament.
    // Service role ONLY to undo our own insert, filtered by the session org:
    // the user may be an agent, who cannot delete products under RLS.
    const { error: undoErr } = await createAdminClient()
      .from("products")
      .delete()
      .eq("organization_id", ctx.orgId)
      .eq("kind", "filamento")
      .eq("id", productId);
    if (undoErr) {
      logger.error("filament_create_compensation_failed", {
        orgId: ctx.orgId,
        productId,
        details: undoErr.message,
      });
    }
    return { ok: false, error: humanizeDbError(specErr) };
  }

  await audit({
    action: "filament.created",
    actorUserId: ctx.userId,
    organizationId: ctx.orgId,
    resourceType: "product",
    resourceId: productId,
    metadata: { name, is_published: d.isPublished ?? false, availability: d.availability ?? "em_estoque" },
  });

  refresh();
  const row = await loadOne(ctx, productId);
  if (!row) return { ok: false, error: "Filamento criado, mas não consegui recarregá-lo." };
  return { ok: true, filament: toAdmin(row) };
}

export async function updateFilament(
  id: string,
  raw: unknown,
): Promise<FilamentActionResult<{ filament: FilamentAdmin }>> {
  const c = await requireCtx();
  if (!c.ok) return c;
  const { ctx } = c;

  const parsedId = filamentIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Filamento inválido." };
  const parsed = filamentPatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const d = parsed.data;

  const current = await loadOne(ctx, parsedId.data);
  if (!current) return { ok: false, error: "Filamento não encontrado." };
  const before = toAdmin(current);

  let materialName = before.materialName;
  if (d.materialId !== undefined) {
    const material = await resolveMaterialName(ctx, d.materialId);
    if (!material.ok) return material;
    materialName = material.name;
  }

  // Name: explicit wins; `null` resets to the automatic title; absent follows
  // the sheet only while the current name still IS the automatic title.
  const nextTitle = buildFilamentTitle({
    material: materialName,
    line: d.line !== undefined ? d.line : before.line,
    colorName: d.colorName !== undefined ? d.colorName : before.colorName,
    netWeightG: d.netWeightG !== undefined ? d.netWeightG : before.netWeightG,
    brand: d.brand !== undefined ? d.brand : before.brand,
  });
  let nextName: string | undefined;
  if (typeof d.name === "string") nextName = d.name;
  else if (d.name === null || before.nameIsAuto) nextName = nextTitle;
  if (nextName !== undefined && nextName.length < 2) {
    return { ok: false, error: "Informe o material e a cor, ou um nome para o filamento." };
  }

  const publishedAfter = d.isPublished ?? before.isPublished;
  const priceAfter = d.salePriceCents !== undefined ? d.salePriceCents : before.salePriceCents;
  if (d.isPublished === true || d.salePriceCents !== undefined) {
    const blocked = filamentPublishBlockReason(publishedAfter, priceAfter);
    if (blocked) return { ok: false, error: blocked };
  }

  const productPatch: Record<string, unknown> = {};
  if (nextName !== undefined && nextName !== before.name) productPatch.name = nextName;
  if (d.description !== undefined) productPatch.description = d.description;
  if (d.salePriceCents !== undefined) productPatch.sale_price_cents = d.salePriceCents;
  if (d.images !== undefined) productPatch.images = d.images;
  if (d.isPublished !== undefined) productPatch.is_published = d.isPublished;
  if (d.materialId !== undefined) productPatch.material = materialName;

  if (Object.keys(productPatch).length > 0) {
    productPatch.updated_at = new Date().toISOString();
    const { data, error } = await ctx.supabase
      .from("products")
      .update(productPatch)
      .eq("organization_id", ctx.orgId)
      .eq("kind", "filamento")
      .eq("id", before.id)
      .select("id");
    if (error) return { ok: false, error: humanizeDbError(error) };
    if (!data || data.length === 0) return { ok: false, error: "Filamento não encontrado." };
  }

  const specs = specPatch(d);
  if (Object.keys(specs).length > 0) {
    const { error } = await ctx.supabase
      .from("product_filament_specs")
      .upsert({ product_id: before.id, organization_id: ctx.orgId, ...specs }, { onConflict: "product_id" });
    if (error) return { ok: false, error: humanizeDbError(error) };
  }

  await audit({
    action: "filament.updated",
    actorUserId: ctx.userId,
    organizationId: ctx.orgId,
    resourceType: "product",
    resourceId: before.id,
    metadata: { fields: Object.keys(d) },
  });

  refresh();
  const row = await loadOne(ctx, before.id);
  if (!row) return { ok: false, error: "Filamento salvo, mas não consegui recarregá-lo." };
  return { ok: true, filament: toAdmin(row) };
}

export async function setFilamentAvailability(raw: unknown): Promise<FilamentActionResult<object>> {
  const c = await requireCtx();
  if (!c.ok) return c;
  const { ctx } = c;

  const parsed = filamentAvailabilitySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, availability } = parsed.data;

  // Confirms it is a filament of THIS org before touching the sheet.
  const { data: product, error: readErr } = await ctx.supabase
    .from("products")
    .select("id")
    .eq("organization_id", ctx.orgId)
    .eq("kind", "filamento")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { ok: false, error: humanizeDbError(readErr) };
  if (!product) return { ok: false, error: "Filamento não encontrado." };

  const { error } = await ctx.supabase
    .from("product_filament_specs")
    .upsert({ product_id: id, organization_id: ctx.orgId, availability }, { onConflict: "product_id" });
  if (error) return { ok: false, error: humanizeDbError(error) };

  await audit({
    action: "filament.updated",
    actorUserId: ctx.userId,
    organizationId: ctx.orgId,
    resourceType: "product",
    resourceId: id,
    metadata: { fields: ["availability"], availability },
  });

  refresh();
  return { ok: true };
}

export async function setFilamentPublished(raw: unknown): Promise<FilamentActionResult<object>> {
  const c = await requireCtx();
  if (!c.ok) return c;
  const { ctx } = c;

  const parsed = filamentPublishSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, isPublished } = parsed.data;

  if (isPublished) {
    const { data: cur, error: readErr } = await ctx.supabase
      .from("products")
      .select("sale_price_cents")
      .eq("organization_id", ctx.orgId)
      .eq("kind", "filamento")
      .eq("id", id)
      .maybeSingle();
    if (readErr) return { ok: false, error: humanizeDbError(readErr) };
    if (!cur) return { ok: false, error: "Filamento não encontrado." };
    const price = (cur as { sale_price_cents: number | string | null }).sale_price_cents;
    const blocked = filamentPublishBlockReason(true, price == null ? null : Number(price));
    if (blocked) return { ok: false, error: blocked };
  }

  const { data, error } = await ctx.supabase
    .from("products")
    .update({ is_published: isPublished, updated_at: new Date().toISOString() })
    .eq("organization_id", ctx.orgId)
    .eq("kind", "filamento")
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: humanizeDbError(error) };
  if (!data || data.length === 0) return { ok: false, error: "Filamento não encontrado." };

  await audit({
    action: "filament.updated",
    actorUserId: ctx.userId,
    organizationId: ctx.orgId,
    resourceType: "product",
    resourceId: id,
    metadata: { fields: ["isPublished"], is_published: isPublished },
  });

  refresh();
  return { ok: true };
}

/**
 * Persists a drag in the list. The client computes `writes` with `reorder()`
 * from app/app/(pro)/landing-edit/_lib/order.ts (fractional index: one row in
 * the normal case, the whole list only when it has to rebalance).
 */
export async function reorderFilaments(raw: unknown): Promise<FilamentActionResult<object>> {
  const c = await requireCtx();
  if (!c.ok) return c;
  const { ctx } = c;

  const parsed = filamentReorderSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const now = new Date().toISOString();
  // Sequential on purpose: on a rebalance the error must point where it stopped.
  for (const write of parsed.data.writes) {
    const { data, error } = await ctx.supabase
      .from("products")
      .update({ sort_order: write.sortOrder, updated_at: now })
      .eq("organization_id", ctx.orgId)
      .eq("kind", "filamento")
      .eq("id", write.id)
      .select("id");
    if (error) return { ok: false, error: humanizeDbError(error) };
    if (!data || data.length === 0) return { ok: false, error: "Um filamento da lista não foi encontrado." };
  }

  refresh();
  return { ok: true };
}

export async function deleteFilament(id: string): Promise<FilamentActionResult<object>> {
  const c = await requireCtx();
  if (!c.ok) return c;
  const { ctx } = c;

  const parsedId = filamentIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Filamento inválido." };

  // The sheet goes with the product (on delete cascade). Sales keep their
  // history: marketplace_orders/site_order_items reference with set null.
  const { data, error } = await ctx.supabase
    .from("products")
    .delete()
    .eq("organization_id", ctx.orgId)
    .eq("kind", "filamento")
    .eq("id", parsedId.data)
    .select("id, name");
  if (error) return { ok: false, error: humanizeDbError(error) };
  // RLS (0084): DELETE of products requires manager+; a denied delete removes 0 rows silently.
  if (!data || data.length === 0) return { ok: false, error: deleteDeniedMessage("products") };

  await audit({
    action: "filament.deleted",
    actorUserId: ctx.userId,
    organizationId: ctx.orgId,
    resourceType: "product",
    resourceId: parsedId.data,
    metadata: { name: (data[0] as { name: string }).name },
  });

  refresh();
  return { ok: true };
}
