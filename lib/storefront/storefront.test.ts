import { describe, expect, it } from "vitest";
import type { PublicFilament } from "@/lib/filament-catalog/types";
import { MAX_ITEM_QTY, MAX_ORDER_ITEMS, SITE_ORDER_REFUSAL_MESSAGE } from "@/lib/site-orders/core";
import {
  EMPTY_FILAMENT_FILTERS,
  SCHEMA_ORG_AVAILABILITY,
  filamentFilterOptions,
  filamentSpecLine,
  filterFilaments,
  formatTempRange,
  lowestPricePerKgCents,
  normalizeSearch,
  pricePerKgCents,
  textOnHex,
} from "./filaments";
import {
  CART_MAX_ITEMS,
  CART_MAX_QTY,
  EMPTY_CART,
  buildOrderBody,
  cartCount,
  cartReducer,
  cartSubtotal,
  interpretOrderError,
  parseOrderSuccess,
  parseStoredCart,
  serializeCart,
  validateCheckout,
  type CartState,
} from "./cart";

function fil(over: Partial<PublicFilament>): PublicFilament {
  return {
    id: "id",
    slug: "slug",
    name: "PLA Preto 1 kg",
    description: "",
    priceCents: 10000,
    image: "/img.jpg",
    images: [],
    sortOrder: null,
    materialId: null,
    materialName: "PLA",
    line: "Comum",
    brand: "Voolt",
    colorName: "Preto",
    colorHex: "#000000",
    diameterMm: 1.75,
    netWeightG: 1000,
    nozzleTempMin: 200,
    nozzleTempMax: 220,
    bedTempMin: 60,
    bedTempMax: 60,
    tdsUrl: null,
    availability: "em_estoque",
    availabilityLabel: "Em estoque",
    orderable: true,
    ...over,
  };
}

const catalog = [
  fil({ id: "a", name: "PLA Preto", priceCents: 9000 }),
  fil({ id: "b", name: "PETG Branco", materialName: "PETG", colorName: "Branco", priceCents: 12000, line: "Plus+" }),
  fil({ id: "c", name: "PLA Silk Dourado", colorName: "Dourado", priceCents: null, availability: "esgotado", orderable: false }),
  fil({ id: "d", name: "Pétg Azul", materialName: "PETG", colorName: "Azul", priceCents: 15000, netWeightG: 500 }),
];

