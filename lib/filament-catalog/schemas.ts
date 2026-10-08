/**
 * Input contract of the filament catalog (products of kind 'filamento' + their
 * 1:1 sheet in `product_filament_specs`, migration 0087).
 *
 * camelCase like every other server action of the CRM. Limits mirror the CHECK
 * constraints of 0087 so the user gets a readable message instead of a raw 23514.
 *
 * Pure module: the UI imports the enums/labels, the server actions validate.
 */
import { z } from "zod";
import { mediaPath } from "@/lib/schemas/products-catalog";

export const FILAMENT_AVAILABILITY = [
  "em_estoque",
  "ultimas_unidades",
  "sob_encomenda",
  "esgotado",
] as const;
export type FilamentAvailability = (typeof FILAMENT_AVAILABILITY)[number];

/** pt-BR labels for the badge on the site and the select in the CRM. */
export const FILAMENT_AVAILABILITY_LABEL: Record<FilamentAvailability, string> = {
  em_estoque: "Em estoque",
  ultimas_unidades: "Últimas unidades",
  sob_encomenda: "Sob encomenda",
  esgotado: "Esgotado",
};

/** Availabilities that can go into a cart. `esgotado` cannot. */
export function isOrderableAvailability(a: FilamentAvailability): boolean {
  return a !== "esgotado";
}

export const FILAMENT_DIAMETERS = [1.75, 2.85] as const;
export type FilamentDiameter = (typeof FILAMENT_DIAMETERS)[number];

/** Optional text: trimmed, "" becomes null (clears the column). */
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((v) => (v.length > 0 ? v : null))
    .nullable()
    .optional();

const temp = z.coerce.number().int().min(0).max(500).nullable().optional();

/** Fields of `product_filament_specs`, all optional (shared by create and patch). */
const specShape = {
  materialId: z.string().uuid().nullable().optional(),
  line: optText(40),
  brand: optText(60),
  colorName: optText(40),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Cor no formato #RRGGBB.")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  diameterMm: z.union([z.literal(1.75), z.literal(2.85)]).optional(),
  netWeightG: z.coerce.number().int().min(1).max(100_000).nullable().optional(),
  nozzleTempMin: temp,
  nozzleTempMax: temp,
  bedTempMin: temp,
  bedTempMax: temp,
  notes: optText(2000),
  tdsUrl: z
    .string()
    .trim()
    .url("Link da ficha técnica inválido.")
    .max(1000)
    .refine((v) => v.startsWith("https://"), "A ficha técnica precisa de um link https://.")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  availability: z.enum(FILAMENT_AVAILABILITY).optional(),
};

/** Fields of `products` the filament form edits. Cost columns are not here on purpose. */
const productShape = {
  /** Explicit name. Absent = derived from the sheet (lib/filament-catalog/title.ts). */
  name: z.string().trim().min(2).max(200).optional(),
  description: optText(2000),
  salePriceCents: z.coerce.number().int().nonnegative().max(100_000_000).nullable().optional(),
  images: z.array(mediaPath).max(20).optional(),
  isPublished: z.boolean().optional(),
};

function tempOrderOk(v: {
  nozzleTempMin?: number | null;
  nozzleTempMax?: number | null;
  bedTempMin?: number | null;
  bedTempMax?: number | null;
}): boolean {
  const okPair = (a?: number | null, b?: number | null) => a == null || b == null || a <= b;
  return okPair(v.nozzleTempMin, v.nozzleTempMax) && okPair(v.bedTempMin, v.bedTempMax);
}

const TEMP_ORDER_MESSAGE = "A temperatura mínima não pode passar da máxima.";

export const filamentCreateSchema = z
  .object({ ...productShape, ...specShape })
  .strict()
  .refine(tempOrderOk, { message: TEMP_ORDER_MESSAGE });
export type FilamentCreateInput = z.infer<typeof filamentCreateSchema>;

/**
 * Patch: every field optional. `name: null` means "go back to the automatic
 * title"; absent `name` keeps the current one (or follows the sheet if the
 * current name still IS the automatic title).
 */
export const filamentPatchSchema = z
  .object({
    ...productShape,
    name: z.string().trim().min(2).max(200).nullable().optional(),
    ...specShape,
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para atualizar." })
  .refine(tempOrderOk, { message: TEMP_ORDER_MESSAGE });
export type FilamentPatchInput = z.infer<typeof filamentPatchSchema>;

export const filamentAvailabilitySchema = z
  .object({ id: z.string().uuid(), availability: z.enum(FILAMENT_AVAILABILITY) })
  .strict();

export const filamentPublishSchema = z
  .object({ id: z.string().uuid(), isPublished: z.boolean() })
  .strict();

export const filamentReorderSchema = z
  .object({
    writes: z
      .array(z.object({ id: z.string().uuid(), sortOrder: z.coerce.number().finite() }).strict())
      .min(1)
      .max(500),
  })
  .strict();

export const filamentIdSchema = z.string().uuid();

/** Publishing without a price would show "R$ 0,00" on the site. */
export function filamentPublishBlockReason(
  isPublished: boolean | undefined,
  priceCentsAfter: number | null | undefined,
): string | null {
  if (isPublished !== true) return null;
  if (priceCentsAfter == null || priceCentsAfter <= 0) {
    return "Defina o valor de venda antes de publicar.";
  }
  return null;
}
