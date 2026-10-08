import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInsert, mockSelect, mockUpdate, mockEq, mockFrom, mockOrder, mockSingle } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockOrder = vi.fn();
  const mockUpdate = vi.fn();
  const mockEq = vi.fn();
  
  mockEq.mockReturnValue({
    eq: mockEq,
    single: mockSingle,
    order: mockOrder,
  });

  const mockSelect = vi.fn(() => ({
    eq: mockEq,
    order: mockOrder,
    single: mockSingle,
  }));

  const mockInsert = vi.fn(() => ({
    select: mockSelect,
  }));

  const mockFrom = vi.fn(() => ({
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
  }));

  return { mockInsert, mockSelect, mockUpdate, mockEq, mockFrom, mockOrder, mockSingle };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: mockFrom,
  }),
}));

vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: vi.fn().mockResolvedValue({ id: "user-123" }),
  resolveActiveOrg: vi.fn().mockResolvedValue({ orgId: "org-123", role: "admin" }),
}));

vi.mock("@/lib/plan/server", () => ({
  assertProAccess: vi.fn().mockResolvedValue(null),
}));

import {
  fetchAccountsPayableAction,
  createAccountPayableAction,
  markPayableAsPaidAction,
} from "@/app/actions/financial/payable";

describe("Accounts Payable Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new account payable for filament supplies", async () => {
    mockSingle.mockResolvedValue({ data: { id: "ap-99" }, error: null });

    const res = await createAccountPayableAction({
      supplier_name: "3D Fila Indústria",
      category: "filamentos",
      description: "Lote de 10x Bobinas PETG Preto 1kg",
      amount_cents: 85000, // R$ 850.00
      due_date: "2026-10-25",
      payment_method: "pix",
      purchase_request_id: "req-sentinel-01",
    });

    expect(res.ok).toBe(true);
    expect(res.id).toBe("ap-99");
    expect(mockFrom).toHaveBeenCalledWith("accounts_payable");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-123",
        supplier_name: "3D Fila Indústria",
        category: "filamentos",
        amount_cents: 85000,
        due_date: "2026-10-25",
        purchase_request_id: "req-sentinel-01",
        status: "pending",
      })
    );
  });

  it("marks payable as paid and synchronizes with financial records", async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: "ap-99",
        supplier_name: "3D Fila Indústria",
        category: "filamentos",
        description: "Lote de 10x Bobinas PETG",
        amount_cents: 85000,
        payment_method: "pix",
      },
      error: null,
    });

    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const res = await markPayableAsPaidAction("ap-99");
    expect(res.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "paid",
      })
    );
  });
});
