/**
 * Zod schemas para Fornecedores (suppliers) e histórico de compras
 * (supplier_purchases). Entrada externa na fronteira das server actions.
 */
import { z } from "zod";

export const SUPPLIER_CATEGORIES = ["filament", "printer", "shipping", "tools", "other"] as const;
export const supplierCategorySchema = z.enum(SUPPLIER_CATEGORIES);

export const supplierCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: supplierCategorySchema.optional().default("filament"),
  contactPerson: z.string().trim().max(200).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  website: z.string().trim().max(500).optional().default(""),
  rating: z.coerce.number().int().min(1).max(5).optional().default(5),
  avgDeliveryDays: z.coerce.number().int().min(0).max(365).optional().default(5),
  notes: z.string().trim().max(2000).optional().default(""),
});

export const supplierPurchaseCreateSchema = z.object({
  supplierId: z.string().uuid().nullable().optional(),
  supplierName: z.string().trim().min(1).max(200),
  itemName: z.string().trim().min(1).max(200),
  qty: z.coerce.number().int().min(1).max(100_000).optional().default(1),
  /** Preço unitário em reais (convertido para cents na action). */
  unitPrice: z.coerce.number().nonnegative().max(10_000_000).optional().default(0),
});

export type SupplierCreate = z.infer<typeof supplierCreateSchema>;
export type SupplierCategory = z.infer<typeof supplierCategorySchema>;
