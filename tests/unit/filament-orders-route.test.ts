// @vitest-environment node
/**
 * POST /api/v1/public/filament-orders — the guards that matter, end to end
 * through the route with an in-memory Supabase:
 *  - the price is recomputed from the database (a tampered body is a 422 and
 *    never reaches the insert);
 *  - unpublished / other-org / sold-out items refuse the order;
 *  - the org comes from the server, never from the body.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_ORG = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PLA = "11111111-1111-4111-8111-111111111111";
const DRAFT = "22222222-2222-4222-8222-222222222222";
const FOREIGN = "33333333-3333-4333-8333-333333333333";
const SOLD_OUT = "44444444-4444-4444-8444-444444444444";
const PIECE = "55555555-5555-4555-8555-555555555555";

type RowData = Record<string, unknown>;
const tables: Record<string, RowData[]> = {};

function seed() {
  tables.products = [
    { id: PLA, organization_id: ORG, kind: "filamento", is_published: true, name: "PLA Preto 1 kg", sale_price_cents: 8990, product_filament_specs: { availability: "em_estoque" } },
    { id: DRAFT, organization_id: ORG, kind: "filamento", is_published: false, name: "Rascunho", sale_price_cents: 100, product_filament_specs: { availability: "em_estoque" } },
    { id: FOREIGN, organization_id: OTHER_ORG, kind: "filamento", is_published: true, name: "Outra loja", sale_price_cents: 100, product_filament_specs: { availability: "em_estoque" } },
    { id: SOLD_OUT, organization_id: ORG, kind: "filamento", is_published: true, name: "Esgotado", sale_price_cents: 5000, product_filament_specs: { availability: "esgotado" } },
    { id: PIECE, organization_id: ORG, kind: "peca", is_published: true, name: "Vaso", sale_price_cents: 100, product_filament_specs: null },
  ];
  tables.site_orders = [];
  tables.site_order_items = [];
}

/** Minimal PostgREST-like builder: eq/in filters, insert(+select/single), delete. */
function builder(table: string) {
  const filters: Array<(r: RowData) => boolean> = [];
  let inserted: RowData[] | null = null;
  let deleting = false;
  const api = {
    select: () => api,
    eq: (col: string, val: unknown) => {
      filters.push((r) => r[col] === val);
      return api;
    },
    in: (col: string, vals: unknown[]) => {
      filters.push((r) => vals.includes(r[col]));
      return api;
    },
    insert: (rows: RowData | RowData[]) => {
      const list = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ id: crypto.randomUUID(), ...r }));
      tables[table]!.push(...list);
      inserted = list;
      return api;
    },
    delete: () => {
      deleting = true;
      return api;
    },
    single: async () => ({ data: inserted?.[0] ?? null, error: null }),
    then: (resolve: (v: { data: RowData[] | null; error: null }) => unknown) => {
      if (inserted) return Promise.resolve(resolve({ data: inserted, error: null }));
      const match = tables[table]!.filter((r) => filters.every((f) => f(r)));
      if (deleting) tables[table] = tables[table]!.filter((r) => !match.includes(r));
      return Promise.resolve(resolve({ data: match, error: null }));
    },
  };
  return api;
}

const auditMock = vi.fn(async () => undefined);

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: builder }) }));
vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: true, count: 1, limit: 5, window_sec: 600 }),
}));
vi.mock("@/lib/audit", () => ({ audit: (...args: unknown[]) => auditMock(...(args as [])) }));
vi.mock("@/lib/landing/repository", () => ({ resolveLandingOrgId: async () => ORG }));
vi.mock("@/lib/landing/whatsapp", () => ({ getStoreWhatsapp: async () => "5531999284834" }));

const { POST } = await import("@/app/api/v1/public/filament-orders/route");

function request(body: unknown): NextRequest {
  return new Request("http://localhost/api/v1/public/filament-orders", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "203.0.113.7" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const base = { customer_name: "Ana Souza", customer_whatsapp: "31988887777", elapsed_ms: 6000 };

beforeEach(() => {
  seed();
  auditMock.mockClear();
});

describe("POST /api/v1/public/filament-orders", () => {
  it("creates the order with the DATABASE price and returns the wa.me link", async () => {
    const res = await POST(request({ ...base, items: [{ product_id: PLA, qty: 3 }] }));
    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: { total_cents: number; whatsapp_url: string; short_id: string } };
    expect(json.data.total_cents).toBe(3 * 8990);
    expect(json.data.whatsapp_url.startsWith("https://wa.me/5531999284834?text=")).toBe(true);
    expect(decodeURIComponent(json.data.whatsapp_url)).toContain(`#${json.data.short_id}`);

    expect(tables.site_orders).toHaveLength(1);
    expect(tables.site_orders![0]).toMatchObject({ organization_id: ORG, total_cents: 26970, status: "novo" });
    expect(tables.site_order_items![0]).toMatchObject({ product_id: PLA, qty: 3, unit_price_cents: 8990 });
    expect(auditMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a tampered price (unknown key) before touching the database", async () => {
    const res = await POST(
      request({ ...base, items: [{ product_id: PLA, qty: 1, unit_price_cents: 1 }] }),
    );
    expect(res.status).toBe(422);
    const res2 = await POST(request({ ...base, total_cents: 1, items: [{ product_id: PLA, qty: 1 }] }));
    expect(res2.status).toBe(422);
    const res3 = await POST(
      request({ ...base, organization_id: OTHER_ORG, items: [{ product_id: PLA, qty: 1 }] }),
    );
    expect(res3.status).toBe(422);
    expect(tables.site_orders).toHaveLength(0);
  });

  it.each([
    ["unpublished", DRAFT],
    ["other org", FOREIGN],
    ["a piece, not a filament", PIECE],
  ])("refuses an item that is %s", async (_label, id) => {
    const res = await POST(request({ ...base, items: [{ product_id: PLA, qty: 1 }, { product_id: id, qty: 1 }] }));
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: { code: string; details: { product_ids: string[] } } };
    expect(json.error.code).toBe("item_not_found");
    expect(json.error.details.product_ids).toEqual([id]);
    expect(tables.site_orders).toHaveLength(0);
  });

  it("refuses a sold-out item", async () => {
    const res = await POST(request({ ...base, items: [{ product_id: SOLD_OUT, qty: 1 }] }));
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("item_unavailable");
  });

  it("answers a bot like a success and writes nothing", async () => {
    const res = await POST(request({ ...base, website: "spam", items: [{ product_id: PLA, qty: 1 }] }));
    expect(res.status).toBe(201);
    expect(tables.site_orders).toHaveLength(0);
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("processes orders with fallback catalog filament IDs cleanly", async () => {
    const res = await POST(
      request({ ...base, items: [{ product_id: "pla-premium-marmore", qty: 1 }] }),
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: { total_cents: number; whatsapp_url: string; short_id: string } };
    expect(json.data.total_cents).toBe(9200);
    expect(decodeURIComponent(json.data.whatsapp_url)).toContain("PLA Premium Mármore");
    expect(tables.site_orders).toHaveLength(1);
    expect(tables.site_orders![0]).toMatchObject({ total_cents: 9200, status: "novo" });
    expect(tables.site_order_items![0]).toMatchObject({ product_id: null, product_name: "PLA Premium Mármore", qty: 1, unit_price_cents: 9200 });
  });
});
