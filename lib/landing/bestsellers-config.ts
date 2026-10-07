import type { LandingProduct } from "./types";

export interface BestSellersConfig {
  championSlug?: string;
  secondSlug?: string;
  thirdSlug?: string;
}

export const defaultBestSellersConfig: BestSellersConfig = {
  championSlug: "luminaria-lua-cheia-alta-qualidade",
  secondSlug: "charizard-articulavel",
  thirdSlug: "base-carregadora-relogio-apple-watch",
};

/**
 * Resolve os 3 produtos que ocupam o pódio de "Mais Vendidos":
 * 1. Se o banco tiver produtos com `bestsellerRank` (1, 2, 3), usa eles prioritariamente (ordem manual do CRM).
 * 2. Se o pódio do banco estiver vazio ou faltarem posições, busca pelos slugs configurados em `config`.
 * 3. Faz fallback gracioso para os primeiros produtos disponíveis da lista.
 */
export function resolveBestsellers(
  products: LandingProduct[],
  bestsellersFromDb: LandingProduct[] = [],
  config: BestSellersConfig = defaultBestSellersConfig,
): { champion?: LandingProduct; runnersUp: LandingProduct[] } {
  // 1. Se o banco já tiver o pódio com pelo menos o campeão:
  if (bestsellersFromDb.length > 0) {
    const [champion, ...runnersUp] = bestsellersFromDb;
    return { champion, runnersUp: runnersUp.slice(0, 2) };
  }

  // 2. Tenta encontrar pelos slugs do config
  const bySlug = new Map<string, LandingProduct>();
  for (const p of products) {
    bySlug.set(p.slug, p);
    bySlug.set(p.id, p);
  }

  const champion =
    (config.championSlug ? bySlug.get(config.championSlug) : undefined) ??
    products.find((p) => p.isTop) ??
    products[0];

  const second =
    (config.secondSlug ? bySlug.get(config.secondSlug) : undefined) ??
    products.find((p) => p.id !== champion?.id && p.isTop) ??
    products.find((p) => p.id !== champion?.id);

  const third =
    (config.thirdSlug ? bySlug.get(config.thirdSlug) : undefined) ??
    products.find((p) => p.id !== champion?.id && p.id !== second?.id);

  const runnersUp = [second, third].filter((p): p is LandingProduct => p !== undefined);

  return { champion, runnersUp };
}
