/**
 * Storefront helpers for the public filament catalog (home section,
 * /filamentos, /filamentos/[slug], calculator cross-sell).
 *
 * Pure: no I/O, no React. The data comes from `getFilamentCatalog()`
 * (lib/landing/repository.ts), already filtered to published items.
 */
import type { FilamentAvailability } from "@/lib/filament-catalog/schemas";
import { formatNetWeight } from "@/lib/filament-catalog/title";
import type { PublicFilament } from "@/lib/filament-catalog/types";

export type FilamentSort = "relevancia" | "preco_asc" | "preco_desc";

export const FILAMENT_SORT_LABEL: Record<FilamentSort, string> = {
  relevancia: "Destaques",
  preco_asc: "Menor preço",
  preco_desc: "Maior preço",
};

export interface FilamentFilters {
  material: string;
  line: string;
  color: string;
  availability: FilamentAvailability | "";
  query: string;
  sort: FilamentSort;
}

export const EMPTY_FILAMENT_FILTERS: FilamentFilters = {
  material: "",
  line: "",
  color: "",
  availability: "",
  query: "",
  sort: "relevancia",
};

/** Lowercase, no accents, collapsed spaces — "Pétg  Preto" matches "petg preto". */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function haystack(f: PublicFilament): string {
  return normalizeSearch(
    [f.name, f.materialName, f.line, f.brand, f.colorName, f.description].filter(Boolean).join(" "),
  );
}

/**
 * Applies the catalog filters. `relevancia` keeps the manual order of the CRM
 * (the list arrives already sorted); price sorts push items without price last.
 */
export function filterFilaments(list: readonly PublicFilament[], f: FilamentFilters): PublicFilament[] {
  const terms = normalizeSearch(f.query).split(" ").filter((t) => t.length > 0);
  const out = list.filter((item) => {
    if (f.material && item.materialName !== f.material) return false;
    if (f.line && item.line !== f.line) return false;
    if (f.color && item.colorName !== f.color) return false;
    if (f.availability && item.availability !== f.availability) return false;
    if (terms.length > 0) {
      const text = haystack(item);
      if (!terms.every((t) => text.includes(t))) return false;
    }
    return true;
  });
  if (f.sort === "relevancia") return out;
  const dir = f.sort === "preco_asc" ? 1 : -1;
  return [...out].sort((a, b) => {
    if (a.priceCents == null && b.priceCents == null) return 0;
    if (a.priceCents == null) return 1;
    if (b.priceCents == null) return -1;
    return (a.priceCents - b.priceCents) * dir;
  });
}

function uniqueSorted(values: ReadonlyArray<string | null>): string[] {
  const set = new Set<string>();
  for (const v of values) if (v) set.add(v);
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Options for the filter chips/selects, derived from what is actually published. */
export function filamentFilterOptions(list: readonly PublicFilament[]): {
  materials: string[];
  lines: string[];
  colors: string[];
  availabilities: FilamentAvailability[];
} {
  const avail = new Set(list.map((f) => f.availability));
  const order: FilamentAvailability[] = ["em_estoque", "ultimas_unidades", "sob_encomenda", "esgotado"];
  return {
    materials: uniqueSorted(list.map((f) => f.materialName)),
    lines: uniqueSorted(list.map((f) => f.line)),
    colors: uniqueSorted(list.map((f) => f.colorName)),
    availabilities: order.filter((a) => avail.has(a)),
  };
}

/** Price per kg in cents, when both price and net weight are known. */
export function pricePerKgCents(f: Pick<PublicFilament, "priceCents" | "netWeightG">): number | null {
  if (f.priceCents == null || f.priceCents <= 0) return null;
  if (f.netWeightG == null || f.netWeightG <= 0) return null;
  return Math.round((f.priceCents * 1000) / f.netWeightG);
}

/** Lowest R$/kg among orderable items — the "a partir de" of the calculator link. */
export function lowestPricePerKgCents(list: readonly PublicFilament[]): number | null {
  let best: number | null = null;
  for (const f of list) {
    if (!f.orderable) continue;
    const v = pricePerKgCents(f);
    if (v != null && (best == null || v < best)) best = v;
  }
  return best;
}

/** `"1,75 mm · 1 kg"` — the second line of a card. */
export function filamentSpecLine(f: Pick<PublicFilament, "diameterMm" | "netWeightG">): string {
  const diameter = `${f.diameterMm.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} mm`;
  const weight = formatNetWeight(f.netWeightG);
  return weight ? `${diameter} · ${weight}` : diameter;
}

/** `"200–220 °C"`, `"60 °C"`, or null when neither bound is known. */
export function formatTempRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min == null || max == null || min === max) return `${min ?? max} °C`;
  return `${min}–${max} °C`;
}

/** schema.org/ItemAvailability for the JSON-LD of the product page. */
export const SCHEMA_ORG_AVAILABILITY: Record<FilamentAvailability, string> = {
  em_estoque: "https://schema.org/InStock",
  ultimas_unidades: "https://schema.org/LimitedAvailability",
  sob_encomenda: "https://schema.org/PreOrder",
  esgotado: "https://schema.org/OutOfStock",
};

/** WhatsApp text of the "Volta em breve · Me avise" button. */
export function notifyBackMessage(name: string): string {
  return `Oi! Me avisa quando o ${name} voltar?`;
}

/** Text of the calculator's "Comprar o filamento desta peça" WhatsApp fallback. */
export function calculatorFilamentMessage(weightG: number): string {
  const g = Math.max(0, Math.round(weightG));
  return `Olá! Calculei uma peça de ${g} g no Calc3D e quero o filamento. Quais cores vocês têm em estoque?`;
}

/** Accessible label for a hex swatch with no color name. */
export function swatchLabel(f: Pick<PublicFilament, "colorName" | "colorHex">): string {
  return f.colorName ?? f.colorHex ?? "Cor não informada";
}

/**
 * Readable text color (#fff or espresso) over a hex background, by relative
 * luminance. Used on swatch overlays.
 */
export function textOnHex(hex: string | null): "#FFFFFF" | "#2B2622" {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m?.[1]) return "#2B2622";
  const n = Number.parseInt(m[1], 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  return l > 0.4 ? "#2B2622" : "#FFFFFF";
}
