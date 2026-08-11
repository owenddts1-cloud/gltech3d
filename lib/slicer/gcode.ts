/**
 * Emissão de G-code e estimativas.
 *
 * O número que mais importa aqui é o `E`: quanto filamento empurrar por
 * milímetro de percurso. Errar isso não dá erro nenhum no software — dá peça
 * com pouco material (frágil, com falha entre linhas) ou material demais
 * (empenada, com bolha). A fórmula está isolada e testada.
 *
 * Escrito do zero. Nada vem de CuraEngine, PrusaSlicer ou Slic3r (AGPL).
 */

import type { Contour, Point2 } from "./slice";
import type { InfillLine } from "./infill";
import { rotateToStart, scarfPath, seamStartIndex, type SeamMode } from "./seam";
import { travelCrossesWall } from "./combing";

export interface PrinterProfile {
  name: string;
  nozzleDiameter: number;
  filamentDiameter: number;
  bedTempC: number;
  nozzleTempC: number;
  /** mm/s */
  printSpeed: number;
  travelSpeed: number;
  firstLayerSpeed: number;

  // ── Retração ─────────────────────────────────────────────────────────────
  /** Quanto filamento recolher antes de um salto em vazio, em mm. 0 desliga. */
  retractionMm: number;
  /** mm/s do recolhimento e do reprime. */
  retractionSpeedMmS: number;
  /** Salto menor que isto não retrai: gasta tempo e mói o filamento à toa. */
  retractionMinTravelMm: number;

  // ── Resfriamento ─────────────────────────────────────────────────────────
  /** Velocidade cheia da ventoinha, em %. */
  fanSpeedPct: number;
  /** Quantas camadas iniciais ficam com a ventoinha desligada. */
  fanOffLayers: number;
  /** Camada em que a ventoinha atinge a velocidade cheia (rampa linear). */
  fanFullAtLayer: number;

  // ── Limites da máquina ───────────────────────────────────────────────────
  /** Só para avisar na tela. Não bloqueia nada aqui. */
  minLayerHeight: number;
  maxLayerHeight: number;
}

export interface PrintSettings {
  layerHeight: number;
  firstLayerHeight: number;
  lineWidth: number;
  /** g/cm³. PLA ≈ 1,24. */
  filamentDensity: number;
  /** Onde a volta da parede começa. */
  seamMode?: SeamMode;
  /** Comprimento da rampa do cachecol, em mm. 0 desliga. */
  scarfLengthMm?: number;
}

/**
 * Padrão calibrado para a Anycubic Kobra X do Guilherme.
 *
 * Retração e velocidade vieram DELE, medidas na máquina — não de um chute por
 * tipo de extrusora. Altura de camada entre 0,08 e 0,28 é o limite que ele
 * informou; aparece como aviso na tela, não como trava.
 */
export const DEFAULT_PROFILE: PrinterProfile = {
  name: "FDM 0.4",
  nozzleDiameter: 0.4,
  filamentDiameter: 1.75,
  bedTempC: 60,
  nozzleTempC: 210,
  printSpeed: 50,
  travelSpeed: 120,
  firstLayerSpeed: 20,
  retractionMm: 2,
  retractionSpeedMmS: 30,
  retractionMinTravelMm: 1.5,
  fanSpeedPct: 100,
  fanOffLayers: 1,
  fanFullAtLayer: 3,
  minLayerHeight: 0.08,
  maxLayerHeight: 0.28,
};

/**
 * Filamento consumido (mm de fio) para extrudar um percurso.
 *
 * Volume depositado = comprimento × largura × altura.
 * Volume de fio      = comprimento_fio × π × (d/2)².
 * Igualando os dois, sai o `E`.
 */
export function extrusionFor(
  distanceMm: number,
  lineWidth: number,
  layerHeight: number,
  filamentDiameter: number,
): number {
  if (distanceMm <= 0) return 0;
  const filamentArea = Math.PI * (filamentDiameter / 2) ** 2;
  if (filamentArea <= 0) return 0;
  return (distanceMm * lineWidth * layerHeight) / filamentArea;
}

/** mm de fio → gramas. */
export function filamentGrams(
  lengthMm: number,
  filamentDiameter: number,
  densityGCm3: number,
): number {
  const areaMm2 = Math.PI * (filamentDiameter / 2) ** 2;
  const volumeCm3 = (lengthMm * areaMm2) / 1000; // mm³ → cm³
  return volumeCm3 * densityGCm3;
}

