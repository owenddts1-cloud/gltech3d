/**
 * InventorySentinelAgent Tool Calling Module
 *
 * Atomically reserves and deducts mass from physical spools in the mass domain (grams),
 * runs pre-flight safety margin checks (10%), monitors critical residuals (<50g) and runout alerts.
 */

export interface SpoolRecord {
  id: string;
  material: string;
  color: string;
  remaining_weight_g: number;
  reserved_weight_g: number;
  min_stock_alert_g: number;
}

export type ExecutionPhase = "reserve" | "commit_final" | "release_waste";

export function reserveAndDeductSpoolMass(
  spool: SpoolRecord,
  mass_to_deduct_g: number,
  execution_phase: ExecutionPhase
) {
  if (execution_phase === "reserve") {
    const available_g = spool.remaining_weight_g - spool.reserved_weight_g;
    if (mass_to_deduct_g > available_g) {
      return {
        ok: false as const,
        error: `Massa insuficiente no carretel ${spool.id}. Disponível: ${available_g}g, Necessário: ${mass_to_deduct_g}g`,
      };
    }
    return {
      ok: true as const,
      updated_spool: {
        ...spool,
        reserved_weight_g: Math.round((spool.reserved_weight_g + mass_to_deduct_g) * 100) / 100,
      },
    };
  }

  if (execution_phase === "commit_final") {
    const new_remaining = Math.max(0, spool.remaining_weight_g - mass_to_deduct_g);
    const new_reserved = Math.max(0, spool.reserved_weight_g - mass_to_deduct_g);

    return {
      ok: true as const,
      updated_spool: {
        ...spool,
        remaining_weight_g: Math.round(new_remaining * 100) / 100,
        reserved_weight_g: Math.round(new_reserved * 100) / 100,
      },
    };
  }

  // release_waste
  const new_reserved = Math.max(0, spool.reserved_weight_g - mass_to_deduct_g);
  return {
    ok: true as const,
    updated_spool: {
      ...spool,
      reserved_weight_g: Math.round(new_reserved * 100) / 100,
    },
  };
}

export interface PreflightCheckResult {
  passed: boolean;
  blocked: boolean;
  available_g: number;
  required_mass_g: number;
  safety_margin_pct: number;
  required_with_margin_g: number;
  deficit_g?: number;
  margin_g?: number;
  reason?: string;
}

/**
 * Pre-flight verification: Verifies if available spool weight meets required part mass
 * plus safety margin (default 10%). Blocks if safety margin is violated.
 */
export function verifyPreflightSpool(
  spool: SpoolRecord,
  required_mass_g: number,
  safety_margin_pct: number = 0.10
): PreflightCheckResult {
  const available_g = spool.remaining_weight_g - spool.reserved_weight_g;
  const required_with_margin_g = Math.round(required_mass_g * (1 + safety_margin_pct) * 100) / 100;

  if (available_g < required_with_margin_g) {
    const deficit_g = Math.round((required_with_margin_g - available_g) * 100) / 100;
    return {
      passed: false,
      blocked: true,
      available_g,
      required_mass_g,
      safety_margin_pct,
      required_with_margin_g,
      deficit_g,
      reason: `Margem de segurança de ${Math.round(safety_margin_pct * 100)}% violada. Disponível: ${available_g}g, Necessário com margem: ${required_with_margin_g}g (Déficit: ${deficit_g}g)`,
    };
  }

  const margin_g = Math.round((available_g - required_with_margin_g) * 100) / 100;
  return {
    passed: true,
    blocked: false,
    available_g,
    required_mass_g,
    safety_margin_pct,
    required_with_margin_g,
    margin_g,
  };
}

/**
 * Automatic inventory deduction at successful batch completion
 */
export function finalizeJobSpoolDeduction(
  spool: SpoolRecord,
  consumed_mass_g: number,
  reserved_mass_g: number = 0
) {
  const new_remaining = Math.max(0, spool.remaining_weight_g - consumed_mass_g);
  const release_reserved = reserved_mass_g > 0 ? reserved_mass_g : consumed_mass_g;
  const new_reserved = Math.max(0, spool.reserved_weight_g - release_reserved);

  return {
    ok: true as const,
    updated_spool: {
      ...spool,
      remaining_weight_g: Math.round(new_remaining * 100) / 100,
      reserved_weight_g: Math.round(new_reserved * 100) / 100,
    },
  };
}

export function evaluateInventoryRunoutRisk(spool: SpoolRecord) {
  const is_critical_residual = spool.remaining_weight_g < 50;
  const is_low_stock = spool.remaining_weight_g <= spool.min_stock_alert_g;

  let risk_level: "normal" | "low_stock" | "critical" = "normal";
  if (is_critical_residual) risk_level = "critical";
  else if (is_low_stock) risk_level = "low_stock";

  return {
    spool_id: spool.id,
    material: spool.material,
    color: spool.color,
    remaining_weight_g: spool.remaining_weight_g,
    is_critical_residual,
    is_low_stock,
    risk_level,
    reorder_recommended: is_low_stock,
  };
}
