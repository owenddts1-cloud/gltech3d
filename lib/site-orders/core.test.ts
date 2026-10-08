import { describe, expect, it } from "vitest";
import {
  buildSiteOrderMessage,
  isLikelyBot,
  normalizeCustomerWhatsapp,
  orderShortId,
  priceSiteOrder,
  siteOrderRequestSchema,
  type OrderableProductRow,
} from "./core";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

const ROWS: OrderableProductRow[] = [
  { id: A, name: "PLA Preto 1 kg · Voolt", salePriceCents: 8990, availability: "em_estoque" },
  { id: B, name: "PETG Azul 1 kg", salePriceCents: 10990, availability: "sob_encomenda" },
];

const validBody = {
  customer_name: "Ana Souza",
  customer_whatsapp: "(31) 98888-7777",
  items: [{ product_id: A, qty: 2 }],
  elapsed_ms: 8000,
};

describe("siteOrderRequestSchema", () => {
  it("accepts a valid cart and normalizes the WhatsApp", () => {
    const r = siteOrderRequestSchema.safeParse(validBody);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.customer_whatsapp).toBe("5531988887777");
  });

  it("rejects a price sent in the item (unknown key)", () => {
    const r = siteOrderRequestSchema.safeParse({
      ...validBody,
      items: [{ product_id: A, qty: 2, unit_price_cents: 1 }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown top-level keys (organization_id, total_cents)", () => {
    expect(siteOrderRequestSchema.safeParse({ ...validBody, total_cents: 1 }).success).toBe(false);
    expect(
      siteOrderRequestSchema.safeParse({ ...validBody, organization_id: A }).success,
    ).toBe(false);
  });

  it("rejects repeated items, empty cart, qty out of range and bad phone", () => {
    expect(
      siteOrderRequestSchema.safeParse({
        ...validBody,
        items: [
          { product_id: A, qty: 1 },
          { product_id: A, qty: 1 },
        ],
      }).success,
    ).toBe(false);
    expect(siteOrderRequestSchema.safeParse({ ...validBody, items: [] }).success).toBe(false);
    expect(
      siteOrderRequestSchema.safeParse({ ...validBody, items: [{ product_id: A, qty: 100 }] }).success,
    ).toBe(false);
    expect(siteOrderRequestSchema.safeParse({ ...validBody, customer_whatsapp: "123" }).success).toBe(false);
  });
});

describe("normalizeCustomerWhatsapp", () => {
  it.each([
    ["31988887777", "5531988887777"],
    ["3133334444", "553133334444"],
    ["+55 (31) 98888-7777", "5531988887777"],
    ["5531988887777", "5531988887777"],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizeCustomerWhatsapp(raw)).toBe(expected);
  });

  it("refuses what does not fit 10..13 digits", () => {
    expect(normalizeCustomerWhatsapp("123")).toBeNull();
    expect(normalizeCustomerWhatsapp("14155550100123")).toBeNull();
  });
});

describe("isLikelyBot", () => {
  it("flags honeypot and too-fast submissions", () => {
    expect(isLikelyBot({ website: "x" })).toBe(true);
    expect(isLikelyBot({ elapsed_ms: 300 })).toBe(true);
    expect(isLikelyBot({ elapsed_ms: 5000 })).toBe(false);
    expect(isLikelyBot({})).toBe(false);
  });
});

describe("priceSiteOrder — price comes only from the server rows", () => {
  it("recomputes totals from the database price", () => {
    const r = priceSiteOrder(
      [
        { product_id: A, qty: 2 },
        { product_id: B, qty: 1 },
      ],
      ROWS,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines.map((l) => l.unitPriceCents)).toEqual([8990, 10990]);
    expect(r.totalCents).toBe(2 * 8990 + 10990);
  });

  it("ignores any price-like field smuggled into the requested item", () => {
    const tampered = [{ product_id: A, qty: 1, unit_price_cents: 1 } as { product_id: string; qty: number }];
    const r = priceSiteOrder(tampered, ROWS);
    expect(r.ok && r.totalCents).toBe(8990);
  });

  it("refuses an item the server did not return (unpublished / other org)", () => {
    const r = priceSiteOrder([{ product_id: C, qty: 1 }], ROWS);
    expect(r).toEqual({ ok: false, code: "item_not_found", productIds: [C] });
  });

  it("refuses sold-out items but accepts sob_encomenda", () => {
    const rows: OrderableProductRow[] = [
      { ...ROWS[0]!, availability: "esgotado" },
      ROWS[1]!,
    ];
    expect(priceSiteOrder([{ product_id: A, qty: 1 }], rows)).toEqual({
      ok: false,
      code: "item_unavailable",
      productIds: [A],
    });
    expect(priceSiteOrder([{ product_id: B, qty: 1 }], rows).ok).toBe(true);
  });

  it("refuses an item without price", () => {
    const rows: OrderableProductRow[] = [{ ...ROWS[0]!, salePriceCents: null }];
    expect(priceSiteOrder([{ product_id: A, qty: 1 }], rows)).toEqual({
      ok: false,
      code: "item_without_price",
      productIds: [A],
    });
  });
});

describe("message", () => {
  it("lists items, unit price, total and the short id", () => {
    const priced = priceSiteOrder([{ product_id: A, qty: 2 }], ROWS);
    if (!priced.ok) throw new Error("expected ok");
    const msg = buildSiteOrderMessage({
      shortId: orderShortId("3f2a9c1e-0000-4000-8000-000000000000"),
      customerName: "Ana",
      lines: priced.lines,
      totalCents: priced.totalCents,
      notes: "Entregar à tarde",
    });
    expect(msg).toContain("#3F2A9C1E");
    expect(msg).toContain("2x PLA Preto 1 kg · Voolt");
    expect(msg).toMatch(/R\$\s?89,90 cada/);
    expect(msg).toMatch(/Total: R\$\s?179,80/);
    expect(msg).toContain("Observações: Entregar à tarde");
  });
});
