/**
 * Zod schemas for the products catalog (BOM). External input at the
 * server-action boundary. Distinct from `lib/marketing/products.ts` (static
 * landing catalog).
 */
import { z } from "zod";

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
});

export const productPatchSchema = productCreateSchema.partial();

export type ProductCreate = z.infer<typeof productCreateSchema>;
