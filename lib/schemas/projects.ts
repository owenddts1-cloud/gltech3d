/**
 * Zod schemas para Projetos técnicos (projects) e o quadro de ideias
 * (project_notes). Entrada externa na fronteira das server actions.
 */
import { z } from "zod";

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  filamentType: z.string().trim().max(120).optional().default(""),
  weightGrams: z.coerce.number().nonnegative().max(1_000_000).optional().default(0),
  printHours: z.coerce.number().nonnegative().max(100_000).optional().default(0),
  layerHeight: z.coerce.number().nonnegative().max(5).optional().default(0.2),
  infill: z.string().trim().max(60).optional().default(""),
  speed: z.coerce.number().int().nonnegative().max(100_000).optional().default(0),
  nozzleTemp: z.coerce.number().int().nonnegative().max(1000).optional().default(0),
  bedTemp: z.coerce.number().int().nonnegative().max(1000).optional().default(0),
  description: z.string().trim().max(2000).optional().default(""),
  filamentCostPerKg: z.coerce.number().nonnegative().max(1_000_000).optional().default(0),
  wattage: z.coerce.number().int().nonnegative().max(100_000).optional().default(0),
  kwhPrice: z.coerce.number().nonnegative().max(1000).optional().default(0.85),
  depreciationPerHour: z.coerce.number().nonnegative().max(100_000).optional().default(0),
});

/**
 * Patch of a project. Derived from the create schema with `.partial()`: in Zod 3
 * an absent key short-circuits in ZodOptional before the inner `.default()`, so
 * a partial patch never resets untouched columns to their create defaults.
 */
export const projectUpdateSchema = projectCreateSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: "Nada para atualizar" });

export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;

/** Maps a validated patch to `projects` columns (only keys that were sent). */
export function projectPatchToRow(d: ProjectUpdate): Record<string, string | number | null> {
  const row: Record<string, string | number | null> = {};
  if (d.name !== undefined) row.name = d.name;
  if (d.filamentType !== undefined) row.filament_type = d.filamentType || null;
  if (d.weightGrams !== undefined) row.weight_grams = d.weightGrams;
  if (d.printHours !== undefined) row.print_hours = d.printHours;
  if (d.layerHeight !== undefined) row.layer_height = d.layerHeight;
  if (d.infill !== undefined) row.infill = d.infill || null;
  if (d.speed !== undefined) row.speed = d.speed;
  if (d.nozzleTemp !== undefined) row.nozzle_temp = d.nozzleTemp;
  if (d.bedTemp !== undefined) row.bed_temp = d.bedTemp;
  if (d.description !== undefined) row.description = d.description || null;
  if (d.filamentCostPerKg !== undefined) row.filament_cost_per_kg = d.filamentCostPerKg;
  if (d.wattage !== undefined) row.wattage = d.wattage;
  if (d.kwhPrice !== undefined) row.kwh_price = d.kwhPrice;
  if (d.depreciationPerHour !== undefined) row.depreciation_per_hour = d.depreciationPerHour;
  return row;
}

export const PROJECT_NOTE_COLORS =["yellow", "pink", "blue", "green"] as const;
export const projectNoteColorSchema = z.enum(PROJECT_NOTE_COLORS);

export const projectNoteCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(2000),
  color: projectNoteColorSchema.optional().default("yellow"),
});

/** Patch de nota — usado ao arrastar no plano (posX/posY) e ao editar texto/cor. */
export const projectNotePatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).max(2000).optional(),
  color: projectNoteColorSchema.optional(),
  posX: z.coerce.number().optional(),
  posY: z.coerce.number().optional(),
});

export type ProjectCreate = z.infer<typeof projectCreateSchema>;
export type ProjectNoteColor = z.infer<typeof projectNoteColorSchema>;
