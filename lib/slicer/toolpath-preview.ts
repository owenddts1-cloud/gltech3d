/**
 * Empacota o percurso fatiado em buffers prontos para o WebGL.
 *
 * POR QUE ISTO É UM MÓDULO À PARTE, e não código dentro do componente: uma peça
 * real tem centenas de milhares de segmentos, e o jeito errado de desenhar isso
 * derruba a aba. O jeito certo tem duas regras, e as duas são testáveis sem
 * WebGL nenhum:
 *
 *   1. UMA geometria por TIPO de percurso — não um objeto por caminho. Mil
 *      objetos `Line` na cena custam mil chamadas de desenho por quadro; um
 *      `LineSegments` com mil caminhos dentro custa uma.
 *
 *   2. Os segmentos saem ORDENADOS POR CAMADA, com um índice de onde cada camada
 *      começa. Mudar a faixa visível vira `setDrawRange(inicio, quantidade)` —
 *      nenhuma alocação, nenhum upload para a GPU. Reconstruir o buffer a cada
 *      arrastada do controle deslizante é o que trava.
 *
 * As cores seguem o mesmo `;TYPE:` que o emissor de G-code escreve, para o que
 * se vê na tela e o que o arquivo diz serem a mesma coisa.
 */

import type { LayerPlan } from "./gcode";

export type ToolpathKind =
  | "externa"
  | "interna"
  | "preenchimento"
  | "ponte"
  | "alisamento"
  | "suporte"
  | "aderencia";

export const TOOLPATH_KINDS: readonly ToolpathKind[] = [
  "externa",
  "interna",
  "preenchimento",
  "ponte",
  "alisamento",
  "suporte",
  "aderencia",
] as const;

export interface ToolpathLabel {
  label: string;
  /** Hex, o mesmo esquema do preview 2D. */
  color: string;
  /** Rótulo correspondente no G-code, para quem cruza tela e arquivo. */
  gcodeType: string;
}

export const TOOLPATH_LABELS: Record<ToolpathKind, ToolpathLabel> = {
  externa: { label: "Parede externa", color: "#fb923c", gcodeType: "WALL-OUTER" },
  interna: { label: "Parede interna", color: "#c2703a", gcodeType: "WALL-INNER" },
  preenchimento: { label: "Preenchimento", color: "#60a5fa", gcodeType: "FILL" },
  ponte: { label: "Ponte", color: "#f472b6", gcodeType: "BRIDGE" },
  alisamento: { label: "Alisamento", color: "#facc15", gcodeType: "IRONING" },
  suporte: { label: "Suporte", color: "#a3a3a3", gcodeType: "SUPPORT" },
  aderencia: { label: "Aderência", color: "#737373", gcodeType: "SKIRT / BRIM / RAFT" },
};

export interface ToolpathBuffer {
  /** `x, y, z` por vértice; dois vértices por segmento. */
  positions: Float32Array;
  /**
   * Em qual VÉRTICE cada camada começa. Tem `layers.length + 1` posições — a
   * última é o total, para a faixa até a camada N ser `offsets[N + 1]` sem caso
   * especial no fim.
   */
  layerOffsets: Int32Array;
  segments: number;
}

export type ToolpathBuffers = Record<ToolpathKind, ToolpathBuffer>;

/** Segmento no plano, do jeito que o plano de camada guarda. */
interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/**
 * Monta os buffers.
 *
 * Percorre as camadas UMA vez por tipo? Não: percorre uma vez só, distribuindo
 * cada percurso na lista do seu tipo. Duas passadas dobrariam o custo numa peça
 * de 800 camadas sem ganhar nada.
 */
