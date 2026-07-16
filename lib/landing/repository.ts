/**
 * Leitura da landing pública a partir do Postgres.
 *
 * SOBRE O ADMIN CLIENT: `lib/supabase/admin.ts` proíbe uso em "rota acionada por
 * usuário final em fluxo normal". Esta é uma exceção deliberada e documentada:
 *
 *  - Não há usuário. A landing é anônima; não existe sessão para respeitar.
 *  - O `organization_id` vem de `env.LANDING_ORG_SLUG` — fonte confiável, nunca
 *    do request. A regra que o doc protege ("não resolver org do body") é
 *    obedecida.
 *  - A alternativa (conceder SELECT ao `anon` + RLS) seria pior: a anon key é
 *    pública no browser e `products` guarda filament_grams/extra_costs/
 *    margin_pct. Qualquer pessoa leria a estrutura de custo da operação.
 *  - Defesa em profundidade: as queries listam colunas explicitamente. Mesmo que
 *    alguém exponha isto por engano, as colunas de custo não saem do banco.
 *
 * Cache: `unstable_cache` com tag. O Landing Edit chama `revalidateLanding()`
 * depois de gravar, e a página pública reflete a mudança sem redeploy.
 */

import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type {
  BestsellerRank,
  LandingCatalog,
  LandingProduct,
  LandingSection,
  LandingSectionItem,
  LandingSettings,
  ProductLinks,
} from "@/lib/landing/types";

export const LANDING_CACHE_TAG = "landing-catalog";

/** Placeholder da oficina para peça cadastrada antes da sessão de fotos. */
const PHOTO_PENDING_IMAGE = "/images/placeholder-model.svg";

/**
 * Colunas públicas de `products`. Lista explícita e fechada: acrescentar uma
 * coluna de custo na tabela não a expõe na landing por acidente.
 */
const PUBLIC_PRODUCT_COLUMNS = [
  "id",
  "slug",
  "name",
  "description",
  "category",
  "images",
  "videos",
  "colors",
  "links",
  "material",
  "dimensions",
  "hero_copy",
  "price_range",
  "sale_price_cents",
  "is_top",
  "bestseller_rank",
  "sort_order",
  "created_at",
].join(", ");

interface ProductRow {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  category: string | null;
  images: unknown;
  videos: unknown;
  colors: unknown;
  links: unknown;
  material: string | null;
  dimensions: string | null;
  hero_copy: string | null;
  price_range: string | null;
  sale_price_cents: number | null;
  is_top: boolean;
  bestseller_rank: number | null;
  sort_order: number | null;
  created_at: string;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

function asLinks(value: unknown): ProductLinks {
  if (typeof value !== "object" || value === null) return {};
  const raw = value as Record<string, unknown>;
  const pick = (k: string): string | undefined =>
    typeof raw[k] === "string" && raw[k] ? (raw[k] as string) : undefined;
  return {
    shopee: pick("shopee"),
    mercadoLivre: pick("mercadoLivre"),
    whatsapp: pick("whatsapp"),
    instagram: pick("instagram"),
  };
}

function isBestsellerRank(value: number | null): value is BestsellerRank {
  return value === 1 || value === 2 || value === 3;
}

function toLandingProduct(row: ProductRow, fallbackLinks: ProductLinks): LandingProduct {
  const images = asStringArray(row.images);
  const ownLinks = asLinks(row.links);

  return {
    id: row.id,
    // Peça publicada sem slug seria uma URL quebrada; o id cobre o buraco.
    slug: row.slug ?? row.id,
    name: row.name,
    description: row.description ?? "",
    price: (row.sale_price_cents ?? 0) / 100,
    priceRange: row.price_range ?? undefined,
    category: row.category ?? "Outros",
    image: images[0] ?? PHOTO_PENDING_IMAGE,
    images,
    videos: asStringArray(row.videos),
    isTop: row.is_top,
    bestsellerRank: isBestsellerRank(row.bestseller_rank) ? row.bestseller_rank : undefined,
    heroCopy: row.hero_copy ?? undefined,
    pendingPhoto: images.length === 0,
    material: row.material ?? "PLA Premium",
    dimensions: row.dimensions ?? "Sob consulta",
    colors: asStringArray(row.colors),
    // Link próprio do produto vence; o global da org preenche o resto.
    links: { ...fallbackLinks, ...ownLinks },
  };
}

/** Lista da seção vinda do jsonb. Item sem nenhum texto é descartado. */
function asSectionItems(value: unknown): LandingSectionItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const pick = (o: Record<string, unknown>, k: string): string | undefined =>
    typeof o[k] === "string" && o[k] ? (o[k] as string) : undefined;

