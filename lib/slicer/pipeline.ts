/**
 * Pipeline do fatiador: malha → plano de camadas pronto para virar G-code.
 *
 * Junta as peças que já existem — fatiamento, perímetros, preenchimento — e
 * acrescenta as camadas sólidas de topo e base, que só ficaram possíveis com o
 * booleano 2D.
 */

import { sliceMesh, type Contour, type Layer } from "./slice";
import { generatePerimeters, subtractRegions, intersectRegions, regionArea } from "./perimeters";
import { generateInfill, type InfillLine, type InfillPattern } from "./infill";
import { generateSupports, supportVolumeCm3, DEFAULT_SUPPORT_OPTIONS } from "./supports";
import { footprintOf, generateBrim, generateSkirt } from "./adhesion";
import type { SeamMode } from "./seam";
import type { LayerPlan, PerimeterPath } from "./gcode";

export interface SliceSettings {
  layerHeight: number;
  firstLayerHeight: number;
  lineWidth: number;
  wallCount: number;
  infillDensityPct: number;
  infillPattern: InfillPattern;
  /** Quantas camadas sólidas no topo e na base. */
  topBottomLayers: number;
  /** Gerar suporte para balanços. */
  supportsEnabled: boolean;
  /** Ângulo máximo (da vertical) que imprime sem apoio. 45 é o padrão seguro. */
  supportMaxOverhangDeg: number;
  /** Laços de skirt na primeira camada. 0 desliga. */
  skirtLoops: number;
  /** Folga entre a peça (ou o brim) e o skirt, em mm. */
  skirtGapMm: number;
  /** Largura do brim, em mm. 0 desliga. */
  brimWidthMm: number;
  /** Onde a volta da parede começa. */
  seamMode: SeamMode;
  /** Rampa da costura tipo cachecol, em mm. 0 desliga. */
  scarfLengthMm: number;
}

export const DEFAULT_SLICE_SETTINGS: SliceSettings = {
  layerHeight: 0.2,
  firstLayerHeight: 0.3,
  lineWidth: 0.4,
  wallCount: 2,
  infillDensityPct: 15,
  infillPattern: "grade",
  topBottomLayers: 3,
  supportsEnabled: false,
  supportMaxOverhangDeg: 45,
  skirtLoops: 1,
  skirtGapMm: 3,
  brimWidthMm: 0,
  seamMode: "canto",
  scarfLengthMm: 0,
};

export interface SlicedLayer extends LayerPlan {
  /** Região sólida (topo/base) desta camada, se houver. */
  solidRegion: Contour[];
  /** Contornos que não fecharam. Vazio numa malha sã. */
  openPaths: Contour[];
}

export interface SliceResult {
  layers: SlicedLayer[];
  /** Volume de suporte, em cm³. Zero quando desligado. */
  supportVolumeCm3: number;
  /** Somatório de contornos abertos — sintoma de buraco na malha. */
  openContourCount: number;
  /** Camadas em que nem parede coube (peça mais fina que o bico). */
  layersWithoutWalls: number;
}

/**
 * Região que precisa ser sólida nesta camada.
 *
 * A regra: uma área é topo se NÃO está coberta por material `n` camadas acima; é
 * base se não está apoiada `n` camadas abaixo. Fora isso, entra preenchimento
 * esparso.
 *
 * Comparar só com a camada imediatamente vizinha daria uma casca de uma camada
 * só — fina demais para fechar de verdade. Por isso a comparação é contra a
 * INTERSEÇÃO das `n` vizinhas: a área só é considerada apoiada se houver
 * material nas `n` camadas seguidas.
 */
function solidRegionFor(
  index: number,
  regions: readonly Contour[][],
  topBottomLayers: number,
): Contour[] {
  const own = regions[index]!;
  if (own.length === 0) return [];
  if (topBottomLayers < 1) return [];

  // Faixa de camadas acima e abaixo dentro do alcance.
  const above: Contour[][] = [];
  const below: Contour[][] = [];
  for (let k = 1; k <= topBottomLayers; k++) {
    above.push(regions[index + k] ?? []);
    below.push(regions[index - k] ?? []);
  }

  const coverage = (band: Contour[][]): Contour[] => {
    let acc: Contour[] | null = null;
    for (const region of band) {
      if (region.length === 0) return []; // faltou material em alguma: nada coberto
      acc = acc === null ? region : intersectRegions(acc, region);
      if (acc.length === 0) return [];
    }
    return acc ?? [];
  };

  const exposedTop = subtractRegions(own, coverage(above));
  const exposedBottom = subtractRegions(own, coverage(below));

  if (exposedTop.length === 0) return exposedBottom;
  if (exposedBottom.length === 0) return exposedTop;
  // União das duas exposições, feita por diferença dupla para não depender de
  // orientação cruzada entre elas.
  return [...exposedTop, ...subtractRegions(exposedBottom, exposedTop)];
}

