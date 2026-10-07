import { describe, it, expect } from "vitest";
import { HELP_DICTIONARY } from "@/lib/ui/help-dictionary";

describe("Help Dictionary Verification", () => {
  it("contains required Super Admin & Tenant PRO topics", () => {
    expect(HELP_DICTIONARY.polymer_risk_factor).toBeDefined();
    expect(HELP_DICTIONARY.machine_depreciation_hourly).toBeDefined();
    expect(HELP_DICTIONARY.platform_take_rate).toBeDefined();
    expect(HELP_DICTIONARY.spool_critical_residue).toBeDefined();
    expect(HELP_DICTIONARY.simples_nacional_tax).toBeDefined();
    expect(HELP_DICTIONARY.kwh_energy_rate).toBeDefined();
    expect(HELP_DICTIONARY.spool_cost_per_kg).toBeDefined();
    expect(HELP_DICTIONARY.labor_hourly_rate).toBeDefined();
  });

  it("each topic defines operation, impact, and recommendedValue", () => {
    Object.values(HELP_DICTIONARY).forEach((topic) => {
      expect(topic.title).toBeTruthy();
      expect(topic.operation).toBeTruthy();
      expect(topic.impact).toBeTruthy();
      expect(topic.recommendedValue).toBeTruthy();
    });
  });
});
