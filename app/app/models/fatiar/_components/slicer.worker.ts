/**
 * Web Worker do fatiador.
 *
 * Fatiar uma peça de 800 camadas leva segundos e gera centenas de milhares de
 * percursos. Na main thread isso congela a aba inteira — por isso o pipeline
 * roda aqui.
 *
 * Casca fina, como o worker de STL: a lógica está em `lib/slicer/*`, que é puro
 * e testado. O worker só orquestra e reporta progresso.
 */

import { boundsOf } from "@/lib/models/stl";
import { parseMeshBuffer } from "@/lib/models/mesh";
import {
  applyOrientation,
  bestOrientation,
  DEFAULT_ORIENTATION_OPTIONS,
  IDENTITY,
} from "@/lib/models/orientation";
import { sliceToPlan, type SliceSettings } from "@/lib/slicer/pipeline";
import { generateGcode, type PrinterProfile } from "@/lib/slicer/gcode";
import type { Contour } from "@/lib/slicer/slice";
import type { InfillLine } from "@/lib/slicer/infill";

export interface SlicerRequest {
  arrayBuffer: ArrayBuffer;
  settings: SliceSettings;
  profile: PrinterProfile;
  filamentDensity: number;
  /** Girar a peça para a melhor posição antes de fatiar. */
  autoOrient: boolean;
  /** Nome do arquivo — dica de formato para o parser. */
  filename: string;
}

/** O que a orientação automática fez, para a tela poder mostrar o ganho. */
export interface OrientationReport {
  rotated: boolean;
  heightBeforeMm: number;
  heightAfterMm: number;
  bedContactBeforeMm2: number;
  bedContactAfterMm2: number;
}

/** Uma camada, enxuta para o preview — sem as regiões intermediárias. */
export interface PreviewLayer {
  z: number;
  /** Parede externa: a que se vê na peça. Desenhada mais grossa. */
  outerWalls: Contour[];
  /** Paredes internas. */
  innerWalls: Contour[];
  infill: InfillLine[];
  supports: InfillLine[];
  /** Laços de aderência. Só a primeira camada tem. */
  skirt: Contour[];
  brim: Contour[];
  solidCount: number;
}

export type SlicerResponse =
  | { kind: "progress"; ratio: number; label: string }
  | {
      kind: "done";
      layers: PreviewLayer[];
      gcode: string;
      filamentMm: number;
      filamentGrams: number;
      estimatedSeconds: number;
      openContourCount: number;
      layersWithoutWalls: number;
      supportVolumeCm3: number;
      retractionCount: number;
      orientation: OrientationReport | null;
      triangles: number;
      bounds: { min: [number, number, number]; max: [number, number, number] };
      elapsedMs: number;
    }
  | { kind: "error"; error: string };

/** Ver o worker de STL: `self` vem tipado como Window por causa da lib DOM. */
interface WorkerScope {
  onmessage: ((event: MessageEvent<SlicerRequest>) => void) | null;
  postMessage: (message: SlicerResponse) => void;
}

const ctx = self as unknown as WorkerScope;

ctx.onmessage = async (event) => {
  const started = Date.now();
  try {
    const { arrayBuffer, settings, profile, filamentDensity, autoOrient, filename } = event.data;

    ctx.postMessage({ kind: "progress", ratio: 0.05, label: "Lendo o arquivo" });
    const mesh = await parseMeshBuffer(arrayBuffer, filename);

    // Orientação ANTES de fatiar: girar depois seria refatiar tudo. É a decisão
    // de maior impacto do fluxo — no PAYLOAD, 22,85 -> 0,62 cm³ de suporte.
    let positions = mesh.positions;
    let bounds = mesh.boundingBox;
    let orientation: OrientationReport | null = null;

    if (autoOrient) {
      ctx.postMessage({ kind: "progress", ratio: 0.1, label: "Procurando a melhor posição" });
      const found = bestOrientation(positions, {
        ...DEFAULT_ORIENTATION_OPTIONS,
        maxOverhangDeg: settings.supportMaxOverhangDeg,
      });
      // `applyOrientation` também assenta a peça na mesa e centra em XY, então
      // vale rodar mesmo quando a matriz é identidade.
      positions = applyOrientation(positions, found.rotation);
      bounds = boundsOf(positions); // a caixa do arquivo não vale mais
      orientation = {
        rotated: found.rotation !== IDENTITY,
        heightBeforeMm: found.current.heightMm,
        heightAfterMm: found.best.heightMm,
        bedContactBeforeMm2: found.current.bedContactMm2,
        bedContactAfterMm2: found.best.bedContactMm2,
      };
    }

    ctx.postMessage({ kind: "progress", ratio: 0.2, label: "Fatiando e gerando paredes" });
    const plan = sliceToPlan(positions, settings);

    if (plan.layers.length === 0) {
      ctx.postMessage({
        kind: "error",
        error: "Nenhuma camada foi gerada. O modelo é mais fino que a altura de camada?",
      });
      return;
    }

    ctx.postMessage({ kind: "progress", ratio: 0.75, label: "Gerando o G-code" });
    const gcode = generateGcode(plan.layers, profile, {
      layerHeight: settings.layerHeight,
      firstLayerHeight: settings.firstLayerHeight,
      lineWidth: settings.lineWidth,
      filamentDensity,
      seamMode: settings.seamMode,
      scarfLengthMm: settings.scarfLengthMm,
    });

    ctx.postMessage({ kind: "progress", ratio: 0.95, label: "Montando o preview" });
    ctx.postMessage({
      kind: "done",
      // `solidRegion` fica de fora: é usada só para gerar o preenchimento e
      // dobraria o peso da mensagem sem nada a mostrar.
      layers: plan.layers.map((l) => {
        const outerWalls: Contour[] = [];
        const innerWalls: Contour[] = [];
        for (const p of l.perimeters) {
          // Perímetro sem rótulo (forma antiga) conta como externo: é o que o
          // emissor de G-code também assume.
          if (Array.isArray(p)) outerWalls.push(p);
          else if ((p.kind ?? "externa") === "externa") outerWalls.push(p.contour);
          else innerWalls.push(p.contour);
        }
        return {
          z: l.z,
          outerWalls,
          innerWalls,
          infill: l.infill,
          supports: l.supports ?? [],
          skirt: l.skirt ?? [],
          brim: l.brim ?? [],
          solidCount: l.solidRegion.length,
        };
      }),
      gcode: gcode.gcode,
      filamentMm: gcode.filamentMm,
      filamentGrams: gcode.filamentGrams,
      estimatedSeconds: gcode.estimatedSeconds,
      openContourCount: plan.openContourCount,
      layersWithoutWalls: plan.layersWithoutWalls,
      supportVolumeCm3: plan.supportVolumeCm3,
      retractionCount: gcode.retractionCount,
      orientation,
      triangles: mesh.numTriangles,
      bounds,
      elapsedMs: Date.now() - started,
    });
  } catch (error) {
    ctx.postMessage({
      kind: "error",
      error: error instanceof Error ? error.message : "Falha ao fatiar.",
    });
  }
};
