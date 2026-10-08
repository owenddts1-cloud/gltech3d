/**
 * Display title of a filament for sale, derived from its technical sheet.
 *
 * Pure function: the server action uses it to fill `products.name` (and the
 * slug) when the operator does not type a name, and the UI can call it to
 * preview the title live. One implementation, so the preview and what is saved
 * cannot diverge.
 *
 *   { material: "PLA", line: "Plus+", colorName: "Preto", netWeightG: 1000, brand: "Voolt" }
 *     → "PLA Plus+ Preto 1 kg · Voolt"
 */

export interface FilamentTitleInput {
  /** Material name (materials.name), e.g. "PLA", "PETG". */
  material?: string | null;
  /** Product line of the brand, e.g. "Plus+", "Silk", "Matte". */
  line?: string | null;
  colorName?: string | null;
  netWeightG?: number | null;
  brand?: string | null;
}

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/** `1000` → `"1 kg"`, `1500` → `"1,5 kg"`, `750` → `"750 g"`. `null` for missing/invalid. */
export function formatNetWeight(grams: number | null | undefined): string | null {
  if (grams == null || !Number.isFinite(grams) || grams <= 0) return null;
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;
  }
  return `${Math.round(grams)} g`;
}

export function buildFilamentTitle(input: FilamentTitleInput): string {
  const material = clean(input.material);
  const line = clean(input.line);
  // "PLA" + line "PLA+" would read "PLA PLA+": the line already names the material.
  const lineRepeatsMaterial =
    material.length > 0 && line.toLowerCase().startsWith(material.toLowerCase());

  const parts = [
    lineRepeatsMaterial ? "" : material,
    line,
    clean(input.colorName),
    formatNetWeight(input.netWeightG) ?? "",
  ].filter((p) => p.length > 0);

  const head = parts.join(" ");
  const brand = clean(input.brand);
  if (!head) return brand;
  return brand ? `${head} · ${brand}` : head;
}
