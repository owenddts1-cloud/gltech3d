/**
 * Fatiamento: malha triangular → contornos fechados por camada.
 *
 * É a base de todo o resto do slicer. Se o contorno sair errado aqui, perímetro,
 * preenchimento e suporte saem errados juntos — e o erro só aparece na peça
 * impressa. Por isso este módulo é PURO e tem teste para cada caso degenerado.
 *
 * ESCRITO DO ZERO a partir da descrição do algoritmo. Nenhuma linha vem de
 * CuraEngine, PrusaSlicer ou Slic3r — os três são AGPL, e embutir AGPL num SaaS
 * fechado obrigaria a abrir o código do CRM inteiro para qualquer usuário que o
 * acessasse pela rede.
 */

export interface Point2 {
  x: number;
  y: number;
}

/** Contorno fechado. O último ponto NÃO repete o primeiro. */
export type Contour = Point2[];

export interface Layer {
  z: number;
  /** Contornos fechados. Externos e furos — a distinção é feita por `isHole`. */
  contours: Contour[];
  /** Trechos que não fecharam, por buraco na malha. Vazio numa malha sã. */
  openPaths: Contour[];
}

/**
 * Identidade de ponto na costura, em mm.
 *
 * Fica APERTADO de propósito. A tentação é afrouxar quando um contorno não
 * fecha, mas medi: subir para 1e-3 piorou a peça real (2 → 4 contornos abertos,
 * e 2 camadas sem contorno nenhum). Tolerância grande descarta segmento curto
 * legítimo e fecha o laço cedo demais, quando a caminhada passa perto do início.
 *
 * Gap de verdade é resolvido na SEGUNDA passada — ver `joinOpenPaths`.
 */
const WELD_EPS = 1e-4;

/**
 * Fechamento de vão, em mm. 10 µm.
 *
 * Só entra depois que a costura exata desistiu. Face quase horizontal amplifica
 * erro de Float32: um desvio ínfimo em z vira desvio grande em xy no ponto de
 * cruzamento, e as pontas ficam a alguns décimos de micron uma da outra. Com
 * bico de 400 µm e mecânica que repete em ~10 µm, juntar aí não muda a peça.
 */
const GAP_CLOSE = 1e-2;

/** Só descarta segmento verdadeiramente degenerado, não segmento pequeno. */
const MIN_SEGMENT = 1e-9;

/**
 * Desloca a altura da camada quando ela cai exatamente sobre um vértice.
 *
 * Vértice em cima do plano gera segmento degenerado e contorno que não fecha.
 * Deslocar meio micron é invisível na peça e elimina a classe inteira de erro —
 * é o mesmo truque que todo fatiador usa.
 */
const Z_NUDGE = 5e-4;

interface Segment {
  a: Point2;
  b: Point2;
}

const cellOf = (v: number): number => Math.round(v / WELD_EPS);
const key = (p: Point2): string => `${cellOf(p.x)}:${cellOf(p.y)}`;

/**
 * A célula do ponto e as 8 vizinhas.
 *
 * BUG QUE ISTO CORRIGE: dois triângulos que compartilham uma aresta produzem o
 * mesmo ponto de cruzamento, mas o cálculo pode diferir nos últimos bits do
 * float (a interpolação roda com os vértices em ordem trocada). Se esse valor
 * cair exatamente na fronteira de arredondamento da grade — `x/eps` em 12345,4999
 * contra 12345,5001 — os dois pontos vão para células diferentes e a costura
 * nunca os liga.
 *
 * Numa peça real de 2.602 triângulos isso deixou 49 das 357 camadas com contorno
 * aberto, apesar de a malha ser perfeitamente manifold (3.903 arestas, todas com
 * exatamente 2 triângulos). O cubo sintético dos testes não pegava: as
 * coordenadas caíam longe das fronteiras.
 */
function neighborKeys(p: Point2): string[] {
  const cx = cellOf(p.x);
  const cy = cellOf(p.y);
  const keys: string[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) keys.push(`${cx + dx}:${cy + dy}`);
  }
  return keys;
}

/** Mesmo ponto, dentro da tolerância de solda. */
const samePoint = (a: Point2, b: Point2): boolean =>
  Math.abs(a.x - b.x) <= WELD_EPS && Math.abs(a.y - b.y) <= WELD_EPS;

/** Interpola o cruzamento da aresta v0→v1 com o plano z. */
function crossAt(
  v0: [number, number, number],
  v1: [number, number, number],
  z: number,
): Point2 {
  const t = (z - v0[2]) / (v1[2] - v0[2]);
  return { x: v0[0] + t * (v1[0] - v0[0]), y: v0[1] + t * (v1[1] - v0[1]) };
}

/**
 * Segmentos de interseção de UM plano z com a malha.
 *
 * `positions` é o array plano de 9 floats por triângulo, como o parser de STL
 * devolve. Triângulo que não cruza o plano é descartado sem custo.
 */
