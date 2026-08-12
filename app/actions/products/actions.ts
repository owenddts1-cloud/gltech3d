"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { z } from "zod";
import { productCreateSchema, productPatchSchema, type ProductVariationGroup } from "@/lib/schemas/products-catalog";
import {
  toProductRowPatch,
  salePriceCentsAfter,
  publishBlockReason,
  sumExtraCostCents,
  extraCostsFromRow,
} from "@/lib/products/patch";
import { asLinks, inheritedChannels, type LinkChannel } from "@/lib/landing/links";
import { slugifyWithSuffix } from "@/lib/utils/slug";
import { computeProductPricing, type ProductPricingResult } from "@/lib/pricing/engine";
import { revalidateLanding } from "@/lib/landing/repository";
import { revalidatePath } from "next/cache";

/**
 * A vitrine pública lê por `unstable_cache` com tag, não por rota — então
 * `revalidatePath("/")` sozinho NÃO derruba o catálogo, e a peça editada aqui
 * continuava velha no site. `revalidateLanding()` é o caminho canônico
 * (lib/landing/repository.ts) e alcança tanto a home quanto `/product/[slug]`.
 */
function revalidateProductSurfaces(): void {
  revalidatePath("/app/products");
  revalidateLanding();
}

/** Insumo no formato do editor (camelCase). O banco guarda `cost_cents`. */
export interface ExtraCostView { label: string; costCents: number }

/**
 * Visão administrativa completa de uma peça.
 *
 * Traz TODAS as colunas editáveis — antes esta tela expunha só as de custo, e o
 * que estava na vitrine (descrição, links, slug, material) só era editável pelo
 * Landing Edit. `products` é uma tabela só; a visão também.
 */
export interface ProductView {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  categoryId: string | null;
  categoryName: string | null;
  description: string | null;
  heroCopy: string | null;
  // Vitrine
  material: string | null;
  dimensions: string | null;
  priceRange: string | null;
  colors: string[];
  variations: ProductVariationGroup[];
  isTop: boolean;
  isPublished: boolean;
  sortOrder: number | null;
  // Mídia
  images: string[];
  videos: string[];
  // Comercial
  salePriceCents: number | null;
  stockQty: number;
  soldQty: number;
  links: Record<string, string>;
  /** Canais que esta peça herda da loja — a UI mostra como placeholder. */
  inheritedLinkChannels: LinkChannel[];
  // Custo
  filamentClientId: string | null;
  filamentName: string | null;
  filamentGrams: number;
  printTimeSeconds: number;
  printerClientId: string | null;
  /** STL vinculado (0077). Alimenta a estimativa de gramas e tempo. */
  modelId: string | null;
  /** Quando gramas/tempo foram ESTIMADOS pelo fatiador. Nulo = valor informado. */
  costEstimatedAt: string | null;
  /** Perfil usado na estimativa, para a tela não confundir com peso de balança. */
  costEstimateSource: Record<string, unknown>;
  extraCosts: ExtraCostView[];
  extraCostTotal: number; // reais
  marginPct: number;
  // Interno
  observations: string | null;
  buyerProfile: string | null;
  /** Origem do modelo (0073): decide o que pode virar arquivo distribuível. */
  modelSource: "proprio" | "livre" | "terceiro" | "desconhecido";
  modelLicense: string | null;
  pricing: ProductPricingResult;
}

interface FilRow { client_id: string; name: string; cost_per_gram: number | string }
interface PrnRow { client_id: string; name: string; power_draw: number | string; depreciation_per_hour: number | string }
interface CatRow { id: string; name: string; slug: string }

const num = (v: unknown) => (v == null ? 0 : Number(v));
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : [];