/**
 * Velocidade da ventoinha (0-255) numa camada.
 *
 * Desligada nas primeiras camadas: ar frio na base faz a peça encolher e
 * descolar da mesa. Depois sobe em rampa até a velocidade cheia — ligar de uma
 * vez cria uma linha de tensão visível onde a temperatura salta.
 */
export function fanValueFor(layerIndex: number, profile: PrinterProfile): number {
  const { fanSpeedPct, fanOffLayers, fanFullAtLayer } = profile;
  if (layerIndex < fanOffLayers) return 0;
  const full = Math.max(fanFullAtLayer, fanOffLayers);
  const span = full - fanOffLayers + 1;
  const ratio = span > 0 ? Math.min(1, (layerIndex - fanOffLayers + 1) / span) : 1;
  const pct = Math.max(0, Math.min(100, fanSpeedPct));
  return Math.round((pct / 100) * 255 * ratio);
}

const dist = (a: Point2, b: Point2): number => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * Ordena percursos por vizinho mais próximo, para reduzir deslocamento em vazio.
 *
 * Não é o ótimo (o problema é NP-difícil), mas corta a maior parte do
 * deslocamento inútil com custo O(n²) — suficiente para o número de percursos
 * de uma camada.
 */
export function orderByProximity<T extends { from: Point2; to: Point2 }>(
  paths: T[],
  start: Point2 = { x: 0, y: 0 },
): T[] {
  const remaining = [...paths];
  const ordered: T[] = [];
  let cursor = start;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = dist(cursor, remaining[i]!.from);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next!);
    cursor = next!.to;
  }

  return ordered;
}

/**
 * Uma volta de parede, com a informação de qual delas é.
 *
 * A distinção não é decorativa: só a EXTERNA é visível, e é nela que faz sentido
 * gastar tempo com cachecol. Antes disto o emissor rotulava toda parede como
 * `;TYPE:WALL-OUTER`, o que fazia qualquer visualizador de G-code desenhar a
 * peça errada.
 */
export type PerimeterPath = Contour | {
  contour: Contour;
  kind?: "externa" | "interna";
};

export interface LayerPlan {
  z: number;
  perimeters: PerimeterPath[];
  infill: InfillLine[];
  /** Percursos de suporte desta camada. Ausente = sem suporte. */
  supports?: InfillLine[];
  /** Laços de skirt. Só na primeira camada. */
  skirt?: Contour[];
  /** Laços de brim, do mais externo para o mais interno. Só na primeira camada. */
  brim?: Contour[];
}

export interface GcodeResult {
  gcode: string;
  /** mm de filamento DEPOSITADO. Retração não conta — ela volta. */
  filamentMm: number;
  filamentGrams: number;
  /** Segundos. Estimativa por velocidade constante — ver o comentário. */
  estimatedSeconds: number;
  layerCount: number;
  /** Quantos ciclos de retração. Diagnóstico de peça cheia de salto. */
  retractionCount: number;
}

