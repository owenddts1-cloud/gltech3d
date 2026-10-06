import { describe, expect, it } from "vitest";
import { energyTariffSchema } from "./printers";

describe("energyTariffSchema", () => {
  it("accepts the 0.01..10 R$/kWh range (inclusive) and coerces strings", () => {
    expect(energyTariffSchema.parse(0.01)).toBe(0.01);
    expect(energyTariffSchema.parse(10)).toBe(10);
    expect(energyTariffSchema.parse("0.85")).toBe(0.85);
  });

  it("rejects zero, negatives, values above 10 and non-numbers", () => {
    for (const v of [0, -1, 10.01, 100, "abc", Number.NaN]) {
      expect(energyTariffSchema.safeParse(v).success).toBe(false);
    }
  });
});
