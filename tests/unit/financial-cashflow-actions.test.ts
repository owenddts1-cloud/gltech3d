import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSelect, mockUpdate, mockEq, mockFrom, mockOrder, mockLimit } = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockOrder = vi.fn(() => ({ limit: mockLimit }));
  const mockUpdate = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn(() => ({
    eq: mockEq,
    order: mockOrder,
  }));
  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
  }));
  return { mockSelect, mockUpdate, mockEq, mockFrom, mockOrder, mockLimit };
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
  fetchCashflowSummaryAction,
  reconcilePixTransactionAction,
} from "@/app/actions/financial/cashflow";

describe("Cashflow Projection & Pix Conciliation Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates cashflow summary with realized and projected amounts", async () => {
    const mockRecords = [
      {
        id: "tx-1",
        type: "Receita",
        revenue_cents: 30000,
        expense_cents: 0,
        status: "reconciled",
        is_projected: false,
        payment_method: "pix",
      },
      {
        id: "tx-2",
        type: "Despesa",
        revenue_cents: 0,
        expense_cents: 10000,
        status: "reconciled",
        is_projected: false,
        payment_method: "pix",
      },
      {
        id: "tx-3",
        type: "Receita",
        revenue_cents: 15000,
        expense_cents: 0,
        status: "pending",
        is_projected: true,
        payment_method: "pix",
      },
      {
        id: "tx-4",
        type: "Despesa",
        revenue_cents: 0,
        expense_cents: 5000,
        status: "pending",
        is_projected: true,
        payment_method: "bank_slip",
      },
    ];

    mockEq.mockResolvedValue({ data: mockRecords, error: null });

    const res = await fetchCashflowSummaryAction();
    expect(res.ok).toBe(true);
    expect(res.data?.currentBalanceCents).toBe(20000); // 30000 - 10000
    expect(res.data?.projectedInflowCents).toBe(15000);
    expect(res.data?.projectedOutflowCents).toBe(5000);
    expect(res.data?.projectedBalanceCents).toBe(30000); // 20000 + 15000 - 5000
    expect(res.data?.unreconciledPixCount).toBe(1);
  });

  it("reconciles individual Pix transaction with end-to-end identifier", async () => {
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const res = await reconcilePixTransactionAction({
      transaction_id: "tx-pending-pix",
      pix_e2e_id: "E004169682026100721000",
    });

    expect(res.ok).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("financial_records");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "reconciled",
        pix_e2e_id: "E004169682026100721000",
      })
    );
  });
});
