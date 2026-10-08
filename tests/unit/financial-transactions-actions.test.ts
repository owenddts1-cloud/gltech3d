import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInsert, mockSelect, mockSingle, mockFrom } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockSelect = vi.fn(() => ({ single: mockSingle }));
  const mockInsert = vi.fn(() => ({ select: mockSelect }));
  const mockFrom = vi.fn(() => ({
    insert: mockInsert,
    select: mockSelect,
  }));
  return { mockInsert, mockSelect, mockSingle, mockFrom };
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
  recordSiteOrderRevenueAction,
  recordFarmJobCostAction,
  createOperationalExpenseAction,
} from "@/app/actions/financial/transactions";

describe("Financial Transactions Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: { id: "rec-new-123" }, error: null });
  });

  it("records site order revenue automatically with payment method and channel", async () => {
    const res = await recordSiteOrderRevenueAction({
      order_id: "order-abc-1",
      customer_name: "Guilherme Santos",
      total_cents: 18500, // R$ 185.00
      payment_method: "pix",
      channel: "site_filaments",
      pix_e2e_id: "E1234567820261007",
      platform_fee_cents: 350,
    });

    expect(res.ok).toBe(true);
    expect(res.transaction_id).toBe("rec-new-123");
    expect(mockFrom).toHaveBeenCalledWith("financial_records");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-123",
        order_id: "order-abc-1",
        revenue_cents: 18500,
        type: "Receita",
        channel: "site_filaments",
        payment_method: "pix",
        pix_e2e_id: "E1234567820261007",
      })
    );
  });

  it("debits farm direct production costs (CPV filament + machine hours)", async () => {
    const res = await recordFarmJobCostAction({
      job_id: "job-xyz-9",
      order_id: "order-abc-1",
      consumed_mass_g: 200,
      spool_cost_per_kg: 95.0,
      print_time_hours: 4.0,
      hourly_machine_rate_brl: 1.5,
    });

    expect(res.ok).toBe(true);
    expect(res.cpv_filament_cost_cents).toBe(1900);
    expect(res.cpv_machine_cost_cents).toBe(600);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-123",
        production_job_id: "job-xyz-9",
        type: "Despesa",
        category: "CPV Impressão 3D",
        expense_cents: 2500,
        cpv_filament_cost_cents: 1900,
        cpv_machine_cost_cents: 600,
      })
    );
  });

  it("creates operational expense with category and due date", async () => {
    const res = await createOperationalExpenseAction({
      description: "Conta de Luz - Oficina Outubro",
      category: "Energia Elétrica",
      amount_cents: 45000,
      due_date: "2026-10-20",
      payment_method: "bank_slip",
    });

    expect(res.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-123",
        type: "Despesa",
        category: "Energia Elétrica",
        expense_cents: 45000,
        due_date: "2026-10-20",
      })
    );
  });
});
