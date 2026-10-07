import { describe, it, expect } from "vitest";
import {
  reserveAndDeductSpoolMass,
  evaluateInventoryRunoutRisk,
  type SpoolRecord,
} from "./inventory";

describe("InventorySentinelAgent Tool Calling Module", () => {
  const mockSpool: SpoolRecord = {
    id: "spool-1",
    material: "PLA",
    color: "Black",
    remaining_weight_g: 1000,
    reserved_weight_g: 0,
    min_stock_alert_g: 200,
  };

  it("reserves mass atomically when phase is reserve", () => {
    const result = reserveAndDeductSpoolMass(mockSpool, 150, "reserve");
    expect(result.ok).toBe(true);
    expect(result.updated_spool?.reserved_weight_g).toBe(150);
  });

  it("fails reservation if mass needed exceeds remaining weight", () => {
    const result = reserveAndDeductSpoolMass(mockSpool, 1200, "reserve");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Massa insuficiente");
  });

  it("deducts mass definitively when phase is commit_final", () => {
    const reservedSpool: SpoolRecord = {
      ...mockSpool,
      remaining_weight_g: 1000,
      reserved_weight_g: 150,
    };
    const result = reserveAndDeductSpoolMass(reservedSpool, 150, "commit_final");
    expect(result.ok).toBe(true);
    expect(result.updated_spool?.remaining_weight_g).toBe(850);
    expect(result.updated_spool?.reserved_weight_g).toBe(0);
  });

  it("evaluates runout risk when remaining weight drops below min_stock_alert_g (<50g critical)", () => {
    const lowSpool: SpoolRecord = {
      ...mockSpool,
      remaining_weight_g: 40,
    };
    const evalRes = evaluateInventoryRunoutRisk(lowSpool);
    expect(evalRes.is_critical_residual).toBe(true);
    expect(evalRes.risk_level).toBe("critical");
  });
});