/** Canto de referência da costura: fundo-esquerda da caixa da peça. */
function seamAnchor(layers: LayerPlan[]): Point2 {
  let minX = Infinity;
  let maxY = -Infinity;
  for (const layer of layers) {
    for (const path of layer.perimeters) {
      const pts = Array.isArray(path) ? path : (path.contour ?? []);
      for (const p of pts) {
        if (p && typeof p.x === "number") {
          if (p.x < minX) minX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
      }
    }
  }
  return {
    x: Number.isFinite(minX) ? minX : 0,
    y: Number.isFinite(maxY) ? maxY : 0,
  };
}

/**
 * Gera o G-code.
 *
 * Os comentários `;TYPE:` seguem a convenção que os visualizadores usam para
 * colorir por tipo de extrusão — é o que permite o preview por camada.
 *
 * ESTIMATIVA DE TEMPO: por velocidade constante, sem modelar aceleração nem
 * jerk. Subestima peça com muitos percursos curtos, onde o bico passa a maior
 * parte do tempo acelerando. Trate como piso, não como previsão.
 */
export function generateGcode(
  layers: LayerPlan[],
  profile: PrinterProfile,
  settings: PrintSettings,
): GcodeResult {
  const out: string[] = [];

  /**
   * Filamento DEPOSITADO. Não é o valor do eixo E quando há retração — ver
   * `emitE`. Manter os dois separados é o que garante que `filamentMm` fique
   * idêntico com e sem retração: retração não consome material, ela devolve.
   */
  let extruded = 0;
  let seconds = 0;
  let cursor: Point2 = { x: 0, y: 0 };
  let retracted = false;
  let retractionCount = 0;
  let currentFan = -1;
  let currentType = "";
  /**
   * Paredes da camada atual, para o combing decidir se o salto sai da peça.
   * Vazio durante skirt e brim: ali o salto é por fora mesmo, e retrair é certo.
   */
  let boundary: Contour[] = [];

  const retractionMm = Math.max(0, profile.retractionMm);
  const retractionFeed = Math.max(1, profile.retractionSpeedMmS) * 60;
  const anchor = seamAnchor(layers);

  const emitType = (type: string) => {
    if (type === currentType) return;
    out.push(`;TYPE:${type}`);
    currentType = type;
  };

  const retract = () => {
    // Enquanto nada foi depositado não há o que recolher, e puxar E abaixo de
    // zero é G-code que algumas firmwares recusam.
    if (retracted || retractionMm <= 0 || extruded < retractionMm) return;
    out.push(`G1 F${retractionFeed.toFixed(0)} E${(extruded - retractionMm).toFixed(5)}`);
    seconds += retractionMm / profile.retractionSpeedMmS;
    retracted = true;
    retractionCount++;
  };

  const prime = () => {
    if (!retracted) return;
    out.push(`G1 F${retractionFeed.toFixed(0)} E${extruded.toFixed(5)}`);
    seconds += retractionMm / profile.retractionSpeedMmS;
    retracted = false;
  };

  const emitTravel = (to: Point2, feedMmMin: number) => {
    const d = dist(cursor, to);
    if (d < 1e-6) return;
    // Combing: salto longo só retrai se SAIR da peça. Ver `combing.ts` — sem
    // este teste o Acoplamento retraía 24.271 vezes e ganhava 47 minutos.
    if (d >= profile.retractionMinTravelMm && travelCrossesWall(cursor, to, boundary)) retract();
    out.push(`G0 F${feedMmMin.toFixed(0)} X${to.x.toFixed(3)} Y${to.y.toFixed(3)}`);
    seconds += d / (feedMmMin / 60);
    cursor = to;
  };

  const emitExtrude = (to: Point2, feedMmMin: number, layerHeight: number, flow = 1) => {
    const d = dist(cursor, to);
    if (d < 1e-6) return;
    prime(); // extrudar retraído sairia oco até a pressão voltar
    extruded += extrusionFor(d, settings.lineWidth, layerHeight, profile.filamentDiameter) * flow;
    out.push(
      `G1 F${feedMmMin.toFixed(0)} X${to.x.toFixed(3)} Y${to.y.toFixed(3)} E${extruded.toFixed(5)}`,
    );
    seconds += d / (feedMmMin / 60);
    cursor = to;
  };

  /** Volta fechada simples, sem costura escolhida. Skirt e brim usam isto. */
  const emitLoop = (contour: Contour, printFeed: number, travelFeed: number, h: number) => {
    if (contour.length < 2) return;
    emitTravel(contour[0]!, travelFeed);
    for (let i = 1; i < contour.length; i++) emitExtrude(contour[i]!, printFeed, h);
    emitExtrude(contour[0]!, printFeed, h);
  };

  // ── Cabeçalho ────────────────────────────────────────────────────────────
  out.push(
    `; gerado por DeskcommCRM — perfil ${profile.name}`,
    `; altura de camada ${settings.layerHeight} mm | largura ${settings.lineWidth} mm`,
    `; retração ${retractionMm} mm a ${profile.retractionSpeedMmS} mm/s | costura ${settings.seamMode ?? "alinhada"}`,
    `M140 S${profile.bedTempC}`,
    `M104 S${profile.nozzleTempC}`,
    `M190 S${profile.bedTempC}`,
    `M109 S${profile.nozzleTempC}`,
    "G21 ; unidades em milímetros",
    "G90 ; coordenadas absolutas",
    "M82 ; extrusora em modo absoluto",
    "M107 ; ventoinha desligada na base",
    "G28 ; referencia todos os eixos",
    "G92 E0",
  );

  layers.forEach((layer, index) => {
    const isFirst = index === 0;
    const layerHeight = isFirst ? settings.firstLayerHeight : settings.layerHeight;
    const printFeed = (isFirst ? profile.firstLayerSpeed : profile.printSpeed) * 60;
    const travelFeed = profile.travelSpeed * 60;

    out.push(`;LAYER:${index}`, `G0 Z${layer.z.toFixed(3)}`);

    // Fronteira do combing: a parede EXTERNA da camada (furos inclusos, que
    // também são fronteira — atravessar um furo é atravessar o vazio).
    //
    // Zerada durante skirt e brim: lá o bico está por fora da peça, onde
    // qualquer salto é sobre a mesa e retrair é o certo.
    boundary = [];

    // Ventoinha só quando o valor muda — repetir a cada camada polui o arquivo
    // sem efeito nenhum na máquina.
    const fan = fanValueFor(index, profile);
    if (fan !== currentFan) {
      out.push(fan <= 0 ? "M107" : `M106 S${fan}`);
      currentFan = fan;
    }

    // Aderência antes da peça: o skirt prepara o fluxo, o brim já ancora a base
    // antes de a primeira parede que conta ser depositada.
    if (layer.skirt && layer.skirt.length > 0) {
      emitType("SKIRT");
      for (const loop of layer.skirt) emitLoop(loop, printFeed, travelFeed, layerHeight);
    }
    if (layer.brim && layer.brim.length > 0) {
      emitType("BRIM");
      for (const loop of layer.brim) emitLoop(loop, printFeed, travelFeed, layerHeight);
    }

    // A partir daqui o bico trabalha dentro da peça: o combing entra em vigor.
    for (const path of layer.perimeters) {
      const c: Contour = Array.isArray(path) ? path : (path.contour ?? []);
      const isOuter = Array.isArray(path) ? true : (path.kind ?? "externa") === "externa";
      if (isOuter && c.length >= 3) boundary.push(c);
    }

    // Perímetros. Chegam da mais interna para a mais externa: a externa é a que
    // se vê, e imprimi-la por último evita que as internas a empurrem.
    for (const path of layer.perimeters) {
      const contour: Contour = Array.isArray(path) ? path : (path.contour ?? []);
      if (!contour || contour.length < 2) continue;

      const kind = Array.isArray(path) ? "externa" : (path.kind ?? "externa");
      emitType(kind === "externa" ? "WALL-OUTER" : "WALL-INNER");

      const start = settings.seamMode
        ? seamStartIndex(contour, settings.seamMode, {
            cursor,
            anchor,
            layerIndex: index,
          })
        : 0;
      const rotated = rotateToStart(contour, start);
      emitTravel(rotated[0]!, travelFeed);

      // Cachecol só na parede externa: na interna seria tempo gasto onde
      // ninguém olha.
      if (kind === "externa" && (settings.scarfLengthMm ?? 0) > 0) {
        for (const step of scarfPath(rotated, settings.scarfLengthMm ?? 0)) {
          emitExtrude(step.point, printFeed, layerHeight, step.flow);
        }
      } else {
        for (let i = 1; i < rotated.length; i++) emitExtrude(rotated[i]!, printFeed, layerHeight);
        emitExtrude(rotated[0]!, printFeed, layerHeight); // fecha o laço
      }
    }

    if (layer.infill.length > 0) {
      emitType("FILL");
      for (const line of orderByProximity(layer.infill, cursor)) {
        emitTravel(line.from, travelFeed);
        emitExtrude(line.to, printFeed, layerHeight);
      }
    }

    // Suporte por último na camada: assim o bico só passa por cima da peça
    // depois de ela estar depositada, e qualquer escorrimento cai no material
    // que vai ser quebrado fora, não no acabamento.
    if (layer.supports && layer.supports.length > 0) {
      emitType("SUPPORT");
      for (const line of orderByProximity(layer.supports, cursor)) {
        emitTravel(line.from, travelFeed);
        emitExtrude(line.to, printFeed, layerHeight);
      }
    }
  });

  // ── Rodapé ───────────────────────────────────────────────────────────────
  retract(); // sem isto o bico escorre enquanto sobe e pinga na peça
  out.push(
    "M107 ; desliga a ventoinha",
    "M104 S0 ; desliga o bico",
    "M140 S0 ; desliga a mesa",
    "M84 ; desliga os motores",
    `; filamento: ${extruded.toFixed(1)} mm`,
    `; retrações: ${retractionCount}`,
  );

  return {
    gcode: `${out.join("\n")}\n`,
    filamentMm: extruded,
    filamentGrams: filamentGrams(extruded, profile.filamentDiameter, settings.filamentDensity),
    estimatedSeconds: seconds,
    layerCount: layers.length,
    retractionCount,
  };
}

/** `3725` → `"1 h 02 min"`. Para a UI. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${s} s`;
}