describe("filterFilaments", () => {
  it("keeps the manual order by default", () => {
    expect(filterFilaments(catalog, EMPTY_FILAMENT_FILTERS).map((f) => f.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("filters by material, line, color and availability", () => {
    expect(filterFilaments(catalog, { ...EMPTY_FILAMENT_FILTERS, material: "PETG" }).map((f) => f.id)).toEqual(["b", "d"]);
    expect(filterFilaments(catalog, { ...EMPTY_FILAMENT_FILTERS, line: "Plus+" }).map((f) => f.id)).toEqual(["b"]);
    expect(filterFilaments(catalog, { ...EMPTY_FILAMENT_FILTERS, color: "Azul" }).map((f) => f.id)).toEqual(["d"]);
    expect(filterFilaments(catalog, { ...EMPTY_FILAMENT_FILTERS, availability: "esgotado" }).map((f) => f.id)).toEqual(["c"]);
  });

  it("searches without accents and with every term", () => {
    expect(filterFilaments(catalog, { ...EMPTY_FILAMENT_FILTERS, query: "petg azul" }).map((f) => f.id)).toEqual(["d"]);
    expect(normalizeSearch("  Pétg   AZUL ")).toBe("petg azul");
  });

  it("sorts by price with unpriced items last", () => {
    expect(filterFilaments(catalog, { ...EMPTY_FILAMENT_FILTERS, sort: "preco_asc" }).map((f) => f.id)).toEqual(["a", "b", "d", "c"]);
    expect(filterFilaments(catalog, { ...EMPTY_FILAMENT_FILTERS, sort: "preco_desc" }).map((f) => f.id)).toEqual(["d", "b", "a", "c"]);
  });
});

describe("filter options and prices", () => {
  it("derives unique options from the published list", () => {
    const o = filamentFilterOptions(catalog);
    expect(o.materials).toEqual(["PETG", "PLA"]);
    expect(o.colors).toEqual(["Azul", "Branco", "Dourado", "Preto"]);
    expect(o.availabilities).toEqual(["em_estoque", "esgotado"]);
  });

  it("computes R$/kg and the lowest orderable one", () => {
    expect(pricePerKgCents({ priceCents: 15000, netWeightG: 500 })).toBe(30000);
    expect(pricePerKgCents({ priceCents: null, netWeightG: 1000 })).toBeNull();
    expect(pricePerKgCents({ priceCents: 100, netWeightG: null })).toBeNull();
    expect(lowestPricePerKgCents(catalog)).toBe(9000);
    expect(lowestPricePerKgCents([catalog[2]!])).toBeNull();
  });

  it("formats the spec line and temperature ranges", () => {
    expect(filamentSpecLine({ diameterMm: 1.75, netWeightG: 1000 })).toBe("1,75 mm · 1 kg");
    expect(filamentSpecLine({ diameterMm: 2.85, netWeightG: null })).toBe("2,85 mm");
    expect(formatTempRange(200, 220)).toBe("200–220 °C");
    expect(formatTempRange(60, 60)).toBe("60 °C");
    expect(formatTempRange(null, 70)).toBe("70 °C");
    expect(formatTempRange(null, null)).toBeNull();
  });

  it("maps availability to schema.org", () => {
    expect(SCHEMA_ORG_AVAILABILITY.em_estoque).toBe("https://schema.org/InStock");
    expect(SCHEMA_ORG_AVAILABILITY.ultimas_unidades).toBe("https://schema.org/LimitedAvailability");
    expect(SCHEMA_ORG_AVAILABILITY.sob_encomenda).toBe("https://schema.org/PreOrder");
    expect(SCHEMA_ORG_AVAILABILITY.esgotado).toBe("https://schema.org/OutOfStock");
  });

  it("picks a readable text color over a swatch", () => {
    expect(textOnHex("#000000")).toBe("#FFFFFF");
    expect(textOnHex("#FFFFFF")).toBe("#2B2622");
    expect(textOnHex(null)).toBe("#2B2622");
  });
});

const item = { productId: "p1", slug: "pla-preto", name: "PLA Preto", priceCents: 9000, image: null, colorHex: "#000000" };

describe("cartReducer", () => {
  it("adds, merges quantities and clamps to the server limits", () => {
    let s = cartReducer(EMPTY_CART, { type: "add", item });
    s = cartReducer(s, { type: "add", item, qty: 2 });
    expect(s.items).toHaveLength(1);
    expect(s.items[0]?.qty).toBe(3);
    s = cartReducer(s, { type: "setQty", productId: "p1", qty: 500 });
    expect(s.items[0]?.qty).toBe(CART_MAX_QTY);
    s = cartReducer(s, { type: "setQty", productId: "p1", qty: 0 });
    expect(s.items[0]?.qty).toBe(1);
  });

  it("removes and clears", () => {
    const s = cartReducer(EMPTY_CART, { type: "add", item });
    expect(cartReducer(s, { type: "remove", productId: "p1" }).items).toEqual([]);
    expect(cartReducer(s, { type: "clear" })).toEqual(EMPTY_CART);
  });

  it("refuses a new line past the item limit", () => {
    let s: CartState = EMPTY_CART;
    for (let i = 0; i < CART_MAX_ITEMS + 3; i++) {
      s = cartReducer(s, { type: "add", item: { ...item, productId: `p${i}` } });
    }
    expect(s.items).toHaveLength(CART_MAX_ITEMS);
  });

  it("counts and sums (display only)", () => {
    let s = cartReducer(EMPTY_CART, { type: "add", item, qty: 2 });
    s = cartReducer(s, { type: "add", item: { ...item, productId: "p2", priceCents: null } });
    expect(cartCount(s)).toBe(3);
    expect(cartSubtotal(s)).toEqual({ cents: 18000, hasUnpriced: true });
  });

  it("mirrors the server limits", () => {
    expect(CART_MAX_ITEMS).toBe(MAX_ORDER_ITEMS);
    expect(CART_MAX_QTY).toBe(MAX_ITEM_QTY);
  });
});

describe("cart persistence", () => {
  it("round-trips", () => {
    const s = cartReducer(EMPTY_CART, { type: "add", item, qty: 4 });
    expect(parseStoredCart(serializeCart(s))).toEqual(s);
  });

  it("survives garbage", () => {
    expect(parseStoredCart(null)).toEqual(EMPTY_CART);
    expect(parseStoredCart("{not json")).toEqual(EMPTY_CART);
    expect(parseStoredCart('{"items":"x"}')).toEqual(EMPTY_CART);
    const raw = JSON.stringify({
      items: [{ productId: "a", name: "A", qty: 1000 }, { name: "no id" }, { productId: "a", name: "dup" }, 5],
    });
    const s = parseStoredCart(raw);
    expect(s.items).toHaveLength(1);
    expect(s.items[0]).toMatchObject({ productId: "a", slug: "a", qty: CART_MAX_QTY, priceCents: null });
  });
});

describe("checkout", () => {
  const s = cartReducer(EMPTY_CART, { type: "add", item, qty: 2 });

  it("builds a body without prices", () => {
    const body = buildOrderBody(s, { name: " Lucas ", whatsapp: "(31) 98888-7777", notes: " ", website: "", elapsedMs: 4321.6 });
    expect(body).toEqual({
      customer_name: "Lucas",
      customer_whatsapp: "(31) 98888-7777",
      items: [{ product_id: "p1", qty: 2 }],
      elapsed_ms: 4322,
    });
    expect(JSON.stringify(body)).not.toContain("price");
  });

  it("validates locally", () => {
    expect(validateCheckout(EMPTY_CART, { name: "Lucas", whatsapp: "31988887777" })).toMatch(/vazio/);
    expect(validateCheckout(s, { name: "L", whatsapp: "31988887777" })).toMatch(/nome/);
    expect(validateCheckout(s, { name: "Lucas", whatsapp: "123" })).toMatch(/WhatsApp/);
    expect(validateCheckout(s, { name: "Lucas", whatsapp: "+55 31 98888-7777" })).toBeNull();
  });

  it("interprets refusals with the item ids", () => {
    const e = interpretOrderError(
      422,
      { error: { code: "item_unavailable", message: "x", details: { product_ids: ["p1"] } } },
      null,
    );
    expect(e).toEqual({ message: SITE_ORDER_REFUSAL_MESSAGE.item_unavailable, productIds: ["p1"] });
  });

  it("interprets validation, rate limit and outage", () => {
    expect(interpretOrderError(422, { error: { code: "validation_error", message: "Informe seu nome." } }, null).message).toBe("Informe seu nome.");
    expect(interpretOrderError(429, {}, "120").message).toMatch(/2 min/);
    expect(interpretOrderError(503, null, null).message).toMatch(/indisponíveis/);
    expect(interpretOrderError(500, null, null).productIds).toEqual([]);
  });

  it("accepts only a wa.me link on success", () => {
    expect(parseOrderSuccess({ data: { short_id: "AB12CD34", whatsapp_url: "https://wa.me/55?text=x", total_cents: 100 } })).toEqual({
      shortId: "AB12CD34",
      whatsappUrl: "https://wa.me/55?text=x",
      totalCents: 100,
    });
    expect(parseOrderSuccess({ data: { short_id: "x", whatsapp_url: "javascript:alert(1)" } })).toBeNull();
    expect(parseOrderSuccess(null)).toBeNull();
  });
});
