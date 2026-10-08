/**
 * View models of the filament catalog.
 *
 * `PublicFilament` is what the public site receives (lib/landing/repository.ts
 * `getFilamentCatalog`). No cost column and no internal note ever reaches it —
 * the repository selects an explicit column allowlist.
 *
 * `FilamentAdmin` is the CRM view (app/actions/filament-catalog/actions.ts).
 */
import type { FilamentAvailability } from "./schemas";

export interface FilamentSpecView {
  materialId: string | null;
  /** materials.name, resolved by the server. */
  materialName: string | null;
  line: string | null;
  brand: string | null;
  colorName: string | null;
  colorHex: string | null;
  diameterMm: number;
  netWeightG: number | null;
  nozzleTempMin: number | null;
  nozzleTempMax: number | null;
  bedTempMin: number | null;
  bedTempMax: number | null;
  tdsUrl: string | null;
  availability: FilamentAvailability;
  /** pt-BR label of `availability`. */
  availabilityLabel: string;
  /** false when `esgotado`: the cart must not accept it. */
  orderable: boolean;
}

export interface PublicFilament extends FilamentSpecView {
  id: string;
  /** URL identifier; falls back to the id when the row has no slug. */
  slug: string;
  name: string;
  description: string;
  /** null = no price yet (should not happen for a published item). */
  priceCents: number | null;
  /** First image or the workshop placeholder. */
  image: string;
  images: string[];
  sortOrder: number | null;
}

export interface FilamentAdmin extends FilamentSpecView {
  id: string;
  slug: string | null;
  name: string;
  /** True when `name` equals the title derived from the sheet (it will follow sheet edits). */
  nameIsAuto: boolean;
  description: string | null;
  salePriceCents: number | null;
  images: string[];
  isPublished: boolean;
  sortOrder: number | null;
  stockQty: number;
  soldQty: number;
  /** Internal notes of the sheet (never public). */
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}
