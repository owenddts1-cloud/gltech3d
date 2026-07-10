/**
 * Engine for calculating the actual production cost of a 3D printed piece.
 * Formula: C_real = (m_piece * C_gram) + ((t_print / 3600) * K_energy) + (d_machine * (t_print / 3600))
 */

export interface PricingFactors {
  m_piece: number;       // Piece mass in grams
  c_gram: number;        // Cost per gram of filament (from supplier)
  t_print: number;       // Total print time in seconds
  k_energy?: number;     // Cost of electricity per kWh (default: R$ 0.85)
  power_draw?: number;   // Average printer power draw in Watts (default: 200W = 0.2 kW)
  d_machine?: number;    // Depreciation rate of printer per hour (default: R$ 0.40)
}

export function calculateRealCost({
  m_piece,
  c_gram,
  t_print,
  k_energy = 0.85,
  power_draw = 200,
  d_machine = 0.40
}: PricingFactors): {
  materialCost: number;
  energyCost: number;
  depreciationCost: number;
  totalCost: number;
} {
  // Material cost: mass * cost per gram
  const materialCost = m_piece * c_gram;

  // Energy cost per hour: (power_draw in kW) * (k_energy in R$/kWh)
  const powerKw = power_draw / 1000;
  const energyCostPerHour = powerKw * k_energy;
  const printTimeHours = t_print / 3600;
  const energyCost = printTimeHours * energyCostPerHour;

  // Depreciation cost: rate per hour * print time in hours
  const depreciationCost = printTimeHours * d_machine;

  // Total cost
  const totalCost = materialCost + energyCost + depreciationCost;

  return {
    materialCost: parseFloat(materialCost.toFixed(4)),
    energyCost: parseFloat(energyCost.toFixed(4)),
    depreciationCost: parseFloat(depreciationCost.toFixed(4)),
    totalCost: parseFloat(totalCost.toFixed(2))
  };
}
