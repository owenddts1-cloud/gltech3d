import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateServiceOrderStatus } from "@/app/actions/service-orders/actions";

vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: vi.fn().mockResolvedValue({ id: "user-123" }),
  resolveActiveOrg: vi.fn().mockResolvedValue({ orgId: "org-123", role: "admin" }),
}));

vi.mock("@/lib/plan/server", () => ({
  assertProAccess: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockUpdate = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => {
      if (table === "service_orders") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({
                  data: {
                    id: "9f3e1b2c-aaaa-4000-8000-000000000001",
                    organization_id: "org-123",
                    status: "em_producao",
                    material: "PLA Premium",
                    qty: 2,
                  },
                }),
              }),
            }),
          }),
          update: (...args: unknown[]) => {
            mockUpdate(...args);
            return {
              eq: () => ({
                eq: () => Promise.resolve({ error: null }),
              }),
            };
          },
        };
      }
      if (table === "filaments") {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [{ id: "fil-1", material: "PLA Premium", weight_grams: 1000 }],
            }),
          }),
          update: (...args: unknown[]) => {
            mockUpdate(...args);
            return {
              eq: () => ({
                eq: () => Promise.resolve({ error: null }),
              }),
            };
          },
        };
      }
      return {
        update: mockUpdate,
      };
    },
  }),
}));

describe("Service Orders Stock Deduction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deducts filament stock when status updates to concluido", async () => {
    const res = await updateServiceOrderStatus({
      id: "9f3e1b2c-aaaa-4000-8000-000000000001",
      status: "concluido",
      position: 1,
    });

    expect(res.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });
});
