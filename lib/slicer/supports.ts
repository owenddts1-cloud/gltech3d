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
import { offsetRegion, subtractRegions, unionRegions, intersectRegions, regionArea } from "./perimeters";
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
  /**
   * Quantas camadas de VÃO entre o topo do suporte e a peça.
   *
   * DEFEITO QUE ISTO CORRIGE: até aqui só existia a folga horizontal. O suporte
   * era gerado na camada imediatamente abaixo do balanço, ENCOSTADO nele — e
   * suporte encostado funde na peça. Não se quebra fora: arranca material da
   * superfície junto.
   *
   * Uma camada (~0,2 mm) é o padrão dos fatiadores. Zero volta ao comportamento
   * antigo, e é a única forma de pedir suporte colado de propósito.
   */
  zClearanceLayers: number;
  /**
   * Camadas de INTERFACE no topo do suporte, com densidade alta.
   *
   * Sem elas a peça apoia em cima de linhas espaçadas de 15% e a face de baixo
   * afunda nos vãos. A interface dá superfície para apoiar; o corpo do suporte
   * continua ralo para quebrar fácil.
   */
  interfaceLayers: number;
  /** Densidade da interface, em %. Alta o suficiente para virar superfície. */
  interfaceDensityPct: number;
  /**
   * Só gerar suporte que nasce na MESA.
   *
   * Suporte apoiado em cima da própria peça é o mais difícil de remover — fica
   * dentro de vão fechado, sem acesso para alicate.
   */
  buildPlateOnly: boolean;
  /** Ignora ilha menor que isto, em mm². Evita torre de suporte inútil. */
  minAreaMm2: number;
}

export const DEFAULT_SUPPORT_OPTIONS: SupportOptions = {
  maxOverhangDeg: 45,
  layerHeight: 0.2,
  lineWidth: 0.4,
  densityPct: 15,
  xyClearance: 0.4,
  zClearanceLayers: 1,
  interfaceLayers: 2,
  interfaceDensityPct: 70,
  buildPlateOnly: false,
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
  /** Esta camada é interface (topo denso, logo abaixo do vão)? */
  isInterface: boolean;
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
  const {
    maxOverhangDeg, layerHeight, lineWidth, densityPct, xyClearance,
    zClearanceLayers, interfaceLayers, interfaceDensityPct, buildPlateOnly, minAreaMm2,
  } = options;

  const step = maxOverhangStep(layerHeight, maxOverhangDeg);
  const result: SupportLayer[] = layerRegions.map(() => ({
    region: [], lines: [], isInterface: false,
  }));

  // Primeiro passo: DESCOBRIR onde falta apoio, sem ainda decidir onde imprimir.
  // Separar as duas coisas é o que permite a folga vertical: a região desce
  // acumulando, mas só começa a virar material algumas camadas abaixo.
  const semApoio: Contour[][] = layerRegions.map(() => []);
  for (let i = layerRegions.length - 1; i >= 1; i--) {
    semApoio[i] = unsupportedRegion(layerRegions[i]!, layerRegions[i - 1]!, step);
  }
  // A camada 0 se apoia na mesa: nunca precisa. Sem esta exceção, uma coluna
  // reta gerava suporte debaixo de si mesma.

  const folga = Math.max(0, Math.round(zClearanceLayers));
  const interfaces = Math.max(0, Math.round(interfaceLayers));

  // Passo 2: DESCER acumulando a região, sem ainda gerar linha. O que a peça
  // barra no caminho é anotado à parte — é suporte que nasce em cima dela.
  const regioes: Contour[][] = layerRegions.map(() => []);
  let apoiadoNaPeca: Contour[] = [];
  let carried: Contour[] = [];

  for (let i = layerRegions.length - 1; i >= 0; i--) {
    // O suporte na camada `i` sustenta o balanço da camada `i + 1` — por isso o
    // `+1`. A folga soma em cima disso: com `folga = 1`, o balanço da camada 10
    // passa a ser sustentado a partir da camada 8, e a 9 fica VAZIA.
    //
    // Esse vão é a diferença entre quebrar o suporte fora e arrancar material da
    // superfície junto com ele. Sem ele o topo do suporte funde na peça.
    const origem = i + 1 + folga;
    const novaNecessidade = origem < semApoio.length ? semApoio[origem]! : [];
    carried = carried.length === 0 ? novaNecessidade : unionRegions(carried, novaNecessidade);
    if (carried.length === 0) continue;

    const below = i > 0 ? layerRegions[i - 1]! : [];

    // O suporte não pode ocupar onde a PEÇA está — nem encostar nela. A folga
    // horizontal é aplicada expandindo a peça antes de recortar.
    const obstacle = below.length > 0 ? offsetRegion(below, xyClearance) : [];
    if (obstacle.length > 0) {
      // O que bate na peça PARA de descer aqui: essa coluna se apoia no próprio
      // modelo, não na mesa.
      const barrado = intersectRegions(carried, obstacle);
      if (barrado.length > 0) apoiadoNaPeca = unionRegions(apoiadoNaPeca, barrado);
      carried = subtractRegions(carried, obstacle);
    }

    regioes[i] = carried;
  }

  // Passo 3: aplicar "só a partir da mesa" e gerar as linhas.
  //
  // A coluna que morreu em cima da peça é removida em TODA a sua altura, não só
  // onde bateu — suporte pendurado no ar em cima de vão fechado é pior que
  // suporte nenhum, porque não há acesso para alicate.
  for (let i = 0; i < layerRegions.length; i++) {
    let region = regioes[i]!;
    if (region.length === 0) continue;

    if (buildPlateOnly && apoiadoNaPeca.length > 0) {
      region = subtractRegions(region, apoiadoNaPeca);
    }

    // Ilha pequena não vale uma torre: solta no meio da impressão e vira lixo.
    if (regionArea(region) < minAreaMm2) continue;

    // As `interfaces` camadas logo abaixo do vão são o topo: densas, para a peça
    // apoiar em superfície e não em linhas espaçadas.
    const ehInterface = interfaces > 0 && ehTopoDeSuporte(semApoio, i, folga, interfaces);

    result[i] = {
      region,
      isInterface: ehInterface,
      lines: generateInfill(region, {
        densityPct: ehInterface ? interfaceDensityPct : densityPct,
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

/**
 * Esta camada está entre as `n` do topo de uma torre de suporte?
 *
 * Topo é onde a necessidade NASCE — a camada de onde o balanço veio. As `n`
 * camadas a partir dali para baixo são a interface.
 */
function ehTopoDeSuporte(
  semApoio: readonly (readonly Contour[])[],
  index: number,
  folga: number,
  interfaces: number,
): boolean {
  for (let k = 0; k < interfaces; k++) {
    const origem = index + 1 + folga + k;
    if (origem < semApoio.length && semApoio[origem]!.length > 0) return true;
  }
  return false;
}

/** Volume aproximado de suporte, em cm³. Ajuda a decidir se vale a pena. */
export function supportVolumeCm3(supports: readonly SupportLayer[], options: SupportOptions): number {
  const totalLength = supports.reduce(
    (sum, s) => sum + s.lines.reduce((t, l) => t + Math.hypot(l.to.x - l.from.x, l.to.y - l.from.y), 0),
    0,
  );
  return (totalLength * options.lineWidth * options.layerHeight) / 1000;
}
