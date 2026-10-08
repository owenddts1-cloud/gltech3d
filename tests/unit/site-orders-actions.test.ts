// @vitest-environment node
/**
 * CRM actions of the public cart orders (app/actions/site-orders/actions.ts):
 *  - a viewer is refused BEFORE any write (the conversion writes converted_at
 *    with the service role, where RLS no longer guards);
 *  - the conversion claims/reverts converted_at through the SERVICE ROLE,
 *    filtered by the session org + id + `converted_at is null`;
 *  - a status change other than 'confirmado' loses the race against a
 *    conversion instead of overwriting it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORDER = "11111111-1111-4111-8111-111111111111";
const PRODUCT = "22222222-2222-4222-8222-222222222222";

interface Call {
  client: "user" | "admin";
  table: string;
  op: "select" | "update" | "insert";
  payload?: unknown;
  filters: Array<[string, string, unknown]>;
}
type Result = { data: unknown; error: { message: string; code?: string } | null };

let calls: Call[] = [];
let handler: (call: Call) => Result = () => ({ data: null, error: null });

function client(kind: "user" | "admin") {
  return {
    from(table: string) {
      const call: Call = { client: kind, table, op: "select", filters: [] };
      const b = {
        select: () => b,
        update: (payload: unknown) => {
          call.op = "update";
          call.payload = payload;
          return b;
        },
        insert: (payload: unknown) => {
          call.op = "insert";
          call.payload = payload;
          return b;
        },
        eq: (c: string, v: unknown) => (call.filters.push(["eq", c, v]), b),
        is: (c: string, v: unknown) => (call.filters.push(["is", c, v]), b),
        order: () => b,
        limit: () => b,
        maybeSingle: async () => {
          calls.push(call);
          return handler(call);
        },
        then: (resolve: (r: Result) => unknown) => {
          calls.push(call);
          return Promise.resolve(resolve(handler(call)));
        },
      };
      return b;
    },
  };
}

let role: "viewer" | "agent" | "manager" | "admin" = "agent";
const assertProAccess = vi.fn(async (): Promise<string | null> => null);
const auditMock = vi.fn(async () => undefined);

vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: async () => ({ id: "user-1", email: "a@b.c", is_platform_admin: false, organizations: [] }),
  resolveActiveOrg: async () => ({ orgId: ORG, name: "Org", role }),
}));
vi.mock("@/lib/plan/server", () => ({ assertProAccess: () => assertProAccess() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => client("user") }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => client("admin") }));
vi.mock("@/lib/audit", () => ({ audit: (...a: unknown[]) => auditMock(...(a as [])) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { convertSiteOrderToSales, updateSiteOrderStatus } = await import("@/app/actions/site-orders/actions");

const ORDER_ROW = {
  id: ORDER,
  customer_name: "Ana",
  customer_whatsapp: "5531988887777",
  status: "novo",
  total_cents: 17980,
  source: "site_filamentos",
  notes: null,
  converted_at: null,
  created_at: "2026-10-08T12:00:00Z",
  updated_at: null,
  site_order_items: [{ id: "i1", product_id: PRODUCT, product_name: "PLA", qty: 2, unit_price_cents: 8990 }],
};

beforeEach(() => {
  calls = [];
  role = "agent";
  assertProAccess.mockResolvedValue(null);
  auditMock.mockClear();
  handler = (call) => {
    if (call.table === "site_orders" && call.op === "select") return { data: ORDER_ROW, error: null };
    if (call.table === "site_orders" && call.op === "update") return { data: [{ id: ORDER }], error: null };
    if (call.table === "marketplace_orders") return { data: [{ id: "sale-1" }], error: null };
    return { data: null, error: null };
  };
});

describe("site orders — role and plan gates", () => {
  it("a viewer is refused before any write", async () => {
    role = "viewer";
    const conv = await convertSiteOrderToSales(ORDER);
    expect(conv).toMatchObject({ ok: false });
    const upd = await updateSiteOrderStatus({ id: ORDER, status: "cancelado" });
    expect(upd).toMatchObject({ ok: false });
    expect(calls).toHaveLength(0);
  });

  it("without PRO nothing is written", async () => {
    assertProAccess.mockResolvedValue("Recurso disponível no Calc3D PRO.");
    const r = await convertSiteOrderToSales(ORDER);
    expect(r).toEqual({ ok: false, error: "Recurso disponível no Calc3D PRO." });
    expect(calls).toHaveLength(0);
  });
});

describe("convertSiteOrderToSales", () => {
  it("claims converted_at with the SERVICE ROLE, scoped to org + id + not converted", async () => {
    const r = await convertSiteOrderToSales(ORDER);
    expect(r).toMatchObject({ ok: true, salesCreated: 1 });

    const claim = calls.find((c) => c.table === "site_orders" && c.op === "update");
    expect(claim?.client).toBe("admin");
    expect(claim?.filters).toEqual(
      expect.arrayContaining([
        ["eq", "organization_id", ORG],
        ["eq", "id", ORDER],
        ["is", "converted_at", null],
      ]),
    );
    const sale = calls.find((c) => c.table === "marketplace_orders");
    expect(sale?.client).toBe("user");
    expect(sale?.payload).toEqual([
      expect.objectContaining({ organization_id: ORG, product_id: PRODUCT, qty: 2, total_cents: 17980, platform: "Outro" }),
    ]);
  });

  it("a failed sales insert reverts ONLY our claim, via the service role", async () => {
    const base = handler;
    handler = (call) =>
      call.table === "marketplace_orders" ? { data: null, error: { message: "boom" } } : base(call);
    const r = await convertSiteOrderToSales(ORDER);
    expect(r).toMatchObject({ ok: false });
    const updates = calls.filter((c) => c.table === "site_orders" && c.op === "update");
    expect(updates).toHaveLength(2);
    expect(updates[1]?.client).toBe("admin");
    expect(updates[1]?.payload).toMatchObject({ converted_at: null });
    expect(updates[1]?.filters).toContainEqual(["eq", "organization_id", ORG]);
    expect(updates[1]?.filters.some(([op, col]) => op === "eq" && col === "converted_at")).toBe(true);
  });

  it("lost claim (already converted by another click) creates no sale", async () => {
    const base = handler;
    handler = (call) =>
      call.table === "site_orders" && call.op === "update" ? { data: [], error: null } : base(call);
    const r = await convertSiteOrderToSales(ORDER);
    expect(r).toMatchObject({ ok: false });
    expect(calls.some((c) => c.table === "marketplace_orders")).toBe(false);
  });
});

describe("updateSiteOrderStatus — race with a conversion", () => {
  it("cancelling only applies while converted_at is null; 0 rows = already converted", async () => {
    const base = handler;
    handler = (call) =>
      call.table === "site_orders" && call.op === "update" ? { data: [], error: null } : base(call);
    const r = await updateSiteOrderStatus({ id: ORDER, status: "cancelado" });
    expect(r).toEqual({
      ok: false,
      error: "Este pedido já virou venda. Para desfazer, cancele as vendas na tela de Vendas.",
    });
    const upd = calls.find((c) => c.op === "update");
    expect(upd?.client).toBe("user");
    expect(upd?.payload).toEqual({ status: "cancelado" });
    expect(upd?.filters).toContainEqual(["is", "converted_at", null]);
  });
});
