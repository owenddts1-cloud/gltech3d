"use server";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { CatalogProductItem } from "@/lib/catalog/whatsapp-formatter";

export interface CatalogProductDetail extends CatalogProductItem {
  category?: string | null;
  sale_price_cents: number;
  cost_total_cents?: number;
  images?: string[];
  is_published?: boolean;
}

export async function fetchCatalogProducts(): Promise<{
  ok: boolean;
  products: CatalogProductDetail[];
  categories: string[];
  error?: string;
}> {
  try {
    const user = await requireAuth();
    // Active org from the session (the tenant switcher), not "first membership":
    // a user in two orgs would otherwise see the other org's catalog. The old
    // `.eq("revoked_at", null)` also never matched, so this always failed.
    const activeOrg = await resolveActiveOrg(user);
    if (!activeOrg) {
      return { ok: false, products: [], categories: [], error: "Organização não encontrada" };
    }
    // User client: RLS is a second fence on top of the explicit org filter.
    const supabase = await createClient();

    const { data: rows, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        slug,
        category,
        hero_copy,
        sale_price_cents,
        filament_grams,
        extra_costs,
        margin_pct,
        material,
        dimensions,
        stock_qty,
        images,
        is_published,
        bestseller_rank
      `)
      .eq("organization_id", activeOrg.orgId)
      // Pieces only: filaments for sale (0087) have their own catalog.
      .eq("kind", "peca")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error || !rows) {
      return { ok: false, products: [], categories: [], error: error?.message ?? "Falha ao buscar produtos" };
    }

    const categoriesSet = new Set<string>();

    const products: CatalogProductDetail[] = rows.map((r) => {
      if (r.category) categoriesSet.add(r.category);

      let image_url: string | null = null;
      if (Array.isArray(r.images) && r.images.length > 0) {
        image_url = typeof r.images[0] === "string" ? r.images[0] : (r.images[0] as { url?: string })?.url ?? null;
      }

      // Cálculo aproximado de custo base para modo 'custo'
      const grams = Number(r.filament_grams) || 0;
      const filCost = grams * 0.12 * 100; // ~R$120/kg
      const extraCost = Array.isArray(r.extra_costs)
        ? r.extra_costs.reduce((acc: number, item: { costCents?: number }) => acc + (Number(item?.costCents) || 0), 0)
        : 0;
      const cost_total_cents = Math.round(filCost + extraCost) || Math.round(r.sale_price_cents * 0.4);

      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        category: r.category,
        hero_copy: r.hero_copy,
        sale_price_cents: Number(r.sale_price_cents) || 0,
        cost_total_cents,
        material: r.material,
        dimensions: r.dimensions,
        stock_qty: Number(r.stock_qty) || 0,
        is_bestseller: Number(r.bestseller_rank) > 0,
        image_url,
        is_published: !!r.is_published,
      };
    });

    return {
      ok: true,
      products,
      categories: Array.from(categoriesSet).sort(),
    };
  } catch (err) {
    return {
      ok: false,
      products: [],
      categories: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