export function sliceSegmentsAt(positions: Float32Array, z: number): Segment[] {
  const segments: Segment[] = [];

  for (let i = 0; i + 8 < positions.length; i += 9) {
    const v: Array<[number, number, number]> = [
      [positions[i]!, positions[i + 1]!, positions[i + 2]!],
      [positions[i + 3]!, positions[i + 4]!, positions[i + 5]!],
      [positions[i + 6]!, positions[i + 7]!, positions[i + 8]!],
    ];

    // Acima/abaixo por sinal. Com o nudge aplicado antes, nenhum vértice fica
    // exatamente em z, então não há caso "sobre o plano" a tratar.
    let above = 0;
    for (const p of v) if (p[2] > z) above++;
    if (above === 0 || above === 3) continue; // não cruza

    // As duas arestas que cruzam são as que ligam vértices de lados opostos.
    const crossings: Point2[] = [];
    for (let e = 0; e < 3; e++) {
      const p0 = v[e]!;
      const p1 = v[(e + 1) % 3]!;
      if (p0[2] > z !== p1[2] > z) crossings.push(crossAt(p0, p1, z));
    }
    if (crossings.length !== 2) continue; // degenerado

    const [a, b] = crossings as [Point2, Point2];
    // Só o degenerado sai. Descartar por WELD_EPS comia segmento curto de peça
    // com detalhe fino e abria o contorno.
    if (Math.hypot(a.x - b.x, a.y - b.y) < MIN_SEGMENT) continue;
    segments.push({ a, b });
  }

  return segments;
}

/**
 * Costura segmentos soltos em contornos fechados.
 *
 * Os segmentos saem do passo anterior sem ordem nenhuma. A costura indexa as
 * pontas numa hash com tolerância e caminha de segmento em segmento até voltar
 * ao início. O que não fechar vira `openPaths` — sintoma de malha com buraco.
 */
export function stitchSegments(segments: Segment[]): {
  contours: Contour[];
  openPaths: Contour[];
} {
  const byPoint = new Map<string, number[]>();
  segments.forEach((s, index) => {
    for (const p of [s.a, s.b]) {
      const k = key(p);
      const list = byPoint.get(k);
      if (list) list.push(index);
      else byPoint.set(k, [index]);
    }
  });

  const used = new Array<boolean>(segments.length).fill(false);
  const contours: Contour[] = [];
  const openPaths: Contour[] = [];

  for (let start = 0; start < segments.length; start++) {
    if (used[start]) continue;
    used[start] = true;

    const first = segments[start]!.a;
    const path: Point2[] = [first, segments[start]!.b];
    let head = segments[start]!.b;
    let closed = false;

    // O laço é limitado pelo total de segmentos: malha corrompida não pode
    // travar a thread num ciclo infinito.
    for (let guard = 0; guard <= segments.length; guard++) {
      if (samePoint(head, first)) {
        closed = true;
        break;
      }

      // Procura nas 9 células ao redor, não só na do ponto — ver `neighborKeys`.
      let nextIndex: number | undefined;
      for (const k of neighborKeys(head)) {
        const candidates = byPoint.get(k);
        if (!candidates) continue;
        nextIndex = candidates.find(
          (c) => !used[c] && (samePoint(segments[c]!.a, head) || samePoint(segments[c]!.b, head)),
        );
        if (nextIndex !== undefined) break;
      }
      if (nextIndex === undefined) break;

      used[nextIndex] = true;
      const seg = segments[nextIndex]!;
      // O segmento pode estar guardado na direção contrária.
      head = samePoint(seg.a, head) ? seg.b : seg.a;
      path.push(head);
    }

    if (closed) {
      path.pop(); // o último ponto repete o primeiro
      if (path.length >= 3) contours.push(path);
    } else if (path.length >= 2) {
      openPaths.push(path);
    }
  }

  return { contours, openPaths };
}

const within = (a: Point2, b: Point2, tol: number): boolean =>
  Math.hypot(a.x - b.x, a.y - b.y) <= tol;

/**
 * Segunda passada: junta trechos que a costura exata não conseguiu ligar.
 *
 * POR QUE EXISTE: a costura da primeira passada exige coincidência a 0,1 µm.
 * Em face quase horizontal, o ponto de cruzamento é hipersensível a erro de
 * Float32 em z, e duas pontas do mesmo contorno podem ficar a alguns décimos de
 * micron uma da outra. A tentação é afrouxar a primeira passada — medi, e isso
 * PIORA: descarta segmento curto legítimo e fecha o laço cedo demais.
 *
 * Aqui o afrouxamento é seguro porque só age no que já falhou, e o vão tolerado
 * (10 µm) é 40× menor que o bico.
 *
 * Junta em qualquer das quatro combinações de pontas, porque um trecho pode
 * estar guardado na direção contrária ao do vizinho.
 */
