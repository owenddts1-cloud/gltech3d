/**
 * Zod schemas for the categories table (0055_catalog_and_orders_integrity).
 * External input at the server-action boundary.
 */
import { z } from "zod";

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120).regex(
    /^[a-z0-9\u00e0-\u00ff-]+$/,
    "Slug inválido: use letras minúsculas, números e hífens.",
  ).optional(),
  sortOrder: z.coerce.number().optional(),
});

export const categoryPatchSchema = categoryCreateSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "Nada para atualizar." },
);

export type CategoryCreate = z.infer<typeof categoryCreateSchema>;
