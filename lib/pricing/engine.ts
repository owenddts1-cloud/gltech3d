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

export interface ProductPricingInput {
  filamentGrams: number;
  costPerGram: number;       // R$/g do filamento
  printTimeSeconds: number;
  kEnergy?: number;
  powerDraw?: number;        // W
  depreciationPerHour?: number; // R$/h
  extraCostCents: number;    // insumos extras somados (embalagem, parafusos, tags…)
  marginPct: number;         // margem de lucro desejada (%)
}

export interface ProductPricingResult {
  materialCost: number;
  energyCost: number;
  depreciationCost: number;
  extrasCost: number;
  totalCost: number;         // custo unitário real
  suggestedPrice: number;    // preço sugerido com a margem
  profit: number;            // lucro unitário
}

/**
 * Custo real + preço sugerido de um produto (BOM). Reaproveita
 * {@link calculateRealCost} para material/energia/depreciação e soma os insumos
 * extras; aplica a margem para chegar ao preço sugerido.
 */
export function computeProductPricing(input: ProductPricingInput): ProductPricingResult {
  const base = calculateRealCost({
    m_piece: input.filamentGrams,
    c_gram: input.costPerGram,
    t_print: input.printTimeSeconds,
    k_energy: input.kEnergy,
    power_draw: input.powerDraw,
    d_machine: input.depreciationPerHour,
  });
  const extrasCost = Math.max(0, input.extraCostCents) / 100;
  const totalCost = parseFloat((base.totalCost + extrasCost).toFixed(2));
  const suggestedPrice = parseFloat((totalCost * (1 + input.marginPct / 100)).toFixed(2));
  const profit = parseFloat((suggestedPrice - totalCost).toFixed(2));

  return {
    materialCost: base.materialCost,
    energyCost: base.energyCost,
    depreciationCost: base.depreciationCost,
    extrasCost,
    totalCost,
    suggestedPrice,
    profit,
  };
}
