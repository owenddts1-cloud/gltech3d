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

export const simpleSpoolFormSchema = z.object({
  brand: z.string().trim().min(1, "Marca é obrigatória").max(100),
  color: z.string().trim().min(1, "Cor é obrigatória").max(50),
  material: z.string().trim().max(64).optional().default("PLA"),
  quantity: z.coerce.number().int("Quantidade deve ser inteira").positive("Quantidade deve ser maior que zero").max(10_000),
});

export type SimpleSpoolFormInput = z.infer<typeof simpleSpoolFormSchema>;

export function normalizeSimpleSpool(input: {
  brand: string;
  color: string;
  material?: string;
  quantity: number;
}) {
  const brand = input.brand.trim();
  const color = input.color.trim();
  const material = (input.material || "PLA").trim();
  const quantity = Math.max(1, Math.floor(input.quantity));
  const id = `fil_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const name = `${brand} ${material} (${color})`;
  const weightGrams = quantity * 1000;

  return {
    id,
    name,
    brand,
    material,
    color,
    quantity,
    weightGrams,
    initialWeightGrams: weightGrams,
    costPerGram: 0.12,
    minWeightAlert: 200,
    supplier: brand,
  };
}

export const filamentInputSchema = z.object({
  id: clientId.optional(),
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(100).optional().default(""),
  material: z.string().trim().max(64).optional().default("PLA"),
  color: z.string().trim().max(32).optional().default(""),
  quantity: z.coerce.number().int().nonnegative().optional().default(1),
  weightGrams: z.coerce.number().nonnegative().max(1_000_000).optional(),
  initialWeightGrams: z.coerce.number().nonnegative().max(1_000_000).optional(),
  costPerGram: z.coerce.number().nonnegative().max(100_000).optional().default(0.12),
  minWeightAlert: z.coerce.number().nonnegative().max(1_000_000).optional().default(0),
  supplier: z.string().trim().max(200).optional().default(""),
}).transform((data) => {
  const quantity = data.quantity ?? 1;
  const defaultWeight = quantity * 1000;
  const weightGrams = data.weightGrams ?? defaultWeight;
  const initialWeightGrams = data.initialWeightGrams ?? weightGrams;
  const id = data.id ?? `fil_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    ...data,
    id,
    weightGrams,
    initialWeightGrams,
    quantity,
  };
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

/** Energy tariff (R$/kWh) saved on its own from the dashboard (organizations.settings.k_energy). */
export const energyTariffSchema = z.coerce
  .number({ invalid_type_error: "Tarifa inválida" })
  .min(0.01, "A tarifa mínima é R$ 0,01/kWh")
  .max(10, "A tarifa máxima é R$ 10,00/kWh");

export type FilamentInput = z.infer<typeof filamentInputSchema>;
export type PrinterInput = z.infer<typeof printerInputSchema>;
