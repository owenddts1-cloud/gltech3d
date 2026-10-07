import { describe, it, expect, vi } from "vitest";
import { reconcileFinancialRecords } from "@/app/actions/control/actions";

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
      update: () => ({
        eq: () => ({
          in: () => ({
            select: () => Promise.resolve({ data: [{ id: "rec-1" }, { id: "rec-2" }], error: null }),
          }),
        }),
      }),
    }),
  }),
}));

describe("reconcileFinancialRecords Action", () => {
  it("reconciles records in batch cleanly", async () => {
    const res = await reconcileFinancialRecords(["rec-1", "rec-2"]);
    expect(res.ok).toBe(true);
    expect(res.count).toBe(2);
  });

  it("handles empty array without error", async () => {
    const res = await reconcileFinancialRecords([]);
    expect(res.ok).toBe(true);
    expect(res.count).toBe(0);
  });
});
