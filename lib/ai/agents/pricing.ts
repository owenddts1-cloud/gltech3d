/**
 * PricingEngineAgent Tool Calling Module
 *
 * Implements deterministic mathematical formulas for 3D printing cost estimation
 * operating strictly in the mass domain (grams) and currency (BRL).
 */

export interface MaterialConsumptionParams {
  net_mass_g: number;
  support_mass_g: number;
  number_of_switches: number;
  purge_mass_per_switch_g: number;
  waste_factor: number;
  spool_cost_per_kg: number;
}

export function calculateMaterialConsumption(params: MaterialConsumptionParams) {
  const total_mass_g =
    params.net_mass_g +
    params.support_mass_g +
    params.number_of_switches * params.purge_mass_per_switch_g;

  const total_with_waste_g = total_mass_g * (1 + params.waste_factor);
  const cost_material_brl = total_with_waste_g * (params.spool_cost_per_kg / 1000);

  return {
    total_mass_g,
    total_with_waste_g,
    cost_material_brl: Math.round(cost_material_brl * 100) / 100,
  };
}

export interface MachineOperatingParams {
  machine_id: string;
  print_time_hours: number;
  average_power_watts: number;
  kwh_rate_brl: number;
  acquisition_cost_brl?: number;
  residual_value_brl?: number;
  lifespan_hours?: number;
  maint_budget_brl?: number;
  maint_interval_hours?: number;
}

export function computeMachineOperatingCost(params: MachineOperatingParams) {
  const v_acq = params.acquisition_cost_brl ?? 5000;
  const v_res = params.residual_value_brl ?? 1000;
  const h_life = params.lifespan_hours ?? 10000;
  const d_mach = h_life > 0 ? (v_acq - v_res) / h_life : 0;

  const o_maint = params.maint_budget_brl ?? 800;
  const h_maint = params.maint_interval_hours ?? 1000;
  const m_prev = h_maint > 0 ? o_maint / h_maint : 0;

  const e_cost = (params.average_power_watts / 1000) * params.kwh_rate_brl;

  const hourly_rate_brl = d_mach + m_prev + e_cost;
  const cost_machine_brl = hourly_rate_brl * params.print_time_hours;

  return {
    hourly_rate_brl: Math.round(hourly_rate_brl * 100) / 100,
    cost_machine_brl: Math.round(cost_machine_brl * 100) / 100,
  };
}

export interface BenchLaborParams {
  prep_time_min: number;
  support_removal_time_min: number;
  brass_inserts_count: number;
  time_per_insert_min: number;
  post_processing_time_min: number;
  qc_time_min: number;
  hourly_labor_rate_brl: number;
}

export function estimateBenchLaborCost(params: BenchLaborParams) {
  const total_labor_minutes =
    params.prep_time_min +
    params.support_removal_time_min +
    params.brass_inserts_count * params.time_per_insert_min +
    params.post_processing_time_min +
    params.qc_time_min;

  const cost_labor_brl = (total_labor_minutes / 60) * params.hourly_labor_rate_brl;

  return {
    total_labor_minutes,
    cost_labor_brl: Math.round(cost_labor_brl * 100) / 100,
  };
}

export interface PolymerRiskParams {
  polymer: string;
  is_tall_or_narrow?: boolean;
  has_critical_supports?: boolean;
  is_multicolor?: boolean;
  print_time_hours: number;
}

export function calculatePolymerRiskFactor(params: PolymerRiskParams): number {
  const polymer = params.polymer.toUpperCase();
  let k_mat = 0.02;
  if (polymer.includes("PETG")) k_mat = 0.04;
  else if (polymer.includes("ABS") || polymer.includes("ASA")) k_mat = 0.10;
  else if (polymer.includes("TPU") || polymer.includes("FLEX")) k_mat = 0.08;
  else if (polymer.includes("PA") || polymer.includes("CF") || polymer.includes("NYLON")) k_mat = 0.15;

  let k_geom = 0.0;
  if (params.is_tall_or_narrow) k_geom += 0.05;
  if (params.has_critical_supports) k_geom += 0.08;
  if (params.is_multicolor) k_geom += 0.10;

  const k_time = Math.min(0.15, 0.005 * params.print_time_hours);

  return Math.round((1 + k_mat + k_geom + k_time) * 10000) / 10000;
}

export interface FullPricingParams extends MaterialConsumptionParams, MachineOperatingParams, BenchLaborParams, PolymerRiskParams {
  indirect_fixed_cost_brl?: number;
  contribution_margin_pct?: number; // e.g. 0.35
  tax_rate_pct?: number; // e.g. 0.08
}

export function executePricingEngine(params: FullPricingParams) {
  const mat = calculateMaterialConsumption(params);
  const mach = computeMachineOperatingCost(params);
  const labor = estimateBenchLaborCost(params);
  const risk_factor = calculatePolymerRiskFactor(params);

  const raw_cost = mat.cost_material_brl + mach.cost_machine_brl + labor.cost_labor_brl;
  const c_fab = raw_cost * risk_factor;

  const indirect = params.indirect_fixed_cost_brl ?? 0;
  const mc = params.contribution_margin_pct ?? 0.35;
  const tax = params.tax_rate_pct ?? 0.08;

  const denominator = Math.max(0.01, 1 - (mc + tax));
  const final_price_brl = Math.round(((c_fab + indirect) / denominator) * 100) / 100;

  return {
    cost_material_brl: mat.cost_material_brl,
    cost_machine_brl: mach.cost_machine_brl,
    cost_labor_brl: labor.cost_labor_brl,
    risk_factor,
    c_fab_brl: Math.round(c_fab * 100) / 100,
    final_price_brl,
  };
}
