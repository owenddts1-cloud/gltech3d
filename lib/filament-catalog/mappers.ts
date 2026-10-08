/**
 * Raw PostgREST rows of the filament catalog → view models. Pure (no I/O), so
 * the public repository and the CRM actions map the embed the same way.
 */
import {
  FILAMENT_AVAILABILITY,
  FILAMENT_AVAILABILITY_LABEL,
  isOrderableAvailability,
  type FilamentAvailability,
} from "./schemas";
import type { FilamentSpecView } from "./types";

/** Columns of the `product_filament_specs` embed (public-safe: no `notes`). */
export const PUBLIC_SPEC_COLUMNS =
  "material_id, line, brand, color_name, color_hex, diameter_mm, net_weight_g, nozzle_temp_min, nozzle_temp_max, bed_temp_min, bed_temp_max, tds_url, availability, materials(name)";

/** Same, plus internal notes — CRM only. */
export const ADMIN_SPEC_COLUMNS = `${PUBLIC_SPEC_COLUMNS}, notes`;

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const intOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * PostgREST returns a one-to-one embed as an object, but older versions (or a
 * relationship it cannot prove unique) return an array. Accept both.
 */
export function firstEmbed(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first: unknown = value[0];
    return typeof first === "object" && first !== null ? (first as Record<string, unknown>) : null;
  }
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

export function asAvailability(v: unknown): FilamentAvailability {
  return (FILAMENT_AVAILABILITY as readonly string[]).includes(String(v))
    ? (v as FilamentAvailability)
    : "em_estoque";
}

/**
 * Spec embed → view. A filament product without a spec row (should not exist,
 * but a half-failed create could leave one) maps to neutral defaults instead of
 * crashing the page.
 */
export function toSpecView(spec: Record<string, unknown> | null, fallbackMaterial: string | null): FilamentSpecView {
  const s = spec ?? {};
  const material = firstEmbed(s.materials);
  const availability = asAvailability(s.availability);
  const diameter = Number(s.diameter_mm);
  return {
    materialId: str(s.material_id),
    materialName: str(material?.name) ?? fallbackMaterial,
    line: str(s.line),
    brand: str(s.brand),
    colorName: str(s.color_name),
    colorHex: str(s.color_hex),
    diameterMm: diameter === 2.85 ? 2.85 : 1.75,
    netWeightG: intOrNull(s.net_weight_g),
    nozzleTempMin: intOrNull(s.nozzle_temp_min),
    nozzleTempMax: intOrNull(s.nozzle_temp_max),
    bedTempMin: intOrNull(s.bed_temp_min),
    bedTempMax: intOrNull(s.bed_temp_max),
    tdsUrl: str(s.tds_url),
    availability,
    availabilityLabel: FILAMENT_AVAILABILITY_LABEL[availability],
    orderable: isOrderableAvailability(availability),
  };
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}
