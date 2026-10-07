import { describe, it, expect } from "vitest";
import {
  calculateMaterialConsumption,
  computeMachineOperatingCost,
  estimateBenchLaborCost,
  calculatePolymerRiskFactor,
  executePricingEngine,
} from "./pricing";

describe("PricingEngineAgent Tool Calling Module", () => {
  it("calculates material consumption accurately in mass domain (grams)", () => {
    const res = calculateMaterialConsumption({
      net_mass_g: 100,
      support_mass_g: 20,
      number_of_switches: 4,
      purge_mass_per_switch_g: 5,
      waste_factor: 0.05,
      spool_cost_per_kg: 100.0,
    });

    // M_total = 100 + 20 + (4 * 5) = 140g
    // M_with_waste = 140 * 1.05 = 147g
    // C_mat = 147 * (100 / 1000) = 14.70
    expect(res.total_mass_g).toBe(140);
    expect(res.cost_material_brl).toBeCloseTo(14.7, 2);
  });

  it("computes machine operating cost considering thermal equilibrium power and depreciation", () => {
    const res = computeMachineOperatingCost({
      machine_id: "m-123",
      print_time_hours: 10,
      average_power_watts: 200,
      kwh_rate_brl: 1.0,
      acquisition_cost_brl: 5000,
      residual_value_brl: 1000,
      lifespan_hours: 10000,
      maint_budget_brl: 500,
      maint_interval_hours: 1000,
    });

    // D_mach = (5000 - 1000)/10000 = 0.40 R$/h
    // M_prev = 500 / 1000 = 0.50 R$/h
    // E_cost = (200 / 1000) * 1.00 = 0.20 R$/h
    // Hourly rate = 0.40 + 0.50 + 0.20 = 1.10 R$/h
    // Total for 10h = 11.00 R$
    expect(res.hourly_rate_brl).toBeCloseTo(1.1, 2);
    expect(res.cost_machine_brl).toBeCloseTo(11.0, 2);
  });

  it("estimates bench labor cost accurately", () => {
    const res = estimateBenchLaborCost({
      prep_time_min: 10,
      support_removal_time_min: 15,
      brass_inserts_count: 5,
      time_per_insert_min: 2, // 10 min
      post_processing_time_min: 15,
      qc_time_min: 10,
      hourly_labor_rate_brl: 60.0,
    });

    // Total min = 10 + 15 + 10 + 15 + 10 = 60 min = 1.0 hour
    // Cost = 60.00 R$
    expect(res.total_labor_minutes).toBe(60);
    expect(res.cost_labor_brl).toBeCloseTo(60.0, 2);
  });

  it("calculates polymer risk factor correctly", () => {
    const riskPla = calculatePolymerRiskFactor({ polymer: "PLA", is_tall_or_narrow: false, print_time_hours: 2 });
    expect(riskPla).toBeGreaterThanOrEqual(1.0);

    const riskPaCf = calculatePolymerRiskFactor({ polymer: "PA-CF", is_tall_or_narrow: true, print_time_hours: 20 });
    // PA-CF: 0.15, Tall: 0.05, Time: min(0.15, 0.005*20 = 0.10) => 1 + 0.30 = 1.30
    expect(riskPaCf).toBeCloseTo(1.3, 2);
  });

  it("executes full pricing engine and returns exact final price", () => {
    const result = executePricingEngine({
      net_mass_g: 100,
      support_mass_g: 0,
      number_of_switches: 0,
      purge_mass_per_switch_g: 0,
      waste_factor: 0.0,
      spool_cost_per_kg: 100, // C_mat = 10.00
      print_time_hours: 5,
      average_power_watts: 200,
      kwh_rate_brl: 1.0,
      acquisition_cost_brl: 5000,
      residual_value_brl: 1000,
      lifespan_hours: 10000,
      maint_budget_brl: 500,
      maint_interval_hours: 1000, // C_op = 5.50
      prep_time_min: 15,
      support_removal_time_min: 0,
      brass_inserts_count: 0,
      time_per_insert_min: 0,
      post_processing_time_min: 0,
      qc_time_min: 15,
      hourly_labor_rate_brl: 30, // 0.5h * 30 = 15.00
      polymer: "PLA",
      indirect_fixed_cost_brl: 0,
      contribution_margin_pct: 0.30, // 30%
      tax_rate_pct: 0.10, // 10%
    });

    // C_fab_raw = 10 + 5.50 + 15 = 30.50
    // F_risk = 1 + 0.02 + 0.025 = 1.045
    // C_fab = 30.50 * 1.045 = 31.8725
    // PV = 31.8725 / (1 - 0.40) = 53.12
    expect(result.final_price_brl).toBeGreaterThan(50);
  });
});
