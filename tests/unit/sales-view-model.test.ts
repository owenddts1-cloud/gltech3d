import { describe, expect, it } from "vitest";
import type { SaleRow } from "@/lib/sales/config";
import {
  DEFAULT_FILTERS,
  addDays,
  applyFilters,
  buildCsv,
  computeKpis,
  deltaPct,
  orderCode,
  pendingOlderThan,
  previousRange,
  resolveRange,
  sparkSeries,
  type SalesFilters,
} from "@/app/app/sales/_lib/view-model";
import { FULFILLMENT_LABEL, PAYMENT_LABEL } from "@/lib/sales/config";

const TODAY = "2026-07-17";

function sale(patch: Partial<SaleRow>): SaleRow {
  return {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    platform: "Shopee",
    channelId: null,
    customerName: "Maria",
    status: "pago",
    fulfillmentStatus: "confirmada",
    paymentStatus: "pago",
    boardPosition: null,
    totalCents: 10_000,
    commissionCents: 1_000,
    contactId: null,
    productId: null,
    productName: null,
    qty: 1,
    costCents: null,
    soldAt: TODAY,
    notes: null,
    ...patch,
  };
}

function filters(patch: Partial<SalesFilters>): SalesFilters {
  return { ...DEFAULT_FILTERS, ...patch };
}

describe("date math", () => {
  it("addDays crosses month boundaries", () => {
    expect(addDays("2026-07-01", -1)).toBe("2026-06-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("resolveRange presets", () => {
    expect(resolveRange(filters({ preset: "hoje" }), TODAY)).toEqual({ from: TODAY, to: TODAY });
    expect(resolveRange(filters({ preset: "7d" }), TODAY)).toEqual({ from: "2026-07-11", to: TODAY });
    expect(resolveRange(filters({ preset: "tudo" }), TODAY)).toEqual({ from: null, to: null });
    expect(
      resolveRange(filters({ preset: "custom", customFrom: "2026-01-01", customTo: "2026-01-31" }), TODAY),
    ).toEqual({ from: "2026-01-01", to: "2026-01-31" });
  });

  it("previousRange shifts an equivalent window back", () => {
    expect(previousRange({ from: "2026-07-11", to: "2026-07-17" })).toEqual({
      from: "2026-07-04",
      to: "2026-07-10",
    });
    expect(previousRange({ from: null, to: null })).toBeNull();
  });
});

describe("filtering", () => {
  const ana = sale({ id: "11111111-0000-0000-0000-000000000000", customerName: "Ana", soldAt: "2026-07-16" });
  const bruno = sale({ id: "22222222-0000-0000-0000-000000000000", customerName: "Bruno", platform: "Olx", paymentStatus: "pendente", soldAt: "2026-06-01" });
  const rows = [ana, bruno];

  it("filters by date range", () => {
    expect(applyFilters(rows, filters({ preset: "7d" }), TODAY)).toHaveLength(1);
    expect(applyFilters(rows, filters({ preset: "tudo" }), TODAY)).toHaveLength(2);
  });

  it("filters by search (customer and order code) and facets", () => {
    expect(applyFilters(rows, filters({ search: "bru" }), TODAY)).toHaveLength(1);
    expect(applyFilters(rows, filters({ search: orderCode(ana).toLowerCase() }), TODAY)).toHaveLength(1);
    expect(applyFilters(rows, filters({ platforms: ["Olx"] }), TODAY)).toHaveLength(1);
    expect(applyFilters(rows, filters({ payments: ["pendente"] }), TODAY)).toHaveLength(1);
  });
});

describe("kpis & deltas", () => {
  it("excludes legacy-cancelled sales from money KPIs", () => {
    const k = computeKpis([sale({}), sale({ status: "cancelado", totalCents: 99_999 })]);
    expect(k.totalCents).toBe(10_000);
    expect(k.netCents).toBe(9_000);
    expect(k.count).toBe(1);
    expect(k.avgTicketCents).toBe(10_000);
  });

  it("subtracts linked-product production cost from the net (E5)", () => {
    const k = computeKpis([
      sale({ costCents: 2_500, productId: "p1", productName: "Peça", qty: 1 }),
      sale({ id: "b", costCents: null }),
    ]);
    // total 20.000 − comissões 2.000 − custo 2.500 = 15.500
    expect(k.totalCents).toBe(20_000);
    expect(k.costCents).toBe(2_500);
    expect(k.netCents).toBe(15_500);
  });

  it("deltaPct returns null without a previous baseline", () => {
    expect(deltaPct(100, 0)).toBeNull();
    expect(deltaPct(150, 100)).toBe(50);
  });
});

describe("sparkline buckets", () => {
  it("distributes totals across the range", () => {
    const rows = [
      sale({ soldAt: "2026-07-06" }),
      sale({ soldAt: "2026-07-17", totalCents: 20_000 }),
    ];
    const s = sparkSeries(rows, { from: "2026-07-06", to: "2026-07-17" }, 4);
    expect(s.total).toHaveLength(4);
    expect(s.total[0]).toBe(10_000);
    expect(s.total[3]).toBe(20_000);
    expect(s.count.reduce((a, b) => a + b, 0)).toBe(2);
  });
});

describe("pending alert", () => {
  it("only counts unpaid sales older than 7 days", () => {
    const rows = [
      sale({ paymentStatus: "pendente", soldAt: "2026-07-01" }), // velha → conta
      sale({ paymentStatus: "pendente", soldAt: "2026-07-15" }), // recente → não
      sale({ paymentStatus: "pago", soldAt: "2026-06-01" }), // paga → não
    ];
    const pending = pendingOlderThan(rows, TODAY);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.soldAt).toBe("2026-07-01");
  });
});

describe("csv", () => {
  it("builds a semicolon CSV with BOM and pt-BR money", () => {
    const csv = buildCsv([sale({ customerName: 'Zé "Impressões"' })], {
      fulfillment: FULFILLMENT_LABEL,
      payment: PAYMENT_LABEL,
    });
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Zé ""Impressões"""');
    expect(csv).toContain("100,00");
    expect(csv).toContain("Confirmada");
  });
});
