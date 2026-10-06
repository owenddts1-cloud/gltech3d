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

/**
 * Patch of a supplier, derived from the create schema. Absent keys stay absent
 * (Zod 3 `.partial()` skips the inner `.default()`), so untouched columns keep
 * their stored values.
 */
export const supplierUpdateSchema = supplierCreateSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: "Nada para atualizar" });

export type SupplierUpdate = z.infer<typeof supplierUpdateSchema>;

/** Maps a validated patch to `suppliers` columns (only keys that were sent). */
export function supplierPatchToRow(d: SupplierUpdate): Record<string, string | number | null> {
  const row: Record<string, string | number | null> = {};
  if (d.name !== undefined) row.name = d.name;
  if (d.category !== undefined) row.category = d.category;
  if (d.contactPerson !== undefined) row.contact_person = d.contactPerson || null;
  if (d.phone !== undefined) row.phone = d.phone || null;
  if (d.website !== undefined) row.website = d.website || null;
  if (d.rating !== undefined) row.rating = d.rating;
  if (d.avgDeliveryDays !== undefined) row.avg_delivery_days = d.avgDeliveryDays;
  if (d.notes !== undefined) row.notes = d.notes || null;
  return row;
}

export const supplierPurchaseCreateSchema =z.object({
  supplierId: z.string().uuid().nullable().optional(),
  supplierName: z.string().trim().min(1).max(200),
  itemName: z.string().trim().min(1).max(200),
  qty: z.coerce.number().int().min(1).max(100_000).optional().default(1),
  /** Preço unitário em reais (convertido para cents na action). */
  unitPrice: z.coerce.number().nonnegative().max(10_000_000).optional().default(0),
});

export type SupplierCreate = z.infer<typeof supplierCreateSchema>;
export type SupplierCategory = z.infer<typeof supplierCategorySchema>;