  const items = value
    .filter((raw): raw is Record<string, unknown> => typeof raw === "object" && raw !== null)
    .map((raw) => ({
      icon: pick(raw, "icon"),
      title: pick(raw, "title"),
      text: pick(raw, "text"),
      author: pick(raw, "author"),
      detail: pick(raw, "detail"),
    }))
    .filter((i) => i.title || i.text);

  return items.length > 0 ? items : undefined;
}

function asSettings(row: { sections: unknown; links: unknown } | null): LandingSettings {
  const sections: Record<string, LandingSection> = {};
  if (row && typeof row.sections === "object" && row.sections !== null) {
    for (const [key, value] of Object.entries(row.sections as Record<string, unknown>)) {
      if (typeof value !== "object" || value === null) continue;
      const v = value as Record<string, unknown>;
      sections[key] = {
        eyebrow: typeof v.eyebrow === "string" ? v.eyebrow : undefined,
        title: typeof v.title === "string" ? v.title : undefined,
        subtitle: typeof v.subtitle === "string" ? v.subtitle : undefined,
        image: typeof v.image === "string" && v.image ? v.image : undefined,
        items: asSectionItems(v.items),
      };
    }
  }
  return { sections, links: asLinks(row?.links) };
}

/** Resolve a org dona da landing pelo slug de env. Lança se não existir. */
export async function resolveLandingOrgId(): Promise<string> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("organizations")
    .select("id")
    .eq("slug", env.LANDING_ORG_SLUG)
    .maybeSingle();

  if (error) throw new Error(`Falha ao resolver a org da landing: ${error.message}`);
  if (!data) {
    throw new Error(
      `Nenhuma organização com slug "${env.LANDING_ORG_SLUG}" (env LANDING_ORG_SLUG).`,
    );
  }
  return data.id as string;
}

async function fetchCatalog(): Promise<LandingCatalog> {
  const db = createAdminClient();
  const organizationId = await resolveLandingOrgId();

  const [productsRes, settingsRes] = await Promise.all([
    db
      .from("products")
      .select(PUBLIC_PRODUCT_COLUMNS)
      .eq("organization_id", organizationId)
      .eq("is_published", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    db
      .from("landing_settings")
      .select("sections, links")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);

  if (productsRes.error) throw new Error(`Catálogo da landing: ${productsRes.error.message}`);
  if (settingsRes.error) throw new Error(`Settings da landing: ${settingsRes.error.message}`);

  const settings = asSettings(settingsRes.data as { sections: unknown; links: unknown } | null);
  const rows = (productsRes.data ?? []) as unknown as ProductRow[];
  const products = rows.map((row) => toLandingProduct(row, settings.links));

  const bestsellers = products
    .filter((p): p is LandingProduct & { bestsellerRank: BestsellerRank } =>
      p.bestsellerRank !== undefined,
    )
    .sort((a, b) => a.bestsellerRank - b.bestsellerRank);

  return { products, bestsellers, settings };
}

/**
 * Catálogo público, cacheado até `revalidateLanding()` invalidar a tag.
 * Sem isto, cada visita da landing bateria no Postgres.
 */
export const getLandingCatalog = unstable_cache(fetchCatalog, ["landing-catalog"], {
  tags: [LANDING_CACHE_TAG],
});

/** Chamado pelas Server Actions do Landing Edit após gravar. */
export function revalidateLanding(): void {
  revalidateTag(LANDING_CACHE_TAG);
}