export async function fetchProductsData() {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const supabase = await createClient();
  const [prodRes, filRes, prnRes, orgRes, catRes, setRes, modelRes] = await Promise.all([
    supabase.from("products").select("*").order("created_at", { ascending: false }),
    supabase.from("filaments").select("client_id, name, cost_per_gram"),
    supabase.from("printers").select("client_id, name, power_draw, depreciation_per_hour"),
    supabase.from("organizations").select("settings").eq("id", activeOrg.orgId).single(),
    supabase.from("categories").select("id, name, slug").order("sort_order", { ascending: true }),
    // Links globais da loja: o formulário mostra o que a peça vai HERDAR se o
    // campo ficar vazio, em vez de deixar o usuário adivinhar.
    supabase.from("landing_settings").select("links").eq("organization_id", activeOrg.orgId).maybeSingle(),
    // STL do repositório, para o seletor de modelo da ficha. Só os que têm
    // geometria: oferecer imagem ou 3MF no seletor só produziria erro no clique.
    supabase
      .from("models_3d")
      .select("id, name, triangles")
      .eq("organization_id", activeOrg.orgId)
      .eq("kind", "stl")
      .gt("triangles", 0)
      .order("name"),
  ]);

  const filaments = ((filRes.data as FilRow[] | null) ?? []);
  const printers = ((prnRes.data as PrnRow[] | null) ?? []);
  const filMap = new Map(filaments.map((f) => [f.client_id, f]));
  const prnMap = new Map(printers.map((p) => [p.client_id, p]));
  const categories = ((catRes.data as CatRow[] | null) ?? []);
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const kEnergy = ((orgRes.data?.settings as Record<string, unknown>)?.k_energy as number) || 0.85;
  const globalLinks = asLinks((setRes.data as { links: unknown } | null)?.links);

  const products = ((prodRes.data as Record<string, unknown>[] | null) ?? []).map((r): ProductView => {
    const fil = r.filament_client_id ? filMap.get(r.filament_client_id as string) : undefined;
    const prn = r.printer_client_id ? prnMap.get(r.printer_client_id as string) : undefined;
    const cat = r.category_id ? catMap.get(r.category_id as string) : undefined;
    const extraCents = sumExtraCostCents(r.extra_costs);
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
      id: r.id as string,
      name: r.name as string,
      slug: str(r.slug),
      category: str(r.category),
      categoryId: str(r.category_id),
      categoryName: cat?.name ?? null,
      description: str(r.description),
      heroCopy: str(r.hero_copy),
      material: str(r.material),
      dimensions: str(r.dimensions),
      priceRange: str(r.price_range),
      colors: strArray(r.colors),
      variations: Array.isArray(r.variations) ? (r.variations as ProductVariationGroup[]) : [],
      isTop: Boolean(r.is_top),
      isPublished: Boolean(r.is_published),
      sortOrder: r.sort_order == null ? null : num(r.sort_order),
      images: strArray(r.images),
      videos: strArray(r.videos),
      salePriceCents: r.sale_price_cents == null ? null : num(r.sale_price_cents),
      stockQty: num(r.stock_qty),
      soldQty: num(r.sold_qty),
      links: asLinks(r.links) as Record<string, string>,
      inheritedLinkChannels: inheritedChannels(globalLinks, r.links),
      filamentClientId: str(r.filament_client_id),
      filamentName: fil?.name ?? null,
      filamentGrams: num(r.filament_grams),
      printTimeSeconds: num(r.print_time_seconds),
      printerClientId: str(r.printer_client_id),
      extraCosts: extraCostsFromRow(r.extra_costs),
      extraCostTotal: extraCents / 100,
      marginPct: num(r.margin_pct),
      observations: str(r.observations),
      // `buyer_profile` chega como undefined enquanto a migration 0069 não for
      // aplicada; `str()` normaliza para null e a tela não quebra.
      buyerProfile: str(r.buyer_profile),
      modelSource:
        r.model_source === "proprio" || r.model_source === "livre" || r.model_source === "terceiro"
          ? r.model_source
          : "desconhecido",
      modelLicense: str(r.model_license),
      // Chegam undefined enquanto a 0077 não for aplicada; normalizados aqui
      // para a tela não quebrar num banco desatualizado.
      modelId: str(r.model_id),
      costEstimatedAt: str(r.cost_estimated_at),
      costEstimateSource:
        typeof r.cost_estimate_source === "object" && r.cost_estimate_source !== null
          ? (r.cost_estimate_source as Record<string, unknown>)
          : {},
      pricing,
    };
  });

  return {
    ok: true as const,
    orgId: activeOrg.orgId,
    products,
    globalLinks: globalLinks as Record<string, string>,
    filaments: filaments.map((f) => ({ id: f.client_id, name: f.name, costPerGram: num(f.cost_per_gram) })),
    printers: printers.map((p) => ({ id: p.client_id, name: p.name })),
    categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    models: ((modelRes.data as Array<{ id: string; name: string; triangles: number }> | null) ?? []).map(
      (m) => ({ id: m.id, name: m.name, triangles: Number(m.triangles) }),
    ),
    /** Alíquota do Simples, para a aba de canais. 0 = não configurada. */
    simplesTaxPct:
      Number((orgRes.data?.settings as Record<string, unknown>)?.simples_tax_pct) || 0,
    kEnergy,
  };
}

