import { describe, it, expect, vi } from "vitest";
import { fetchChannelIntegration, saveChannelCredentials, simulateTestSale } from "@/app/actions/sales/channels";

vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: vi.fn().mockResolvedValue({ id: "user-123" }),
  resolveActiveOrg: vi.fn().mockResolvedValue({ orgId: "org-123", role: "admin" }),
}));

vi.mock("@/lib/plan/server", () => ({
  assertProAccess: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({
              data: {
                id: "int-123",
                platform: "Shopee",
                is_enabled: true,
                credentials: { partner_id: "12345" },
                webhook_secret: "whsec_test123",
                last_synced_at: "2026-10-06T20:00:00Z",
              },
              error: null,
            }),
          }),
        }),
      }),
      upsert: () => Promise.resolve({ error: null }),
      insert: () => Promise.resolve({ error: null }),
      update: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
    }),
  }),
}));

describe("Sales Channels Actions", () => {
  it("fetches channel integration details", async () => {
    const res = await fetchChannelIntegration("Shopee");
    expect(res.ok).toBe(true);
    expect(res.integration?.platform).toBe("Shopee");
    expect(res.integration?.credentials.partner_id).toBe("12345");
  });

  it("saves channel credentials cleanly", async () => {
    const res = await saveChannelCredentials("Shopee", true, { partner_id: "999" });
    expect(res.ok).toBe(true);
  });

  it("simulates a test sale and generates financial record", async () => {
    const res = await simulateTestSale("Shopee");
    expect(res.ok).toBe(true);
    expect(res.saleId).toBeDefined();
    expect(res.financialRecordId).toBeDefined();
  });
});
