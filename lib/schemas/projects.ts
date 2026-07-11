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

export const PROJECT_NOTE_COLORS = ["yellow", "pink", "blue", "green"] as const;
export const projectNoteColorSchema = z.enum(PROJECT_NOTE_COLORS);

export const projectNoteCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(2000),
  color: projectNoteColorSchema.optional().default("yellow"),
});

export type ProjectCreate = z.infer<typeof projectCreateSchema>;
export type ProjectNoteColor = z.infer<typeof projectNoteColorSchema>;