/**
 * Resolve o slug de uma peça nova. Sem isso, `createProduct` deixava `slug` nulo
 * e a landing caía no fallback `slug ?? id` — a URL pública virava um UUID.
 *
 * Nome sem nenhum caractere alfanumérico (ex.: "★★★") produz slug vazio; nesse
 * caso devolve `null` e o fallback do repositório assume, que é melhor do que
 * gravar string vazia numa coluna com índice único.
 */
function slugCandidate(name: string, attempt: number): string | null {
  const slug = slugifyWithSuffix(name, attempt);
  return slug.length > 0 ? slug : null;
}

/** Primeira mensagem do Zod — bem mais útil que um "Dados inválidos" genérico. */
function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos";
}

/**
 * Traduz o erro cru do Postgres em algo acionável.
 *
 * `42703` = coluna inexistente. Na prática significa uma migration desta entrega
 * ainda não aplicada — sem esta tradução o usuário veria só
 * `column "buyer_profile" of relation "products" does not exist`.
 */
function humanizeDbError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Esse endereço (slug) já existe em outra peça.";
  if (error.code === "42703") {
    return `Falta aplicar uma migration do banco (${error.message}). Rode: npx supabase db push`;
  }
  return error.message;
}

export async function createProduct(raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const parsed = productCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: firstIssue(parsed.error) };
  const d = parsed.data;

  // Peça nova ainda não tem preço no banco, então o "preço atual" é null.
  const blocked = publishBlockReason(d, null);
  if (blocked) return { ok: false as const, error: blocked };

  const supabase = await createClient();
  const base = toProductRowPatch(d);

  // O índice único de slug é parcial (`where slug is not null`), então o Postgres
  // não infere ON CONFLICT a partir dele — o desempate é por tentativa.
  for (let attempt = 1; attempt <= 5; attempt++) {
    const slug = d.slug ?? slugCandidate(d.name, attempt);
    const { error } = await supabase.from("products").insert({
      ...base,
      organization_id: activeOrg.orgId,
      slug,
      created_by: authUser.id,
    });
    if (!error) {
      revalidateProductSurfaces();
      return { ok: true as const };
    }
    if (error.code !== "23505") return { ok: false as const, error: humanizeDbError(error) };
    // Slug escolhido a dedo pelo usuário não deve ser "consertado" pelas costas.
    if (d.slug) return { ok: false as const, error: "Esse slug já existe em outra peça." };
  }
  return {
    ok: false as const,
    error: "Não consegui gerar um endereço único para esta peça — mude o nome.",
  };
}

export async function updateProduct(id: string, raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const parsed = productPatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: firstIssue(parsed.error) };
  const d = parsed.data;

  const supabase = await createClient();

  // Só consulta o preço atual quando o patch não traz preço próprio.
  let currentCents: number | null = null;
  if (d.isPublished === true && salePriceCentsAfter(d) === undefined) {
    const { data: cur } = await supabase
      .from("products")
      .select("sale_price_cents")
      .eq("organization_id", activeOrg.orgId)
      .eq("id", id)
      .maybeSingle();
    currentCents = (cur as { sale_price_cents: number | null } | null)?.sale_price_cents ?? null;
  }
  const blocked = publishBlockReason(d, currentCents);
  if (blocked) return { ok: false as const, error: blocked };

  const { error } = await supabase
    .from("products")
    .update(toProductRowPatch(d))
    .eq("organization_id", activeOrg.orgId)
    .eq("id", id);
  if (error) return { ok: false as const, error: humanizeDbError(error) };

  revalidateProductSurfaces();
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

  revalidateProductSurfaces();
  return { ok: true as const };
}
