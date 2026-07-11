/**
 * Zod schemas para o Inventário de ativos (inventory_assets). Entrada externa
 * na fronteira das server actions.
 */
import { z } from "zod";

export const INVENTORY_CATEGORIES = [
  "impressora", "ferramenta", "movel", "computador", "estufa", "eletronico", "outro",
] as const;
export const inventoryCategorySchema = z.enum(INVENTORY_CATEGORIES);

export const INVENTORY_STATUSES = ["ativo", "manutencao", "inativo"] as const;
export const inventoryStatusSchema = z.enum(INVENTORY_STATUSES);

export const inventoryAssetCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: inventoryCategorySchema.optional().default("outro"),
  quantity: z.coerce.number().int().min(1).max(100_000).optional().default(1),
  /** Valor de compra unitário em reais (convertido para cents na action). */
  purchaseValue: z.coerce.number().nonnegative().max(10_000_000).optional().default(0),
  /** Data de compra ISO (YYYY-MM-DD) ou null. */
  purchaseDate: z.string().trim().max(10).nullable().optional(),
  usefulLifeMonths: z.coerce.number().int().min(1).max(1200).optional().default(60),
  status: inventoryStatusSchema.optional().default("ativo"),
  notes: z.string().trim().max(2000).optional().default(""),
});

export const inventoryAssetPatchSchema = inventoryAssetCreateSchema.partial();

export type InventoryAssetCreate = z.infer<typeof inventoryAssetCreateSchema>;
export type InventoryCategory = z.infer<typeof inventoryCategorySchema>;
export type InventoryStatus = z.infer<typeof inventoryStatusSchema>;
