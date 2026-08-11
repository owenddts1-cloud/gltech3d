/**
 * Perímetros: as paredes da peça, compensadas pela largura do bico.
 *
 * ESTE É O PONTO DIFÍCIL DO FATIADOR. O contorno cru que sai do fatiamento é a
 * superfície do modelo. Se o bico seguir esse caminho, metade do filete fica
 * FORA da peça — ela sai ~0,2 mm maior de cada lado com bico de 0,4. A parede
 * tem de andar meia largura para dentro, e cada parede seguinte mais uma
 * largura.
 *
 * Encolher um polígono não é encolher cada aresta: em canto côncavo as arestas
 * deslocadas se cruzam, e o resultado ingênuo tem laços invertidos que viram
 * material no lugar errado. Parede fina precisa SUMIR, não virar laço negativo.
 * Remover essas auto-interseções corretamente é o problema que a biblioteca
 * resolve — por isso ela está aqui em vez de um offset caseiro.
 *
 * POR QUE `clipper-lib` E NÃO `clipper2-js`: tentei a clipper2-js 1.2.4
 * primeiro, e ela está QUEBRADA para offset. Medido: um quadrado de 20×20
 * encolhido em 1 devolveu `x[1..21] y[-0,64..20]` — nem quadrado é, e a área saiu
 * fracionária a partir de entrada inteira. Reproduzi pelos três caminhos da API
 * (`InflatePaths` com `Paths64` montado à mão, com `Clipper.makePath` e com
 * `ClipperOffset` direto): resultado idêntico e errado nos três.
 * A `clipper-lib` (port do Clipper 1 do Angus Johnson, Boost Software License)
 * dá exatamente 18×18 no mesmo caso.
 */

import ClipperLib from "clipper-lib";

import { classifyHoles, signedArea, type Contour, type Point2 } from "./slice";

/**
 * Fator mm → inteiro. O Clipper trabalha em inteiros para não acumular erro de
 * arredondamento nos booleanos.
 *
 * 1000 = precisão de 1 µm. Um bico de 400 µm não expressa nada abaixo disso, e o
 * fator mantém peça de 1 m (10⁶ unidades) longe do limite de inteiro seguro.
 */
const SCALE = 1000;

/** Limite do miter: a ponta do canto é cortada além de 2× a distância do offset. */
const MITER_LIMIT = 2;
/** Tolerância de arco, em unidades escaladas (0,25 µm). */
const ARC_TOLERANCE = 0.25;

type ClipperPath = ClipperLib.IntPoint[];

/**
 * Orienta a região: externo anti-horário, furo horário.
 *
 * OBRIGATÓRIO com a regra `NonZero`, que é a que distingue ilha de furo pelo
 * SENTIDO do contorno. Os contornos que saem do fatiamento vêm sem orientação
 * garantida — a costura anda pelos segmentos na ordem em que aparecem.
 *
 * A alternativa seria `EvenOdd`, que ignora sentido. Medi: com EvenOdd duas
 * áreas SOBREPOSTAS se cancelam, e a união de dois quadrados de 10 mm com 5 mm
 * de sobreposição devolveu 150 mm² (o XOR) em vez de 175 (a união).
 */
function orient(contours: readonly Contour[]): Contour[] {
  return classifyHoles([...contours]).map(({ contour, isHole }) => {
    const querPositiva = !isHole;
    const estaPositiva = signedArea(contour) > 0;
    return querPositiva === estaPositiva ? contour : [...contour].reverse();
  });
}

const toClipper = (contours: readonly Contour[]): ClipperPath[] =>
  contours
    .filter((c) => c.length >= 3) // menos que isso não delimita área
    .map((c) => c.map((p) => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) })));

const fromClipper = (paths: ClipperPath[]): Contour[] =>
  paths
    .filter((p) => p.length >= 3)
    .map((p) => p.map((q): Point2 => ({ x: q.X / SCALE, y: q.Y / SCALE })));

/** Booleano de duas regiões, já orientadas. */
function boolOp(
  clipType: ClipperLib.ClipType,
  subject: readonly Contour[],
  clip: readonly Contour[],
): Contour[] {
  const clipper = new ClipperLib.Clipper();
  clipper.AddPaths(toClipper(orient(subject)), ClipperLib.PolyType.ptSubject, true);
  if (clip.length > 0) {
    clipper.AddPaths(toClipper(orient(clip)), ClipperLib.PolyType.ptClip, true);
  }
  const solution: ClipperPath[] = [];
  clipper.Execute(
    clipType,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  );
  return fromClipper(solution);
}