export function buildToolpathBuffers(layers: readonly LayerPlan[]): ToolpathBuffers {
  const porTipo = new Map<ToolpathKind, Seg[][]>();
  for (const k of TOOLPATH_KINDS) porTipo.set(k, layers.map(() => []));

  layers.forEach((layer, i) => {
    const em = (k: ToolpathKind): Seg[] => porTipo.get(k)![i]!;

    // Camada de raft é material sacrificial: o percurso dela é aderência, não
    // peça. Pintá-la de laranja faria parecer que a peça começa embaixo do que
    // vai para o lixo.
    const raft = layer.isRaft === true;

    for (const p of layer.perimeters) {
      const contorno = Array.isArray(p) ? p : p.contour;
      const tipo: ToolpathKind = raft
        ? "aderencia"
        : Array.isArray(p) || p.kind !== "interna"
          ? "externa"
          : "interna";
      pushLoop(em(tipo), contorno);
    }

    pushLines(em(raft ? "aderencia" : "preenchimento"), layer.infill);
    if (layer.bridges) pushLines(em("ponte"), layer.bridges);
    if (layer.ironing) pushLines(em("alisamento"), layer.ironing);
    if (layer.supports) pushLines(em("suporte"), layer.supports);
    if (layer.skirt) for (const c of layer.skirt) pushLoop(em("aderencia"), c);
    if (layer.brim) for (const c of layer.brim) pushLoop(em("aderencia"), c);
  });

  const out = {} as ToolpathBuffers;
  for (const kind of TOOLPATH_KINDS) {
    out[kind] = empacotar(porTipo.get(kind)!, layers);
  }
  return out;
}

function pushLines(alvo: Seg[], linhas: ReadonlyArray<{ from: { x: number; y: number }; to: { x: number; y: number } }>): void {
  for (const l of linhas) {
    alvo.push({ ax: l.from.x, ay: l.from.y, bx: l.to.x, by: l.to.y });
  }
}

/** Um contorno é FECHADO: o último ponto liga de volta no primeiro. */
function pushLoop(alvo: Seg[], contorno: ReadonlyArray<{ x: number; y: number }>): void {
  if (contorno.length < 2) return;
  for (let i = 0; i < contorno.length; i++) {
    const a = contorno[i]!;
    const b = contorno[(i + 1) % contorno.length]!;
    alvo.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
  }
}

function empacotar(porCamada: readonly Seg[][], layers: readonly LayerPlan[]): ToolpathBuffer {
  const total = porCamada.reduce((n, s) => n + s.length, 0);
  const positions = new Float32Array(total * 6);
  const layerOffsets = new Int32Array(porCamada.length + 1);

  let vertice = 0;
  let at = 0;

  porCamada.forEach((segs, i) => {
    layerOffsets[i] = vertice;
    // O Z do percurso é o Z da camada: é onde o bico realmente está.
    const z = layers[i]?.z ?? 0;
    for (const s of segs) {
      positions[at] = s.ax;
      positions[at + 1] = s.ay;
      positions[at + 2] = z;
      positions[at + 3] = s.bx;
      positions[at + 4] = s.by;
      positions[at + 5] = z;
      at += 6;
      vertice += 2;
    }
  });

  layerOffsets[porCamada.length] = vertice;
  return { positions, layerOffsets, segments: total };
}

/**
 * Faixa de vértices a desenhar, para `setDrawRange`.
 *
 * `de` e `ate` são índices de camada INCLUSIVOS. Fora de ordem ou fora da faixa
 * são corrigidos aqui — o controle deslizante da tela não deve poder produzir
 * um `count` negativo, que o three.js aceita e desenha lixo.
 */
export function drawRangeFor(
  buffer: ToolpathBuffer,
  de: number,
  ate: number,
): { start: number; count: number } {
  const ultima = buffer.layerOffsets.length - 2;
  if (ultima < 0) return { start: 0, count: 0 };

  const lo = Math.max(0, Math.min(de, ate, ultima));
  const hi = Math.min(ultima, Math.max(de, ate, 0));

  const start = buffer.layerOffsets[lo]!;
  const end = buffer.layerOffsets[hi + 1]!;
  return { start, count: Math.max(0, end - start) };
}
