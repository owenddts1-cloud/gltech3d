/**
 * Suportes: material temporário sob o que não tem apoio.
 *
 * A REGRA FÍSICA: cada camada é depositada sobre a anterior. Se ela avança
 * lateralmente mais do que consegue "pendurar", o filete cai no vazio. Quanto
 * pode avançar por camada depende do ângulo em relação à vertical:
 *
 *     avanço_máximo = altura_da_camada × tan(ângulo)
 *
 * A 45° o avanço é igual à altura da camada — é por isso que 45° é o limite que
 * quase todo perfil usa. Acima disso, precisa de suporte.
 *
 * Escrito do zero. Os booleanos vêm de `perimeters.ts` (clipper-lib, BSL).
 */

import type { Contour } from "./slice";
import { offsetRegion, subtractRegions, unionRegions, regionArea } from "./perimeters";
import { generateInfill, type InfillLine } from "./infill";

export interface SupportOptions {
  /**
   * Ângulo máximo em relação à VERTICAL que imprime sem apoio, em graus.
   * 45 é o padrão seguro em FDM; 60 arrisca mais e usa menos material.
   */
  maxOverhangDeg: number;
  layerHeight: number;
  lineWidth: number;
  /** Densidade do suporte. Baixa de propósito: ele é quebrado fora depois. */
  densityPct: number;
  /**
   * Folga horizontal entre o suporte e a peça, em mm. Sem ela o suporte funde
   * na peça e não solta.
   */
  xyClearance: number;
  /** Ignora ilha menor que isto, em mm². Evita torre de suporte inútil. */
  minAreaMm2: number;
}

export const DEFAULT_SUPPORT_OPTIONS: SupportOptions = {
  maxOverhangDeg: 45,
  layerHeight: 0.2,
  lineWidth: 0.4,
  densityPct: 15,
  xyClearance: 0.4,
  minAreaMm2: 2,
};

/** Quanto uma camada pode avançar sobre o vazio sem cair, em mm. */
export function maxOverhangStep(layerHeight: number, maxOverhangDeg: number): number {
  const clamped = Math.min(Math.max(maxOverhangDeg, 0), 89);
  return layerHeight * Math.tan((clamped * Math.PI) / 180);
}

/**
 * Região de UMA camada que não tem apoio suficiente na de baixo.
 *
 * A camada de baixo é expandida pelo avanço máximo: o que ficar fora dessa
 * expansão está pendurado além do que o material aguenta.
 */
export function unsupportedRegion(
  layer: readonly Contour[],
  below: readonly Contour[],
  step: number,
): Contour[] {
  if (layer.length === 0) return [];
  if (below.length === 0) return [...layer]; // primeira camada da ilha: nada embaixo
  return subtractRegions(layer, offsetRegion(below, step));
}

export interface SupportLayer {
  /** Região a preencher com suporte nesta camada. */
  region: Contour[];
  lines: InfillLine[];
}

/**
 * Calcula o suporte de todas as camadas.
 *
 * Percorre de CIMA para BAIXO acumulando: o que precisa de apoio numa camada
 * continua precisando em todas as de baixo, até chegar na mesa. A cada passo o
 * acumulado é recortado contra a própria peça — suporte dentro do material seria
 * material duplicado.
 */
export function generateSupports(
  layerRegions: readonly (readonly Contour[])[],
  options: SupportOptions,
): SupportLayer[] {
  const { maxOverhangDeg, layerHeight, lineWidth, densityPct, xyClearance, minAreaMm2 } = options;
  const step = maxOverhangStep(layerHeight, maxOverhangDeg);
  const result: SupportLayer[] = layerRegions.map(() => ({ region: [], lines: [] }));

  let carried: Contour[] = [];

  for (let i = layerRegions.length - 1; i >= 0; i--) {
    const own = layerRegions[i]!;
    const below = i > 0 ? layerRegions[i - 1]! : [];

    // A PRIMEIRA camada se apoia na mesa: nunca precisa de suporte. Sem esta
    // exceção, `below` vazio fazia toda a base ser considerada em balanço, e
    // uma coluna reta gerava suporte debaixo de si mesma.
    const needed = i === 0 ? [] : unsupportedRegion(own, below, step);
    carried = carried.length === 0 ? needed : unionRegions(carried, needed);
    if (carried.length === 0) continue;

    // Na camada de baixo, o suporte não pode ocupar onde a PEÇA está — nem
    // encostar nela. A folga é aplicada expandindo a peça antes de recortar.
    const obstacle = below.length > 0 ? offsetRegion(below, xyClearance) : [];
    const placeable = obstacle.length > 0 ? subtractRegions(carried, obstacle) : carried;

    // Ilha pequena não vale uma torre: solta no meio da impressão e vira lixo.
    const region = regionArea(placeable) >= minAreaMm2 ? placeable : [];
    carried = placeable;

    if (region.length === 0) continue;
    result[i] = {
      region,
      lines: generateInfill(region, {
        densityPct,
        lineWidth,
        pattern: "linhas",
        // Alterna o sentido por camada para a torre não virar uma parede sólida
        // numa direção só, que é difícil de quebrar fora.
        angleDeg: i % 2 === 0 ? 0 : 90,
      }),
    };
  }

  return result;
}

/** Volume aproximado de suporte, em cm³. Ajuda a decidir se vale a pena. */
export function supportVolumeCm3(supports: readonly SupportLayer[], options: SupportOptions): number {
  const totalLength = supports.reduce(
    (sum, s) => sum + s.lines.reduce((t, l) => t + Math.hypot(l.to.x - l.from.x, l.to.y - l.from.y), 0),
    0,
  );
  return (totalLength * options.lineWidth * options.layerHeight) / 1000;
}