/** Fatia a malha e monta o plano completo de cada camada. */
export function sliceToPlan(positions: Float32Array, settings: SliceSettings): SliceResult {
  const layers: Layer[] = sliceMesh(positions, {
    layerHeight: settings.layerHeight,
    firstLayerHeight: settings.firstLayerHeight,
  });

  // Passo 1: paredes de cada camada. A região de preenchimento de uma camada é
  // o que sobra dentro dela — e é sobre ESSA região que topo/base é calculado,
  // não sobre o contorno externo (senão a parede contaria como sólido).
  const perimeters = layers.map((layer) =>
    generatePerimeters(layer.contours, {
      lineWidth: settings.lineWidth,
      wallCount: settings.wallCount,
    }),
  );
  const infillRegions = perimeters.map((p) => p.infillRegion);

  // Passo 2: sólido de topo e base, comparando cada camada com as vizinhas.
  const layersOut: SlicedLayer[] = layers.map((layer, index) => {
    const { walls, infillRegion } = perimeters[index]!;
    const solidRegion = solidRegionFor(index, infillRegions, settings.topBottomLayers);
    const sparseRegion = subtractRegions(infillRegion, solidRegion);

    const angle = index % 2 === 0 ? 45 : 135;
    const infill: InfillLine[] = [
      // Sólido: densidade 100, linhas encostadas.
      ...generateInfill(solidRegion, {
        densityPct: 100,
        lineWidth: settings.lineWidth,
        pattern: "linhas",
        angleDeg: angle,
      }),
      ...generateInfill(sparseRegion, {
        densityPct: settings.infillDensityPct,
        lineWidth: settings.lineWidth,
        pattern: settings.infillPattern,
        angleDeg: angle,
      }),
    ];

    // A ordem importa: da parede mais interna para a externa, para que a
    // externa (a que se vê) seja a última e não seja empurrada pelas outras.
    // `walls[0]` é a mais externa — é ela que recebe o rótulo `externa`, e é a
    // única em que costura e cachecol valem o tempo gasto.
    const perimeterPaths: PerimeterPath[] = [];
    for (let w = walls.length - 1; w >= 0; w--) {
      const kind = w === 0 ? "externa" : "interna";
      for (const contour of walls[w]!) perimeterPaths.push({ contour, kind });
    }

    return {
      z: layer.z,
      perimeters: perimeterPaths,
      infill,
      solidRegion,
      openPaths: layer.openPaths,
    };
  });

  // Passo 3: suporte. Calculado contra o CONTORNO DO MODELO, não contra a região
  // de preenchimento — o que precisa de apoio é a superfície externa da peça, e
  // usar a região interna colocaria suporte debaixo da própria parede.
  let supportVolume = 0;
  if (settings.supportsEnabled) {
    const supportOptions = {
      ...DEFAULT_SUPPORT_OPTIONS,
      maxOverhangDeg: settings.supportMaxOverhangDeg,
      layerHeight: settings.layerHeight,
      lineWidth: settings.lineWidth,
    };
    const supports = generateSupports(layers.map((l) => l.contours), supportOptions);
    supports.forEach((support, index) => {
      if (support.lines.length > 0) layersOut[index]!.supports = support.lines;
    });
    supportVolume = supportVolumeCm3(supports, supportOptions);
  }

  // Passo 4: aderência. Só na primeira camada — é a única que toca a mesa.
  //
  // A ORDEM AQUI TEM CONSEQUÊNCIA: o brim sai primeiro porque a folga do skirt
  // é medida a partir da borda EXTERNA do brim, não da peça. Medir a partir da
  // peça faria o skirt nascer em cima do brim sempre que o brim fosse mais
  // largo que a folga.
  const first = layersOut[0];
  if (first) {
    const footprint = footprintOf(layers[0]!.contours);
    if (footprint.length > 0) {
      const brim = generateBrim(footprint, {
        widthMm: settings.brimWidthMm,
        lineWidth: settings.lineWidth,
      });
      if (brim.length > 0) first.brim = brim;

      const skirt = generateSkirt(footprint, {
        loops: settings.skirtLoops,
        gapMm: settings.skirtGapMm + Math.max(0, settings.brimWidthMm),
        lineWidth: settings.lineWidth,
      });
      if (skirt.length > 0) first.skirt = skirt;
    }
  }

  return {
    layers: layersOut,
    supportVolumeCm3: supportVolume,
    openContourCount: layers.reduce((sum, l) => sum + l.openPaths.length, 0),
    layersWithoutWalls: perimeters.filter((p, i) => p.walls.length === 0 && layers[i]!.contours.length > 0).length,
  };
}

/** Área sólida total, em mm². Diagnóstico — quanto da peça é casca. */
export function totalSolidArea(result: SliceResult): number {
  return result.layers.reduce((sum, l) => sum + regionArea(l.solidRegion), 0);
}