export function joinOpenPaths(
  paths: Contour[],
  tolerance = GAP_CLOSE,
): { contours: Contour[]; openPaths: Contour[] } {
  const pool = paths.map((p) => [...p]);

  let merged = true;
  while (merged) {
    merged = false;
    search: for (let i = 0; i < pool.length; i++) {
      const a = pool[i]!;
      const aHead = a[0]!;
      const aTail = a[a.length - 1]!;

      for (let j = i + 1; j < pool.length; j++) {
        const b = pool[j]!;
        const bHead = b[0]!;
        const bTail = b[b.length - 1]!;

        if (within(aTail, bHead, tolerance)) pool[i] = [...a, ...b.slice(1)];
        else if (within(aTail, bTail, tolerance)) pool[i] = [...a, ...[...b].reverse().slice(1)];
        else if (within(aHead, bTail, tolerance)) pool[i] = [...b, ...a.slice(1)];
        else if (within(aHead, bHead, tolerance)) pool[i] = [...[...b].reverse(), ...a.slice(1)];
        else continue;

        pool.splice(j, 1);
        merged = true;
        break search;
      }
    }
  }

  const contours: Contour[] = [];
  const openPaths: Contour[] = [];
  for (const path of pool) {
    if (path.length >= 4 && within(path[0]!, path[path.length - 1]!, tolerance)) {
      path.pop(); // o último ponto repete o primeiro
      contours.push(path);
    } else {
      openPaths.push(path);
    }
  }
  return { contours, openPaths };
}

/** Área com sinal. Positiva = anti-horário. Serve para orientar e achar furos. */
export function signedArea(contour: Contour): number {
  let area = 0;
  for (let i = 0; i < contour.length; i++) {
    const p = contour[i]!;
    const q = contour[(i + 1) % contour.length]!;
    area += p.x * q.y - q.x * p.y;
  }
  return area / 2;
}

/** Ponto dentro do contorno, por cruzamento de raio (regra par-ímpar). */
export function pointInContour(point: Point2, contour: Contour): boolean {
  let inside = false;
  for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
    const a = contour[i]!;
    const b = contour[j]!;
    if (a.y > point.y !== b.y > point.y) {
      const x = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (point.x < x) inside = !inside;
    }
  }
  return inside;
}

export interface SliceOptions {
  layerHeight: number;
  /** Altura da primeira camada. Costuma ser maior, para colar na mesa. */
  firstLayerHeight?: number;
}

/**
 * Fatia a malha inteira.
 *
 * As camadas são posicionadas no MEIO da fatia, não na base: é a altura onde a
 * seção representa melhor o material daquele passo. Uma camada exatamente na
 * base do modelo pegaria a face inferior inteira e produziria contorno degenerado.
 */
export function sliceMesh(positions: Float32Array, options: SliceOptions): Layer[] {
  const { layerHeight } = options;
  if (!(layerHeight > 0)) throw new Error("A altura de camada tem de ser maior que zero.");
  if (positions.length < 9) return [];

  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 2; i < positions.length; i += 3) {
    const z = positions[i]!;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  if (!Number.isFinite(minZ) || maxZ - minZ < layerHeight / 2) return [];

  const firstHeight = options.firstLayerHeight ?? layerHeight;
  const layers: Layer[] = [];

  let bottom = minZ;
  let index = 0;
  while (bottom < maxZ) {
    const thickness = index === 0 ? firstHeight : layerHeight;
    const z = bottom + thickness / 2;
    if (z >= maxZ) break;

    // Se o plano cair sobre um vértice, desloca — ver Z_NUDGE. Repete enquanto
    // houver colisão: deslocar uma vez pode jogar o plano sobre OUTRO vértice.
    let planeZ = z;
    for (let attempt = 0; attempt < 8; attempt++) {
      let hit = false;
      for (let i = 2; i < positions.length; i += 3) {
        if (Math.abs(positions[i]! - planeZ) < Z_NUDGE) {
          hit = true;
          break;
        }
      }
      if (!hit) break;
      planeZ += Z_NUDGE * 2;
    }

    const first = stitchSegments(sliceSegmentsAt(positions, planeZ));
    // Segunda passada só no que sobrou — ver `joinOpenPaths`.
    const rescued = first.openPaths.length > 0
      ? joinOpenPaths(first.openPaths)
      : { contours: [], openPaths: [] };

    const contours = [...first.contours, ...rescued.contours];
    // Camada sem nada não entra. O acúmulo de ponto flutuante em `bottom +=
    // thickness` faz a última iteração passar raspando pelo teste de parada
    // (9,8999… em vez de 9,9), e o plano acabava acima do topo do modelo: uma
    // camada vazia que viraria `;LAYER:` sem percurso nenhum no G-code.
    if (contours.length > 0 || rescued.openPaths.length > 0) {
      layers.push({ z: bottom + thickness, contours, openPaths: rescued.openPaths });
    }

    bottom += thickness;
    index++;
  }

  return layers;
}

/**
 * Marca quais contornos são FURO, pela contagem de quantos outros os contêm.
 *
 * Ímpar = furo. Cobre o caso aninhado (furo dentro de ilha dentro de furo), que
 * a regra ingênua "o maior é externo" erra.
 */
export function classifyHoles(contours: Contour[]): Array<{ contour: Contour; isHole: boolean }> {
  return contours.map((contour, i) => {
    const probe = contour[0]!;
    let depth = 0;
    contours.forEach((other, j) => {
      if (i !== j && pointInContour(probe, other)) depth++;
    });
    return { contour, isHole: depth % 2 === 1 };
  });
}
