/**
 * Form model of the filament sheet (CRM → Filamentos). Pure: string state for
 * the inputs, conversion to the camelCase payload of createFilament /
 * updateFilament (app/actions/filament-catalog/actions.ts), which validate
 * again with Zod. Testable without rendering the sheet.
 */
import type { FilamentAvailability, FilamentDiameter } from "@/lib/filament-catalog/schemas";
import type { FilamentAdmin } from "@/lib/filament-catalog/types";
import { buildFilamentTitle } from "@/lib/filament-catalog/title";
import { brlNumberFromCents, centsFromInput } from "@/lib/format/money";

/** Product lines suggested in the "Linha" field (free text is accepted). */
export const LINE_SUGGESTIONS = ["Comum", "Plus+", "Premium", "Silk", "Matte"] as const;

export interface FilamentFormState {
  /** Explicit name; ignored while `autoName` is on. */
  name: string;
  autoName: boolean;
  description: string;
  price: string;
  images: string[];
  isPublished: boolean;
  materialId: string;
  line: string;
  brand: string;
  colorName: string;
  colorHex: string;
  diameterMm: FilamentDiameter;
  netWeightG: string;
  nozzleTempMin: string;
  nozzleTempMax: string;
  bedTempMin: string;
  bedTempMax: string;
  notes: string;
  tdsUrl: string;
  availability: FilamentAvailability;
}

export const EMPTY_FILAMENT_FORM: FilamentFormState = {
  name: "",
  autoName: true,
  description: "",
  price: "",
  images: [],
  isPublished: false,
  materialId: "",
  line: "",
  brand: "",
  colorName: "",
  colorHex: "",
  diameterMm: 1.75,
  netWeightG: "1000",
  nozzleTempMin: "",
  nozzleTempMax: "",
  bedTempMin: "",
  bedTempMax: "",
  notes: "",
  tdsUrl: "",
  availability: "em_estoque",
};

const numStr = (v: number | null) => (v == null ? "" : String(v));

export function formFromFilament(f: FilamentAdmin): FilamentFormState {
  return {
    name: f.name,
    autoName: f.nameIsAuto,
    description: f.description ?? "",
    price: f.salePriceCents != null ? brlNumberFromCents(f.salePriceCents) : "",
    images: [...f.images],
    isPublished: f.isPublished,
    materialId: f.materialId ?? "",
    line: f.line ?? "",
    brand: f.brand ?? "",
    colorName: f.colorName ?? "",
    colorHex: f.colorHex ?? "",
    diameterMm: f.diameterMm === 2.85 ? 2.85 : 1.75,
    netWeightG: numStr(f.netWeightG),
    nozzleTempMin: numStr(f.nozzleTempMin),
    nozzleTempMax: numStr(f.nozzleTempMax),
    bedTempMin: numStr(f.bedTempMin),
    bedTempMax: numStr(f.bedTempMax),
    notes: f.notes ?? "",
    tdsUrl: f.tdsUrl ?? "",
    availability: f.availability,
  };
}

/** Integer or null from an input ("" → null, "abc" → NaN → caught by `validateFilamentForm`). */
export function intOrNull(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : Number.NaN;
}

/** Live preview of the automatic title (same function the server uses). */
export function previewTitle(form: FilamentFormState, materialName: string | null): string {
  const weight = intOrNull(form.netWeightG);
  return buildFilamentTitle({
    material: materialName,
    line: form.line,
    colorName: form.colorName,
    netWeightG: weight != null && Number.isFinite(weight) ? weight : null,
    brand: form.brand,
  });
}

/** First problem a person can fix, or null. The server validates again. */
export function validateFilamentForm(form: FilamentFormState, materialName: string | null): string | null {
  // The weight alone ("1 kg") is not a title: the automatic one needs a material, line or color.
  const autoHasSubject = Boolean(materialName || form.line.trim() || form.colorName.trim());
  const title = form.autoName ? (autoHasSubject ? previewTitle(form, materialName) : "") : form.name.trim();
  if (title.length < 2) return "Informe o material e a cor, ou escreva um nome.";
  for (const [label, raw] of [
    ["Peso líquido", form.netWeightG],
    ["Bico mínimo", form.nozzleTempMin],
    ["Bico máximo", form.nozzleTempMax],
    ["Mesa mínima", form.bedTempMin],
    ["Mesa máxima", form.bedTempMax],
  ] as const) {
    const v = intOrNull(raw);
    if (v != null && Number.isNaN(v)) return `${label}: use só números.`;
  }
  const pair = (a: string, b: string) => {
    const x = intOrNull(a);
    const y = intOrNull(b);
    return x == null || y == null || x <= y;
  };
  if (!pair(form.nozzleTempMin, form.nozzleTempMax) || !pair(form.bedTempMin, form.bedTempMax)) {
    return "A temperatura mínima não pode passar da máxima.";
  }
  if (form.colorHex && !/^#[0-9a-f]{6}$/i.test(form.colorHex)) return "Cor no formato #RRGGBB.";
  if (form.tdsUrl.trim() && !/^https:\/\//i.test(form.tdsUrl.trim())) {
    return "A ficha técnica precisa de um link https://.";
  }
  if (form.isPublished && centsFromInput(form.price) <= 0) return "Defina o valor de venda antes de publicar.";
  return null;
}

/**
 * Payload of createFilament / updateFilament. `name`: absent on create with the
 * automatic title, `null` on update to go back to it.
 */
export function payloadFromForm(form: FilamentFormState, mode: "create" | "update"): Record<string, unknown> {
  const priceCents = form.price.trim() ? centsFromInput(form.price) : null;
  const payload: Record<string, unknown> = {
    description: form.description,
    salePriceCents: priceCents,
    images: form.images,
    isPublished: form.isPublished,
    materialId: form.materialId || null,
    line: form.line,
    brand: form.brand,
    colorName: form.colorName,
    colorHex: form.colorHex,
    diameterMm: form.diameterMm,
    netWeightG: intOrNull(form.netWeightG),
    nozzleTempMin: intOrNull(form.nozzleTempMin),
    nozzleTempMax: intOrNull(form.nozzleTempMax),
    bedTempMin: intOrNull(form.bedTempMin),
    bedTempMax: intOrNull(form.bedTempMax),
    notes: form.notes,
    tdsUrl: form.tdsUrl.trim(),
    availability: form.availability,
  };
  if (!form.autoName) payload.name = form.name.trim();
  else if (mode === "update") payload.name = null;
  return payload;
}
