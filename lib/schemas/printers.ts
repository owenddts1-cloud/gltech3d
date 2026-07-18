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

export const PRINTER_STATUSES = ["idle", "printing", "error", "offline", "maintenance"] as const;
export const POLL_MODES = ["browser", "server", "off"] as const;

export const printerInputSchema = z.object({
  id: clientId,
  name: z.string().trim().min(1).max(200),
  status: z.enum(PRINTER_STATUSES).optional().default("idle"),
  powerDraw: z.coerce.number().nonnegative().max(100_000).optional().default(200),
  depreciationPerHour: z.coerce.number().nonnegative().max(100_000).optional().default(0.4),
  activeFilamentId: clientId.nullable().optional(),
  activePrintJob: z.unknown().nullable().optional(),
  /** IP/URL da impressora (Moonraker http://<ip>:7125 ou OctoPrint http://<ip>). */
  networkUrl: z.string().trim().max(500).optional().default(""),
  /** API key do OctoPrint (opcional; Moonraker não precisa). */
  apiKey: z.string().trim().max(200).optional().default(""),
  /** Como ler o status ao vivo: navegador (LAN), servidor (IP público) ou desligado. */
  pollMode: z.enum(POLL_MODES).optional().default("browser"),
});

export type PrinterStatus = (typeof PRINTER_STATUSES)[number];
export type PollMode = (typeof POLL_MODES)[number];

export const savePrintFarmSchema = z.object({
  printers: z.array(printerInputSchema).max(200),
  filaments: z.array(filamentInputSchema).max(500),
  kEnergy: z.coerce.number().nonnegative().max(100).optional(),
});

export type FilamentInput = z.infer<typeof filamentInputSchema>;
export type PrinterInput = z.infer<typeof printerInputSchema>;
