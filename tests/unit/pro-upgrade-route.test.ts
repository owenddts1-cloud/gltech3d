// @vitest-environment node
/**
 * POST /api/v1/pro-signup/upgrade must NEVER touch a pending PUBLIC request
 * with the same e-mail (pendência 18 / PRO hijack): signup does not verify the
 * e-mail, so a logged-in account with the buyer's e-mail proves nothing. The
 * in-app request is refused with a pt-BR message and audited; nothing is
 * cancelled or updated.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextServer from "next/server";
import type { NextRequest } from "next/server";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

interface Call {
  table: string;
  op: "select" | "update" | "insert";
  filters: Array<[string, unknown]>;
}
type Result = { data: unknown; error: { message: string; code?: string } | null };
let calls: Call[] = [];
let handler: (call: Call) => Result = () => ({ data: null, error: null });

function admin() {
  return {
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      const b = {
        select: () => b,
        insert: () => ((call.op = "insert"), b),
        update: () => ((call.op = "update"), b),
        eq: (c: string, v: unknown) => (call.filters.push([c, v]), b),
        is: (c: string, v: unknown) => (call.filters.push([c, v]), b),
        single: async () => (calls.push(call), handler(call)),
        maybeSingle: async () => (calls.push(call), handler(call)),
      };
      return b;
    },
  };
}

const auditMock = vi.fn(async () => undefined);

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof NextServer>()), after: () => undefined }));
vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: async () => ({ id: "user-1", email: "Vitima@X.com", is_platform_admin: false, organizations: [] }),
  resolveActiveOrg: async () => ({ orgId: ORG, name: "Org do usuário", role: "admin" }),
}));
vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: true, count: 1, limit: 3, window_sec: 3600 }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin() }));
vi.mock("@/lib/audit", () => ({ audit: (...a: unknown[]) => auditMock(...(a as [])) }));
vi.mock("@/lib/pricing/settings", async () => {
  const { proPlanWith } = await import("@/lib/pricing/pro-plans");
  return { getProPlanLive: async () => proPlanWith({ amountCents: 8900, periodDays: 365 }) };
});

const { POST } = await import("@/app/api/v1/pro-signup/upgrade/route");

function request(): NextRequest {
  return new Request("http://localhost/api/v1/pro-signup/upgrade", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ buyer_name: "Atacante", buyer_phone: "31988887777" }),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  calls = [];
  auditMock.mockClear();
});

describe("POST /api/v1/pro-signup/upgrade — pending request of the same e-mail", () => {
  it("a pending PUBLIC request blocks the in-app one: 409, audited, nothing updated", async () => {
    handler = (call) => {
      if (call.op === "insert") return { data: null, error: { message: "dup", code: "23505" } };
      if (call.op === "select") return { data: { id: "public-req", organization_id: null }, error: null };
      return { data: null, error: null };
    };
    const res = await POST(request());
    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(json.error.message).toContain("Já existe um pedido pendente com este e-mail");
    expect(calls.some((c) => c.op === "update")).toBe(false);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "pro_signup.blocked_by_pending", resourceId: "public-req" }),
    );
    // The insert used the normalized e-mail.
    const lookup = calls.find((c) => c.op === "select");
    expect(lookup?.filters).toContainEqual(["buyer_email", "vitima@x.com"]);
  });

  it("our OWN pending request (resubmit) stays a silent duplicate", async () => {
    handler = (call) => {
      if (call.op === "insert") return { data: null, error: { message: "dup", code: "23505" } };
      if (call.op === "select") return { data: { id: "own-req", organization_id: ORG }, error: null };
      return { data: null, error: null };
    };
    const res = await POST(request());
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { duplicate: boolean } };
    expect(json.data.duplicate).toBe(true);
    expect(auditMock).not.toHaveBeenCalled();
    expect(calls.some((c) => c.op === "update")).toBe(false);
  });
});
