/**
 * Converte o estado de edição (linhas cruas de `products`) no view model que a
 * landing consome. Espelha a lógica de `repository.ts`, mas roda no cliente para
 * o Live Preview atualizar sem ida ao servidor.
 *
 * Pura de propósito: sem I/O, testável, e é a única tradução rascunho → vitrine.
 */
import type {
  BestsellerRank,
  LandingCatalog,
  LandingProduct,
  LandingSection,
  ProductLinks,
} from '@/lib/landing/types';
import type { LandingProductAdmin } from '@/app/actions/landing/actions';

const PHOTO_PENDING_IMAGE = '/images/placeholder-model.svg';

function asLinks(raw: Record<string, string> | undefined): ProductLinks {
  if (!raw) return {};
  const pick = (k: string): string | undefined => (raw[k] ? raw[k] : undefined);
  return {
    shopee: pick('shopee'),
    mercadoLivre: pick('mercadoLivre'),
    whatsapp: pick('whatsapp'),
    instagram: pick('instagram'),
  };
}

function isRank(v: number | null): v is BestsellerRank {
  return v === 1 || v === 2 || v === 3;
}

export function adminToLandingProduct(
  p: LandingProductAdmin,
  fallbackLinks: ProductLinks,
): LandingProduct {
  return {
    id: p.id,
    slug: p.slug ?? p.id,
    name: p.name,
    description: p.description ?? '',
    price: (p.salePriceCents ?? 0) / 100,
    priceRange: p.priceRange ?? undefined,
    category: p.category ?? 'Outros',
    image: p.images[0] ?? PHOTO_PENDING_IMAGE,
    images: p.images,
    videos: p.videos,
    isTop: p.isTop,
    bestsellerRank: isRank(p.bestsellerRank) ? p.bestsellerRank : undefined,
    heroCopy: p.heroCopy ?? undefined,
    pendingPhoto: p.images.length === 0,
    material: p.material ?? 'PLA Premium',
    dimensions: p.dimensions ?? 'Sob consulta',
    colors: p.colors,
    links: { ...fallbackLinks, ...asLinks(p.links) },
  };
}

/**
 * Monta o catálogo do preview. Só peças publicadas entram — é o que o visitante
 * veria. Rascunho fica de fora, igual à landing real.
 */
export function buildDraftCatalog(
  products: LandingProductAdmin[],
  settings: { sections: Record<string, LandingSection>; links: Record<string, string> },
): LandingCatalog {
  const globalLinks = asLinks(settings.links);

  const visible = products
    .filter((p) => p.isPublished)
    .sort((a, b) => {
      const ao = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const bo = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      return ao === bo ? a.name.localeCompare(b.name) : ao - bo;
    })
    .map((p) => adminToLandingProduct(p, globalLinks));

  const bestsellers = visible
    .filter((p): p is LandingProduct & { bestsellerRank: BestsellerRank } =>
      p.bestsellerRank !== undefined,
    )
    .sort((a, b) => a.bestsellerRank - b.bestsellerRank);

  return {
    products: visible,
    bestsellers,
    settings: { sections: settings.sections, links: globalLinks },
  };
}
