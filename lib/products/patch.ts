/**
 * Tradução camelCase (wire) → snake_case (linha de `products`).
 *
 * Módulo PURO: sem `"use server"`, sem I/O, sem Supabase. Existe para ser
 * testável e para haver UM lugar onde essa tradução acontece.
 *
 * POR QUE: a mesma tradução vivia duplicada em `app/actions/products/actions.ts`
 * e `app/actions/landing/actions.ts`, e as duas cópias JÁ tinham divergido — a do
 * Landing Edit tratava `slug`, `videos` e `colors`, a de Produtos não. Editar
 * pela tela "errada" perdia campo silenciosamente.
 *
 * INVARIANTE CENTRAL: chave ausente na entrada NUNCA aparece na saída. É o que
 * torna o autosave por patch parcial seguro — ele manda só o que sujou, e um
 * campo não enviado não pode ser sobrescrito com `null` por acidente.
 *
 * `links` é SUBSTITUIÇÃO, não merge: quem chama precisa mandar o objeto inteiro
 * de canais, senão os não enviados somem. É o comportamento que o Landing Edit
 * já dependia (ele manda `{...product.links, [key]: v}`).
 */

import type { ProductFullPatch } from "@/lib/schemas/products-catalog";

/** Formato do jsonb `products.extra_costs` — snake_case, como está no banco. */
export interface ExtraCostRow {
  label: string;
  cost_cents: number;
}

/** Texto opcional: string vazia vira `null` para não guardar `''` no banco. */
const orNull = (v: string | null | undefined): string | null => (v ? v : null);

export function toProductRowPatch(d: ProductFullPatch): Record<string, unknown> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // ── Identificação ────────────────────────────────────────────────────────
  if (d.name !== undefined) patch.name = d.name;
  if (d.slug !== undefined) patch.slug = d.slug;
  if (d.category !== undefined) patch.category = orNull(d.category);
  if (d.categoryId !== undefined) patch.category_id = d.categoryId;
  if (d.description !== undefined) patch.description = orNull(d.description);
  if (d.heroCopy !== undefined) patch.hero_copy = orNull(d.heroCopy);

  // ── Vitrine ──────────────────────────────────────────────────────────────
  if (d.material !== undefined) patch.material = orNull(d.material);
  if (d.dimensions !== undefined) patch.dimensions = orNull(d.dimensions);
  if (d.colors !== undefined) patch.colors = d.colors;
  if (d.variations !== undefined) patch.variations = d.variations;
  if (d.priceRange !== undefined) patch.price_range = orNull(d.priceRange);
  if (d.isTop !== undefined) patch.is_top = d.isTop;
  if (d.isPublished !== undefined) patch.is_published = d.isPublished;

  // ── Mídia ────────────────────────────────────────────────────────────────
  if (d.images !== undefined) patch.images = d.images;
  if (d.videos !== undefined) patch.videos = d.videos;

  // ── Comercial ────────────────────────────────────────────────────────────
  // Centavos vencem reais: `salePrice` é o formato legado da tela de Produtos.
  if (d.salePriceCents !== undefined) {
    patch.sale_price_cents = d.salePriceCents;
  } else if (d.salePrice !== undefined) {
    patch.sale_price_cents = d.salePrice == null ? null : Math.round(d.salePrice * 100);
  }
  if (d.stockQty !== undefined) patch.stock_qty = d.stockQty;
  if (d.soldQty !== undefined) patch.sold_qty = d.soldQty;
  if (d.links !== undefined) patch.links = d.links;

  // ── Engenharia de custo ──────────────────────────────────────────────────
  if (d.filamentClientId !== undefined) patch.filament_client_id = d.filamentClientId;
  if (d.filamentGrams !== undefined) patch.filament_grams = d.filamentGrams;
  if (d.printTimeMinutes !== undefined) {
    patch.print_time_seconds = Math.round(d.printTimeMinutes * 60);
  }
  if (d.printerClientId !== undefined) patch.printer_client_id = d.printerClientId;
  if (d.marginPct !== undefined) patch.margin_pct = d.marginPct;

  // BOM multi-linha vence a soma legada. Enquanto um caller antigo mandar
  // `extraCost`, ele continua funcionando exatamente como antes.
  if (d.extraCosts !== undefined) {
    patch.extra_costs = d.extraCosts.map(
      (item): ExtraCostRow => ({ label: item.label, cost_cents: item.costCents }),
    );
  } else if (d.extraCost !== undefined) {
    patch.extra_costs =
      d.extraCost > 0 ? [{ label: "Insumos", cost_cents: Math.round(d.extraCost * 100) }] : [];
  }

  // ── Interno ──────────────────────────────────────────────────────────────
  if (d.observations !== undefined) patch.observations = orNull(d.observations);
  if (d.buyerProfile !== undefined) patch.buyer_profile = orNull(d.buyerProfile);

  // ── Ordenação ────────────────────────────────────────────────────────────
  if (d.sortOrder !== undefined) patch.sort_order = d.sortOrder;

  return patch;
}

/**
 * Preço em centavos que a linha terá DEPOIS deste patch, ou `undefined` quando
 * o patch não toca no preço (aí quem chama precisa consultar o valor atual).
 *
 * Existe porque a regra "publicar exige preço" estava escrita duas vezes, uma em
 * reais e outra em centavos, com chances distintas de errar o arredondamento.
 */
export function salePriceCentsAfter(d: ProductFullPatch): number | null | undefined {
  if (d.salePriceCents !== undefined) return d.salePriceCents;
  if (d.salePrice !== undefined) return d.salePrice == null ? null : Math.round(d.salePrice * 100);
  return undefined;
}

/** Mensagem canônica para a única regra de publicação que existe. */
export const PUBLISH_NEEDS_PRICE = "Defina um preço de venda para publicar na landing.";

/**
 * Motivo pelo qual este patch NÃO pode publicar a peça, ou `null` se pode.
 *
 * `currentCents` é o preço que a linha tem hoje — só precisa ser consultado
 * quando o patch não traz preço próprio (`salePriceCentsAfter` devolve
 * `undefined`). Uma peça publicada sem preço aparece como "R$ 0,00" na vitrine.
 */
export function publishBlockReason(
  d: ProductFullPatch,
  currentCents: number | null,
): string | null {
  if (d.isPublished !== true) return null;
  const after = salePriceCentsAfter(d);
  const effective = after === undefined ? currentCents : after;
  return effective == null || effective <= 0 ? PUBLISH_NEEDS_PRICE : null;
}

/** Soma dos insumos em centavos, a partir do jsonb como está no banco. */
export function sumExtraCostCents(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  return raw.reduce<number>((total, item) => {
    if (typeof item !== "object" || item === null) return total;
    const cents = Number((item as { cost_cents?: unknown }).cost_cents);
    return total + (Number.isFinite(cents) ? cents : 0);
  }, 0);
}

/** Insumos do banco → formato do wire (camelCase), para popular o editor. */
export function extraCostsFromRow(raw: unknown): Array<{ label: string; costCents: number }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      label: typeof item.label === "string" ? item.label : "",
      costCents: Number.isFinite(Number(item.cost_cents)) ? Number(item.cost_cents) : 0,
    }));
}
