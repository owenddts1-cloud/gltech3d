/**
 * Zod schemas for Ordens de Serviço (service_orders). External input at the
 * server-action boundary.
 */
import { z } from "zod";

export const SO_STATUSES = [
  "orcamento", "aprovado", "em_producao", "pronto_entrega", "concluido",
] as const;
export const soStatusSchema = z.enum(SO_STATUSES);

export const SO_PRIORITIES = ["alta", "media", "baixa"] as const;
export const soPrioritySchema = z.enum(SO_PRIORITIES);

export const serviceOrderCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  contactId: z.string().uuid().nullable().optional(),
  contactName: z.string().trim().max(200).optional(),
  status: soStatusSchema.optional().default("orcamento"),
  priority: soPrioritySchema.optional().default("media"),
  material: z.string().trim().max(40).nullable().optional(),
  channelId: z.string().uuid().nullable().optional(),
  /** Valor total em reais (convertido para cents na action). */
  total: z.coerce.number().nonnegative().max(10_000_000).optional().default(0),
  qty: z.coerce.number().int().min(1).max(100_000).optional().default(1),
  /** ISO datetime string ou null. */
  slaDueAt: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(2000).optional().default(""),
  layerHeight: z.coerce.number().nonnegative().max(5).optional(),
  infill: z.coerce.number().int().min(0).max(100).optional(),
  supports: z.boolean().optional(),
});

export const serviceOrderPatchSchema = serviceOrderCreateSchema.partial();

export const serviceOrderMoveSchema = z.object({
  id: z.string().uuid(),
  status: soStatusSchema,
  position: z.coerce.number().int().min(0).max(100_000).optional().default(0),
});

export type ServiceOrderCreate = z.infer<typeof serviceOrderCreateSchema>;
export type SoStatus = z.infer<typeof soStatusSchema>;
export type SoPriority = z.infer<typeof soPrioritySchema>;
