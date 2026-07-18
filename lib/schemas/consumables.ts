/**
 * Zod schemas para Consumíveis (filamentos/resinas). Entrada externa na fronteira
 * das server actions. Estoque em gramas; custo por kg (convertido p/ cents na action).
 */
import { z } from "zod";

export const CONSUMABLE_CATEGORIES = ["filamento", "resina", "outro"] as const;
export const consumableCategorySchema = z.enum(CONSUMABLE_CATEGORIES);
export type ConsumableCategory = z.infer<typeof consumableCategorySchema>;

export const consumableCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: consumableCategorySchema.optional().default("filamento"),
  material: z.string().trim().max(60).optional().default(""),
  color: z.string().trim().max(60).optional().default(""),
  /** Estoque atual em gramas. */
  stockGrams: z.coerce.number().nonnegative().max(10_000_000).optional().default(0),
  /** Alerta de reposição em gramas. */
  minStockGrams: z.coerce.number().nonnegative().max(10_000_000).optional().default(0),
  /** Custo por kg em reais (convertido p/ cents na action). */
  costPerKg: z.coerce.number().nonnegative().max(1_000_000).optional().default(0),
  supplier: z.string().trim().max(200).optional().default(""),
  /** Destino/uso do consumível (Consumo, Produção, Revenda, Outro…). */
  purpose: z.string().trim().max(60).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});

export const consumablePatchSchema = consumableCreateSchema.partial();

export type ConsumableCreate = z.infer<typeof consumableCreateSchema>;
