/**
 * Zod schemas for the 3D print-farm module (printers / filaments).
 * The frontend keeps client-generated string ids (e.g. "prn_1"); we constrain
 * the charset so those ids are safe to interpolate into PostgREST `in` filters.
 */
import { z } from "zod";

const clientId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, "id inválido");

export const filamentInputSchema = z.object({
  id: clientId,
  name: z.string().trim().min(1).max(200),
  material: z.string().trim().max(64).optional().default(""),
  color: z.string().trim().max(32).optional().default(""),
  weightGrams: z.coerce.number().nonnegative().max(1_000_000),
  initialWeightGrams: z.coerce.number().nonnegative().max(1_000_000),
  costPerGram: z.coerce.number().nonnegative().max(100_000),
  minWeightAlert: z.coerce.number().nonnegative().max(1_000_000).optional().default(0),
  supplier: z.string().trim().max(200).optional().default(""),
});

export const printerInputSchema = z.object({
  id: clientId,
  name: z.string().trim().min(1).max(200),
  status: z.enum(["idle", "printing", "error", "offline"]).optional().default("idle"),
  powerDraw: z.coerce.number().nonnegative().max(100_000).optional().default(200),
  depreciationPerHour: z.coerce.number().nonnegative().max(100_000).optional().default(0.4),
  activeFilamentId: clientId.nullable().optional(),
  activePrintJob: z.unknown().nullable().optional(),
  networkUrl: z.string().trim().max(500).optional().default(""),
});

export const savePrintFarmSchema = z.object({
  printers: z.array(printerInputSchema).max(200),
  filaments: z.array(filamentInputSchema).max(500),
  kEnergy: z.coerce.number().nonnegative().max(100).optional(),
});

export type FilamentInput = z.infer<typeof filamentInputSchema>;
export type PrinterInput = z.infer<typeof printerInputSchema>;
