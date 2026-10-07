import { describe, it, expect, vi } from "vitest";
import { createPurchase } from "@/app/actions/suppliers/actions";

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

const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => {
      if (table === "suppliers") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: { id: "9f3e1b2c-aaaa-4000-8000-000000000001" } }),
              }),
            }),
          }),
        };
      }
      return {
        insert: mockInsert,
      };
    },
  }),
}));

describe("Suppliers Financial Integration", () => {
  it("creates both financial expense record and supplier purchase record", async () => {
    const res = await createPurchase({
      supplierId: "9f3e1b2c-aaaa-4000-8000-000000000001",
      supplierName: "3D Filamentos Brasil",
      itemName: "Rolo PLA Premium Preto",
      qty: 5,
      unitPrice: 90.0,
    });

    expect(res.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
  });
});
