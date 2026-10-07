import { describe, it, expect } from "vitest";

export function calculateAssetDepreciation(purchaseValueCents: number, currentValueCents: number) {
  if (purchaseValueCents <= 0) return { depreciatedCents: 0, percentage: 0 };
  const depreciatedCents = Math.max(0, purchaseValueCents - currentValueCents);
  const percentage = Math.min(100, Math.round((depreciatedCents / purchaseValueCents) * 100));
  return { depreciatedCents, percentage };
}

describe("Asset Depreciation Calculation Logic", () => {
  it("calculates asset depreciation and percentage accurately", () => {
    const res = calculateAssetDepreciation(100000, 75000); // 1000.00 bought, 750.00 current
    expect(res.depreciatedCents).toBe(25000);
    expect(res.percentage).toBe(25);
  });

  it("handles zero or edge values safely", () => {
    const resZero = calculateAssetDepreciation(0, 0);
    expect(resZero.depreciatedCents).toBe(0);
    expect(resZero.percentage).toBe(0);

    const resOver = calculateAssetDepreciation(50000, 0);
    expect(resOver.depreciatedCents).toBe(50000);
    expect(resOver.percentage).toBe(100);
  });
});