/**
 * Encolhe (delta negativo) ou expande (positivo) uma região, em mm.
 *
 * `jtMiter` mantém canto vivo até o limite; `jtRound` daria parede mais suave e
 * muitos mais segmentos no G-code, e `jtSquare` come detalhe.
 */
export function offsetRegion(contours: readonly Contour[], deltaMm: number): Contour[] {
  if (contours.length === 0) return [];
  if (deltaMm === 0) return boolOp(ClipperLib.ClipType.ctUnion, contours, []);

  const offset = new ClipperLib.ClipperOffset(MITER_LIMIT, ARC_TOLERANCE);
  offset.AddPaths(
    toClipper(orient(contours)),
    ClipperLib.JoinType.jtMiter,
    ClipperLib.EndType.etClosedPolygon,
  );
  const solution: ClipperPath[] = [];
  offset.Execute(solution, deltaMm * SCALE);
  return fromClipper(solution);
}

/** Diferença. Base das camadas sólidas de topo e base. */
export function subtractRegions(from: readonly Contour[], what: readonly Contour[]): Contour[] {
  if (from.length === 0) return [];
  if (what.length === 0) return boolOp(ClipperLib.ClipType.ctUnion, from, []);
  return boolOp(ClipperLib.ClipType.ctDifference, from, what);
}

/** Interseção. */
export function intersectRegions(a: readonly Contour[], b: readonly Contour[]): Contour[] {
  if (a.length === 0 || b.length === 0) return [];
  return boolOp(ClipperLib.ClipType.ctIntersection, a, b);
}

/** União. */
export function unionRegions(a: readonly Contour[], b: readonly Contour[]): Contour[] {
  if (a.length === 0) return boolOp(ClipperLib.ClipType.ctUnion, b, []);
  if (b.length === 0) return boolOp(ClipperLib.ClipType.ctUnion, a, []);
  return boolOp(ClipperLib.ClipType.ctUnion, a, b);
}

/**
 * Área da região, em mm².
 *
 * SEM `Math.abs` por caminho: furo tem área negativa e PRECISA descontar do
 * externo. Tirar o módulo de cada um somaria o furo em vez de subtraí-lo.
 */
export function regionArea(contours: readonly Contour[]): number {
  const paths = toClipper(orient(contours));
  const total = paths.reduce((sum, path) => sum + ClipperLib.Clipper.Area(path), 0);
  return total / (SCALE * SCALE);
}

export interface PerimeterOptions {
  /** Largura do filete extrudado, em mm. ≈ diâmetro do bico. */
  lineWidth: number;
  /** Quantas paredes. 2 a 3 é o usual em FDM. */
  wallCount: number;
}

export interface PerimeterResult {
  /** Uma lista por parede, da mais externa para a mais interna. */
  walls: Contour[][];
  /**
   * O que sobra para o preenchimento: dentro da última parede, já descontada
   * meia largura para o filete de preenchimento não invadir a parede.
   */
  infillRegion: Contour[];
}

/**
 * Gera as paredes de uma camada.
 *
 * A primeira anda `lineWidth / 2` para dentro — o filete é centrado no caminho,
 * então meia largura para dentro põe a borda EXTERNA do filete exatamente sobre
 * a superfície do modelo. É isto que faz a peça sair na medida.
 *
 * As seguintes andam mais uma largura cada. Quando a região some (parede fina
 * demais para caber outra volta), o laço para — insistir geraria caminho
 * degenerado no G-code.
 */
export function generatePerimeters(
  contours: readonly Contour[],
  options: PerimeterOptions,
): PerimeterResult {
  const { lineWidth, wallCount } = options;
  if (contours.length === 0 || wallCount < 1 || !(lineWidth > 0)) {
    return { walls: [], infillRegion: [] };
  }

  const walls: Contour[][] = [];
  for (let i = 0; i < wallCount; i++) {
    const wall = offsetRegion(contours, -lineWidth * (0.5 + i));
    if (wall.length === 0) break; // não cabe mais parede
    walls.push(wall);
  }

  // Meia largura além da última parede: sem isso o preenchimento encosta na
  // parede e superextruda a junção.
  const infillRegion =
    walls.length > 0 ? offsetRegion(contours, -lineWidth * (walls.length + 0.5)) : [];

  return { walls, infillRegion };
}
