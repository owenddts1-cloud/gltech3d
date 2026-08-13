/**
 * Estimativa de peso e tempo a partir da malha — a ponte que faltava.
 *
 * O PROBLEMA QUE RESOLVE. Os 18 produtos do catálogo têm `filament_grams = 0` e
 * `print_time_seconds = 0`. Sem esses dois números o custo é incalculável, e é
 * daí que sai a "margem 100%" que o sistema exibia. Preencher à mão exigiria
 * pesar cada peça e cronometrar cada impressão.
 *
 * O fatiador já sabe as duas coisas: `generateGcode` devolve `filamentGrams` e
 * `estimatedSeconds`. O que faltava era alguém perguntar.
 *
 * MÓDULO PURO, sem DOM e sem `self`: roda no worker do navegador, no servidor e
 * no Vitest, e é o mesmo caminho que a tela de Fatiar usa — então a estimativa
 * da ficha do produto e o número da tela de Fatiar não podem divergir por
 * construção.
 *
 * LÊ STL E 3MF. É assíncrono por causa do 3MF: o pacote é um ZIP, e descompactar
 * passa por `DecompressionStream`, que é assíncrono. Node 18+ e todo browser
 * alvo têm essa API — eu havia afirmado o contrário numa rodada anterior, e
 * estava errado; a limitação era este arquivo chamar o parser de STL direto.
 *
 * ISTO É ESTIMATIVA, NÃO MEDIÇÃO. A peça real varia com preenchimento efetivo,
 * suporte, purga e falha. Por isso a saída carrega o perfil usado, e a migration
 * 0077 grava `cost_estimated_at` separado — para ninguém confundir com peso de
 * balança.
 */

import { parseMeshBuffer } from "@/lib/models/mesh";
import { applyOrientation, bestOrientation } from "@/lib/models/orientation";
import { sliceToPlan, DEFAULT_SLICE_SETTINGS, type SliceSettings } from "@/lib/slicer/pipeline";
import { generateGcode, DEFAULT_PROFILE, type PrinterProfile } from "@/lib/slicer/gcode";

export interface EstimateOptions {
  settings?: Partial<SliceSettings>;
  profile?: PrinterProfile;
  /** g/cm³. PLA ≈ 1,24. */
  filamentDensity?: number;
  /**
   * Girar a peça para a melhor posição antes de estimar.
   *
   * Ligado por padrão: a estimativa deve refletir como a peça SERÁ impressa, e
   * ninguém imprime de propósito na orientação que gasta 22 cm³ de suporte.
   */
  autoOrient?: boolean;
}

export interface MeshEstimate {
  filamentGrams: number;
  printTimeSeconds: number;
  /** Volume de suporte, em cm³. Zero quando o suporte está desligado. */
  supportCm3: number;
  layerCount: number;
  triangles: number;
  /** Contornos que não fecharam. Acima de zero, a malha tem buraco. */
  openContourCount: number;
  /** O perfil usado, para gravar como proveniência. */
  profile: {
    layerHeight: number;
    infillDensityPct: number;
    wallCount: number;
    supportsEnabled: boolean;
    autoOriented: boolean;
    filamentDensity: number;
  };
}

/**
 * Fatia a malha e devolve o que o custo precisa.
 *
 * O tempo é o mesmo "piso" que a tela de Fatiar informa: velocidade constante,
 * sem modelar aceleração. Subestima peça com muitos percursos curtos. Tratar
 * como limite inferior, não como previsão — e é por isso que a UI rotula assim.
 */
export async function estimateFromMesh(
  buffer: ArrayBuffer,
  options: EstimateOptions = {},
  /** Nome do arquivo — dica de formato, para o erro ser específico. */
  filename = "",
): Promise<MeshEstimate> {
  const mesh = await parseMeshBuffer(buffer, filename);
  const autoOrient = options.autoOrient ?? true;

  const positions = autoOrient
    ? applyOrientation(mesh.positions, bestOrientation(mesh.positions).rotation)
    : mesh.positions;

  const settings: SliceSettings = { ...DEFAULT_SLICE_SETTINGS, ...options.settings };
  const profile = options.profile ?? DEFAULT_PROFILE;
  const filamentDensity = options.filamentDensity ?? 1.24;

  const plan = sliceToPlan(positions, settings);
  if (plan.layers.length === 0) {
    throw new Error(
      "Nenhuma camada gerada. A peça é mais fina que a altura de camada, ou a malha está vazia.",
    );
  }

  const gcode = generateGcode(plan.layers, profile, {
    layerHeight: settings.layerHeight,
    firstLayerHeight: settings.firstLayerHeight,
    lineWidth: settings.lineWidth,
    filamentDensity,
    seamMode: settings.seamMode,
    scarfLengthMm: settings.scarfLengthMm,
  });

  return {
    filamentGrams: Math.round(gcode.filamentGrams * 100) / 100,
    printTimeSeconds: Math.round(gcode.estimatedSeconds),
    supportCm3: Math.round(plan.supportVolumeCm3 * 100) / 100,
    layerCount: plan.layers.length,
    triangles: mesh.numTriangles,
    openContourCount: plan.openContourCount,
    profile: {
      layerHeight: settings.layerHeight,
      infillDensityPct: settings.infillDensityPct,
      wallCount: settings.wallCount,
      supportsEnabled: settings.supportsEnabled,
      autoOriented: autoOrient,
      filamentDensity,
    },
  };
}
