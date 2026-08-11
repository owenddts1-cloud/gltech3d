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

/** Um canal de venda com o que ele retém. Vem de `platform_commissions`. */
export interface ChannelCommission {
  platform: string;
  /** Percentual que o canal retém sobre o valor de venda. */
  commissionPct: number;
  /** Tarifa fixa por item, em reais. Alguns canais cobram em ticket baixo. */
  fixedFee?: number;
}

export interface ChannelPricingConfig {
  /**
   * Canais a calcular. Lista VAZIA devolve resultado vazio — de propósito.
   *
   * A versão anterior desta função conhecia dois nomes chumbados no código
   * ("Shopee" a 18%, "Mercado Livre" a 14%) e os aplicava a quem não passasse
   * configuração. Isso é pior que não calcular: produz um número que PARECE
   * apurado e não veio de lugar nenhum, e o operador toma decisão de preço em
   * cima de um chute. Além disso ignorava Facebook, TikTok, Olx e B2B, que
   * existem no cadastro.
   */
  channels: ChannelCommission[];
  /** Alíquota efetiva do Simples sobre a venda. */
  simplesTaxPct?: number;
}

export interface ChannelPricing {
  channel: string;
  /** Preço que atinge a margem alvo neste canal. */
  suggestedPrice: number;
  commission: number;
  tax: number;
  netProfit: number;
  netMarginPct: number;
  /**
   * A comissão deste canal está zerada no cadastro?
   *
   * Não é o mesmo que "não tem comissão". B2B legitimamente retém 0%; a Shopee
   * não. Sem esta marca, canal por preencher e canal sem taxa ficam
   * indistinguíveis, e o sistema afirma margem cheia em silêncio — que foi o que
   * fez a peça de R$ 11,90 parecer lucrativa.
   */
  commissionMissing: boolean;
}

/**
 * Preço por canal para atingir uma margem líquida alvo.
 *
 * A conta é a inversa da margem: partindo do custo e das retenções, acha o preço
 * em que sobra o que se quer. `divisor = 1 − comissão − imposto − margem`; se ele
 * for zero ou negativo, a margem pedida é impossível naquele canal (as retenções
 * já consomem tudo), e devolvemos o custo acrescido da margem em vez de um preço
 * infinito.
 */
export function computeChannelPrices(
  unitCost: number,
  targetMarginPct: number = 30,
  config: ChannelPricingConfig = { channels: [] },
): ChannelPricing[] {
  const taxPct = (config.simplesTaxPct ?? 0) / 100;
  const targetMargin = targetMarginPct / 100;

  return config.channels.map(({ platform, commissionPct, fixedFee = 0 }): ChannelPricing => {
    const pct = commissionPct / 100;
    const divisor = 1 - pct - taxPct - targetMargin;
    const price = divisor > 0 ? (unitCost + fixedFee) / divisor : unitCost * (1 + targetMargin);
    const commission = price * pct + fixedFee;
    const tax = price * taxPct;
    const netProfit = price - unitCost - commission - tax;

    return {
      channel: platform,
      suggestedPrice: parseFloat(price.toFixed(2)),
      commission: parseFloat(commission.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      netMarginPct: price > 0 ? parseFloat(((netProfit / price) * 100).toFixed(1)) : 0,
      commissionMissing: commissionPct === 0,
    };
  });
}

/**
 * Resultado no preço QUE JÁ SE PRATICA — a outra metade da pergunta.
 *
 * `computeChannelPrices` responde "por quanto eu deveria vender?". Esta responde
 * "o que sobra do preço que está no anúncio hoje?", que é como se descobre que
 * um item está dando prejuízo sem ninguém ter mudado nada.
 */
export function channelResultAtPrice(
  unitCost: number,
  sellingPrice: number,
  channel: ChannelCommission,
  simplesTaxPct = 0,
): ChannelPricing {
  const pct = channel.commissionPct / 100;
  const fixedFee = channel.fixedFee ?? 0;
  const commission = sellingPrice * pct + fixedFee;
  const tax = sellingPrice * (simplesTaxPct / 100);
  const netProfit = sellingPrice - unitCost - commission - tax;

  return {
    channel: channel.platform,
    suggestedPrice: parseFloat(sellingPrice.toFixed(2)),
    commission: parseFloat(commission.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    netProfit: parseFloat(netProfit.toFixed(2)),
    netMarginPct: sellingPrice > 0 ? parseFloat(((netProfit / sellingPrice) * 100).toFixed(1)) : 0,
    commissionMissing: channel.commissionPct === 0,
  };
}


/**
 * Mesma conta de `calculateRealCost`, nas unidades que as TELAS usam.
 *
 * POR QUE ESTA PORTA EXISTE. O motor pensa em gramas, segundos e R$/grama; as
 * telas pensam em gramas, HORAS e R$/quilo. Enquanto essa tradução ficou a cargo
 * de cada tela, cada uma refez a conta inteira — e o sistema passou a ter três
 * respostas para a mesma pergunta:
 *
 *   hooks/calculator/useCalculator.ts    insumo padrão R$ 110/kg
 *   app/app/projects (simulador ao vivo) insumo padrão R$ 140/kg, depreciação fixa
 *   lib/pricing/engine.ts                depreciação padrão R$ 0,40/h
 *
 * A mesma peça custava diferente conforme a tela aberta. Com a conversão AQUI,
 * a tradução acontece uma vez e as telas só informam o que sabem.
 *
 * Continua devolvendo as três parcelas separadas: a tela de calculadora mostra a
 * "anatomia do custo" em barras, e somar tudo aqui destruiria essa informação.
 */
export interface HourlyCostInput {
  /** Massa da peça, em gramas. */
  grams: number;
  /** Preço do filamento por QUILO — é como o fornecedor vende. */
  filamentCostPerKg: number;
  /** Tempo de impressão, em HORAS. */
  printHours: number;
  /** Potência média da impressora, em watts. */
  wattage: number;
  /** Tarifa de energia, em R$/kWh. */
  kwhPrice: number;
  /** Depreciação da máquina por hora. Quem tem valor e vida útil divide antes. */
  depreciationPerHour: number;
}

export function costFromHourlyInputs(input: HourlyCostInput): {
  materialCost: number;
  energyCost: number;
  depreciationCost: number;
  totalCost: number;
} {
  return calculateRealCost({
    m_piece: input.grams,
    c_gram: input.filamentCostPerKg / 1000,
    t_print: input.printHours * 3600,
    k_energy: input.kwhPrice,
    power_draw: input.wattage,
    d_machine: input.depreciationPerHour,
  });
}

/**
 * Depreciação por hora a partir do valor da máquina e da vida útil.
 *
 * Vida útil zero devolve zero em vez de infinito: máquina sem vida útil
 * cadastrada não deve contaminar o custo com `Infinity`, que se propaga em
 * silêncio por toda a soma e só aparece como "R$ NaN" na tela.
 */
export function depreciationPerHour(machineValue: number, usefulLifeHours: number): number {
  if (!(usefulLifeHours > 0) || !Number.isFinite(machineValue)) return 0;
  return machineValue / usefulLifeHours;
}
