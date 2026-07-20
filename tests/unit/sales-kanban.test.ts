import { describe, expect, it } from "vitest";
import type { SaleRow } from "@/lib/sales/config";
import {
  computeDropPosition,
  sortColumnCards,
  staleCount,
} from "@/app/app/sales/_lib/kanban";

const TODAY = "2026-07-17";

function sale(patch: Partial<SaleRow>): SaleRow {
  return {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    platform: "Shopee",
    customerName: "Maria",
    status: "pago",
    fulfillmentStatus: "produzindo",
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

describe("sortColumnCards", () => {
  it("orders by boardPosition asc, nulls last by soldAt desc", () => {
    const rows = [
      sale({ id: "n1", boardPosition: null, soldAt: "2026-07-01" }),
      sale({ id: "p2", boardPosition: 2000 }),
      sale({ id: "n2", boardPosition: null, soldAt: "2026-07-10" }),
      sale({ id: "p1", boardPosition: 1000 }),
    ];
    expect(sortColumnCards(rows).map((r) => r.id)).toEqual(["p1", "p2", "n2", "n1"]);
  });

  it("does not mutate the input array", () => {
    const rows = [sale({ id: "b", boardPosition: 2 }), sale({ id: "a", boardPosition: 1 })];
    sortColumnCards(rows);
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("computeDropPosition", () => {
  const col = [
    sale({ id: "a", boardPosition: 1000 }),
    sale({ id: "b", boardPosition: 2000 }),
    sale({ id: "c", boardPosition: 3000 }),
  ];

  it("empty column starts at the STEP", () => {
    expect(computeDropPosition([], "x", 0)).toBe(1000);
  });

  it("drops between neighbors at the midpoint", () => {
    expect(computeDropPosition(col, "x", 1)).toBe(1500);
  });

  it("drops at the edges beyond the neighbors", () => {
    expect(computeDropPosition(col, "x", 0)).toBe(0); // 1000 - STEP
    expect(computeDropPosition(col, "x", 3)).toBe(4000); // 3000 + STEP
  });

  it("shifts the slot when the dragged card sat before it in the same column", () => {
    // Visual slot 2 in [a,b,c] = between b and c once "a" leaves its row.
    expect(computeDropPosition(col, "a", 2)).toBe(2500);
    // Appending its own column's card at the end: after c(3000).
    expect(computeDropPosition(col, "a", 3)).toBe(4000);
    // Moving "c" up before "b": neighbors a(1000) and b(2000).
    expect(computeDropPosition(col, "c", 1)).toBe(1500);
  });

  it("clamps out-of-range indexes to the column bounds", () => {
    expect(computeDropPosition(col, "x", 99)).toBe(4000);
  });

  it("falls back to a finite timestamp on neighbor collision", () => {
    const clash = [sale({ id: "a", boardPosition: 5 }), sale({ id: "b", boardPosition: 5 })];
    const pos = computeDropPosition(clash, "x", 1);
    expect(Number.isFinite(pos)).toBe(true);
    expect(Number.isNaN(pos)).toBe(false);
  });
});

describe("staleCount", () => {
  const cards = [
    sale({ id: "old", soldAt: "2026-07-01" }),
    sale({ id: "older", soldAt: "2026-06-15" }),
    sale({ id: "fresh", soldAt: "2026-07-16" }),
  ];

  it("counts cards older than the cutoff in non-final stages", () => {
    expect(staleCount(cards, "produzindo", TODAY)).toBe(2);
  });

  it("respects a custom day window", () => {
    expect(staleCount(cards, "produzindo", TODAY, 30)).toBe(1);
  });

  it("never flags the final stage", () => {
    expect(staleCount(cards, "entregue", TODAY)).toBe(0);
  });
});
