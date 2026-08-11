/**
 * Pipeline do fatiador: malha → plano de camadas pronto para virar G-code.
 *
 * Junta as peças que já existem — fatiamento, perímetros, preenchimento — e
 * acrescenta as camadas sólidas de topo e base, que só ficaram possíveis com o
 * booleano 2D.
 */

import { sliceMesh, type Contour, type Layer } from "./slice";
import {
  generatePerimeters,
  subtractRegions,
  intersectRegions,
  regionArea,
  offsetRegion,
} from "./perimeters";
import { generateInfill, type InfillLine, type InfillPattern } from "./infill";
import { generateSupports, supportVolumeCm3, DEFAULT_SUPPORT_OPTIONS } from "./supports";
import { footprintOf, generateBrim, generateSkirt } from "./adhesion";
import { layerSchedule, DEFAULT_ADAPTIVE_OPTIONS } from "./adaptive";
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

  /** Altura de camada variável conforme a inclinação da superfície. */
  adaptiveLayers: boolean;
  /** Degrau máximo tolerado, em mm. Só vale com `adaptiveLayers`. */
  adaptiveCuspMm: number;
  /** Piso e teto da máquina para a altura variável. */
  minLayerHeight: number;
  maxLayerHeight: number;

  /** Camadas de raft embaixo da peça. 0 desliga. */
  raftLayers: number;
  /** Quanto o raft avança para fora da silhueta, em mm. */
  raftMarginMm: number;

  /** Imprimir devagar e com ventoinha máxima sobre vazio. */
  bridgesEnabled: boolean;
  /** Passada de alisamento sobre as superfícies de topo. */
  ironingEnabled: boolean;
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
  adaptiveLayers: false,
  adaptiveCuspMm: 0.05,
  minLayerHeight: 0.08,
  maxLayerHeight: 0.28,
  raftLayers: 0,
  raftMarginMm: 3,
  bridgesEnabled: true,
  ironingEnabled: false,
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
  /** Quantas camadas têm trecho sobre vazio. Diagnóstico. */
  bridgeLayerCount: number;
  /** Quantas camadas de raft foram acrescentadas na frente. */
  raftLayerCount: number;
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
  // Altura variável ANTES de fatiar: o cronograma define onde cada plano cai.
  const thicknesses = settings.adaptiveLayers
    ? layerSchedule(positions, {
        ...DEFAULT_ADAPTIVE_OPTIONS,
        minLayerHeight: settings.minLayerHeight,
        maxLayerHeight: settings.maxLayerHeight,
        cuspMm: settings.adaptiveCuspMm,
        firstLayerHeight: settings.firstLayerHeight,
      })
    : undefined;

  const layers: Layer[] = sliceMesh(positions, {
    layerHeight: settings.layerHeight,
    firstLayerHeight: settings.firstLayerHeight,
    thicknesses,
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
      thickness: layer.thickness,
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

  // Passo 4: pontes. Trecho SÓLIDO sem material embaixo. Sai devagar e com a
  // ventoinha no máximo; a área sai do preenchimento normal para não ser
  // depositada duas vezes.
  //
  // LIMITAÇÃO MEDIDA E DECLARADA: o critério é "sólido sem apoio embaixo", o
  // que pega ponte de verdade (vão entre duas colunas) E o anel de balanço de
  // uma superfície que abre para cima. No PAYLOAD, 198 das 324 camadas caem
  // aqui — quase todas são o anel do cone, não vão.
  //
  // Distinguir os dois exigiria provar que a região está ANCORADA em lados
  // opostos, o que é bem mais geometria do que isto. Não corrigi porque o
  // tratamento é o mesmo nos dois casos: devagar e com resfriamento máximo é o
  // que balanço também precisa. O que está errado é o RÓTULO, não a impressão.
  let bridgeLayers = 0;
  if (settings.bridgesEnabled) {
    for (let index = 1; index < layersOut.length; index++) {
      const own = layersOut[index]!;
      if (own.solidRegion.length === 0) continue;

      const below = infillRegions[index - 1] ?? [];
      const overVoid = subtractRegions(own.solidRegion, below);
      if (overVoid.length === 0 || regionArea(overVoid) < settings.lineWidth * 2) continue;

      // Ângulo fixo por camada. O ideal seria alinhar as linhas com o VÃO MAIS
      // CURTO de cada ponte, que é o que dá mais resistência — não implementado,
      // e a diferença aparece em vão largo e comprido. Fica declarado.
      const bridges = generateInfill(overVoid, {
        densityPct: 100,
        lineWidth: settings.lineWidth,
        pattern: "linhas",
        angleDeg: 0,
      });
      if (bridges.length === 0) continue;

      own.bridges = bridges;
      // Tira a área da ponte do preenchimento sólido normal desta camada.
      const rest = subtractRegions(own.solidRegion, overVoid);
      own.infill = [
        ...generateInfill(rest, {
          densityPct: 100,
          lineWidth: settings.lineWidth,
          pattern: "linhas",
          angleDeg: index % 2 === 0 ? 45 : 135,
        }),
        ...own.infill.filter((line) => !bridges.includes(line)),
      ];
      bridgeLayers++;
    }
  }

  // Passo 5: alisamento. Passada extra sobre a superfície de TOPO — a que fica
  // exposta — com quase nada de vazão, só para derreter os vales entre filetes.
  // Só onde há topo de verdade: a região sólida que NÃO está coberta acima.
  if (settings.ironingEnabled) {
    for (let index = 0; index < layersOut.length; index++) {
      const own = layersOut[index]!;
      if (own.solidRegion.length === 0) continue;
      const above = infillRegions[index + 1] ?? [];
      const topSurface = subtractRegions(own.solidRegion, above);
      if (topSurface.length === 0) continue;

      // Espaçamento menor que a largura do filete: o bico tem de PASSAR por
      // cima do vale, não ao lado dele. Por isso a densidade acima de 100.
      const lines = generateInfill(topSurface, {
        densityPct: 250,
        lineWidth: settings.lineWidth,
        pattern: "linhas",
        angleDeg: 90,
      });
      if (lines.length > 0) own.ironing = lines;
    }
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

  // Passo 7: raft. Camadas sacrificiais embaixo da peça, para quem tem mesa
  // empenada ou peça de contato pequeno. Empurra TUDO para cima — o z das
  // camadas da peça muda, e é por isso que o raft entra por último, depois de
  // aderência e suporte já terem sido calculados na geometria original.
  let raftCount = 0;
  if (settings.raftLayers > 0 && layers.length > 0) {
    const footprint = footprintOf(layers[0]!.contours);
    const raftRegion = footprint.length > 0
      ? offsetRegion(footprint, Math.max(0, settings.raftMarginMm))
      : [];

    if (raftRegion.length > 0) {
      const raftThickness = Math.max(settings.firstLayerHeight, settings.layerHeight);
      const raftHeight = raftThickness * settings.raftLayers;

      // A peça sobe. Skirt e brim sobem junto porque vivem dentro da camada.
      for (const layer of layersOut) layer.z += raftHeight;

      const raft: SlicedLayer[] = [];
      for (let i = 0; i < settings.raftLayers; i++) {
        // A primeira camada do raft é esparsa (descola fácil da mesa) e a de
        // cima é densa e cruzada, para a peça ter onde assentar.
        const ultima = i === settings.raftLayers - 1;
        raft.push({
          z: raftThickness * (i + 1),
          thickness: raftThickness,
          isRaft: true,
          perimeters: raftRegion.map((contour) => ({ contour, kind: "externa" as const })),
          infill: generateInfill(raftRegion, {
            densityPct: ultima ? 100 : 45,
            lineWidth: settings.lineWidth,
            pattern: "linhas",
            angleDeg: i % 2 === 0 ? 0 : 90,
          }),
          solidRegion: [],
          openPaths: [],
        });
      }

      // Skirt e brim passam para a primeira camada do RAFT: é ela que toca a
      // mesa agora. Deixá-los na peça faria o skirt sair no ar.
      const first = layersOut[0];
      if (first && raft[0]) {
        if (first.skirt) { raft[0].skirt = first.skirt; delete first.skirt; }
        if (first.brim) { raft[0].brim = first.brim; delete first.brim; }
      }

      layersOut.unshift(...raft);
      raftCount = raft.length;
    }
  }

  return {
    layers: layersOut,
    supportVolumeCm3: supportVolume,
    bridgeLayerCount: bridgeLayers,
    raftLayerCount: raftCount,
    openContourCount: layers.reduce((sum, l) => sum + l.openPaths.length, 0),
    layersWithoutWalls: perimeters.filter((p, i) => p.walls.length === 0 && layers[i]!.contours.length > 0).length,
  };
}

/** Área sólida total, em mm². Diagnóstico — quanto da peça é casca. */
export function totalSolidArea(result: SliceResult): number {
  return result.layers.reduce((sum, l) => sum + regionArea(l.solidRegion), 0);
}
