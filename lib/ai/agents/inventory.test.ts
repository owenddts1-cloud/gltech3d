import { describe, it, expect } from "vitest";
import {
  reserveAndDeductSpoolMass,
  evaluateInventoryRunoutRisk,
  verifyPreflightSpool,
  finalizeJobSpoolDeduction,
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

  describe("Pre-flight safety margin check (10%)", () => {
    it("passes pre-flight check when spool has enough mass including 10% safety margin", () => {
      // 250g part requires 250 * 1.10 = 275g. Spool has 300g available.
      const spool: SpoolRecord = {
        ...mockSpool,
        remaining_weight_g: 300,
        reserved_weight_g: 0,
      };

      const check = verifyPreflightSpool(spool, 250, 0.10);
      expect(check.passed).toBe(true);
      expect(check.blocked).toBe(false);
      expect(check.required_with_margin_g).toBe(275);
    });

    it("blocks pre-flight check when spool does not have enough mass for part + 10% safety margin", () => {
      // 250g part requires 275g. Spool only has 260g available.
      const spool: SpoolRecord = {
        ...mockSpool,
        remaining_weight_g: 260,
        reserved_weight_g: 0,
      };

      const check = verifyPreflightSpool(spool, 250, 0.10);
      expect(check.passed).toBe(false);
      expect(check.blocked).toBe(true);
      expect(check.reason).toContain("Margem de segurança de 10% violada");
      expect(check.deficit_g).toBe(15);
    });
  });

  describe("Automatic post-job inventory finalization", () => {
    it("finalizes job and deducts real consumed mass cleanly", () => {
      const spool: SpoolRecord = {
        ...mockSpool,
        remaining_weight_g: 500,
        reserved_weight_g: 250,
      };

      // Real consumption was 245g
      const finalResult = finalizeJobSpoolDeduction(spool, 245, 250);
      expect(finalResult.ok).toBe(true);
      expect(finalResult.updated_spool.remaining_weight_g).toBe(255); // 500 - 245
      expect(finalResult.updated_spool.reserved_weight_g).toBe(0); // released reservation
    });
  });
});
