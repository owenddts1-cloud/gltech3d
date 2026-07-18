/**
 * View model da landing pública. É o contrato entre o repositório (que lê o
 * Postgres) e os componentes de marketing.
 *
 * Repare no que NÃO está aqui: filament_grams, extra_costs, margin_pct,
 * print_time_seconds. A estrutura de custo nunca chega ao browser. O repositório
 * seleciona colunas explicitamente justamente para isso.
 */

import type { ProductVariationGroup } from "@/lib/schemas/products-catalog";

// Re-export: componentes de marketing tipam variações sem importar o módulo Zod.
export type { ProductVariationGroup };

export interface ProductLinks {
  shopee?: string;
  mercadoLivre?: string;
  whatsapp?: string;
  instagram?: string;
}

/** Posição no pódio de vendas. 1 = campeão (bloco grande), 2 e 3 = blocos menores. */
export type BestsellerRank = 1 | 2 | 3;

export interface LandingProduct {
  id: string;
  /** Identificador na URL pública (/product/<slug>). */
  slug: string;
  name: string;
  description: string;
  price: number;
  priceRange?: string;
  category: string;
  /** Primeira imagem da galeria; placeholder quando `pendingPhoto`. */
  image: string;
  images: string[];
  videos: string[];
  isTop: boolean;
  bestsellerRank?: BestsellerRank;
  /** Copy longa do bloco campeão. Cai para `description` se ausente. */
  heroCopy?: string;
  /** Derivado: peça cadastrada antes da sessão de fotos (galeria vazia). */
  pendingPhoto: boolean;
  material: string;
  dimensions: string;
  colors: string[];
  /** Grupos de atributos da vitrine (migration 0059). `observations` NUNCA entra aqui. */
  variations: ProductVariationGroup[];
  links: ProductLinks;
}

/**
 * Item de uma lista editável (passo do "Como Funciona", depoimento…).
 *
 * Campos genéricos de propósito: um passo usa icon/title/text; um depoimento usa
 * text/author/detail. Dois tipos separados dobrariam o editor sem ganho.
 */
export interface LandingSectionItem {
  /** Nome do ícone (allowlist em lib/landing/section-icons.ts). Só passos usam. */
  icon?: string;
  title?: string;
  text?: string;
  /** Depoimento: quem falou. */
  author?: string;
  /** Depoimento: cidade/UF. */
  detail?: string;
}

/** Conteúdo editável de uma seção da landing. */
export interface LandingSection {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** Imagem de topo (banner). Quando presente, substitui a mídia padrão da seção. */
  image?: string;
  /** Lista da seção. Ausente = usa a lista padrão do código. */
  items?: LandingSectionItem[];
}

export interface LandingSettings {
  /** Chave = id da seção (ex.: "categorias", "bestsellers", "galeria"). */
  sections: Record<string, LandingSection>;
  /** Links globais de plataforma, herdados por produtos sem link próprio. */
  links: ProductLinks;
}

export interface LandingCatalog {
  products: LandingProduct[];
  bestsellers: LandingProduct[];
  settings: LandingSettings;
}
