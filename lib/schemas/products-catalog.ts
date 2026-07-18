/**
 * Zod schemas for the products catalog (BOM). External input at the
 * server-action boundary. Distinct from `lib/marketing/products.ts` (static
 * landing catalog).
 */
import { z } from "zod";

/**
 * Variação = grupo de atributo da vitrine (migration 0059). Ex.: { name: "Tamanho",
 * options: ["P","M","G"] }. A landing exibe cada grupo como um conjunto de opções.
 */
export const productVariationGroupSchema = z.object({
  name: z.string().trim().min(1).max(60),
  options: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
});
export type ProductVariationGroup = z.infer<typeof productVariationGroupSchema>;

export const productCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(80).optional().default(""),
  /** FK → categories.id (migration 0055). Preferred over text `category`. */
  categoryId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(2000).optional().default(""),
  filamentClientId: z.string().max(64).nullable().optional(),
  filamentGrams: z.coerce.number().nonnegative().max(1_000_000).optional().default(0),
  /** Tempo de impressão em minutos (convertido para segundos na action). */
  printTimeMinutes: z.coerce.number().nonnegative().max(100_000).optional().default(0),
  printerClientId: z.string().max(64).nullable().optional(),
  /** Insumos extras somados, em reais (embalagem, parafusos, tags…). */
  extraCost: z.coerce.number().nonnegative().max(1_000_000).optional().default(0),
  marginPct: z.coerce.number().min(0).max(100_000).optional().default(100),
  images: z.array(z.string().url().max(1000)).max(20).optional(),
  /** Visibilidade na landing (migration pré-existente is_published). Publicar exige preço. */
  isPublished: z.boolean().optional(),
  /** Preço de venda em reais → sale_price_cents. Necessário para publicar na landing. */
  salePrice: z.coerce.number().nonnegative().max(1_000_000).nullable().optional(),
  /** Grupos de atributos da vitrine (migration 0059). */
  variations: z.array(productVariationGroupSchema).max(20).optional(),
  /** Observação INTERNA do CRM (migration 0059) — não vai para a landing. */
  observations: z.string().trim().max(2000).optional(),
});

export const productPatchSchema = productCreateSchema.partial();

export type ProductCreate = z.infer<typeof productCreateSchema>;
