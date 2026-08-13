/**
 * Separar uma malha em PARTES SOLTAS — o `P → By Loose Parts` do Blender.
 *
 * O PROBLEMA REAL: STL baixado quase sempre traz várias peças no mesmo arquivo —
 * o corpo, a tampa, os parafusos, todos soltos. Fatiar tudo junto força uma
 * orientação só (ruim para pelo menos uma das peças), imprime as quatro de uma
 * vez mesmo quando você só quer repor a tampa quebrada, e mistura os custos.
 *
 * COMO SE DECIDE O QUE É UMA PEÇA. Duas faces são da mesma peça quando
 * compartilham uma ARESTA. Não vértice: dois cubos que se encostam num canto
 * único são duas peças, e uni-los por causa de um ponto seria errado.
 *
 * O PASSO QUE NÃO PODE FALTAR: SOLDAR OS VÉRTICES ANTES. O STL não tem índice —
 * cada triângulo grava suas três coordenadas por extenso, então o mesmo vértice
 * aparece repetido em cada face que o toca. Sem soldar, NENHUMA face compartilha
 * aresta com outra e o resultado seria uma "peça" por triângulo.
 *
 * A TOLERÂNCIA DA SOLDA é o número delicado, e por isso está medida e travada em
 * teste: apertada demais parte uma peça inteira em cacos (float de exportador
 * diferente nunca bate bit a bit); frouxa demais funde duas peças que só passam
 * perto uma da outra.
 *
 * Escrito do zero. Nada vem de Blender, Meshmixer ou qualquer base GPL.
 */

import { boundsOf, signedMeshVolume, type StlBoundingBox } from "./stl";

/**
 * Tolerância da solda, em mm.
 *
 * 1e-4 mm = 0,1 µm. Está três ordens de grandeza abaixo do que qualquer
 * impressora FDM resolve (o bico é 0,4 mm), então nunca funde geometria que o
 * usuário considere separada — e está bem acima do erro de arredondamento de
 * `float32`, que é o que separaria a mesma peça em cacos.
 *
 * É o MESMO valor do `WELD_EPS` do fatiador (`lib/slicer/slice.ts`), de
 * propósito: as duas etapas têm de concordar sobre o que é o mesmo ponto.
 */
export const SPLIT_WELD_EPS = 1e-4;

export interface MeshPart {
  /** Triângulos desta parte, no mesmo formato do STL: 9 floats por face. */
  positions: Float32Array;
  triangles: number;
  boundingBox: StlBoundingBox;
  /** Volume aproximado, em mm³. Serve para ordenar e para descartar caco. */
  volumeMm3: number;
}

export interface SplitOptions {
  /**
   * Descarta parte com menos triângulos que isto.
   *
   * Malha suja traz face solta e triângulo degenerado que viram "peças" de um
   * triângulo. Elas poluem a lista sem representar nada imprimível.
   */
  minTriangles?: number;
}

/** Chave de célula do vértice. Quantizar é o que faz a solda ser O(n). */
function vertexKey(positions: Float32Array, at: number): string {
  const q = (v: number) => Math.round(v / SPLIT_WELD_EPS);
  return `${q(positions[at]!)},${q(positions[at + 1]!)},${q(positions[at + 2]!)}`;
}

/**
 * Union-find com compressão de caminho e união por posto.
 *
 * A alternativa (busca em largura sobre lista de adjacência) precisaria montar a
 * lista inteira antes de começar. Aqui a união acontece enquanto as arestas são
 * lidas, num passe só.
 */
class UnionFind {
  private readonly parent: Int32Array;
  private readonly rank: Uint8Array;

  constructor(size: number) {
    this.parent = new Int32Array(size);
    for (let i = 0; i < size; i++) this.parent[i] = i;
    this.rank = new Uint8Array(size);
  }

  find(x: number): number {
    let raiz = x;
    while (this.parent[raiz] !== raiz) raiz = this.parent[raiz]!;
    // Compressão: a segunda passada aponta todo mundo direto para a raiz.
    let atual = x;
    while (this.parent[atual] !== raiz) {
      const proximo = this.parent[atual]!;
      this.parent[atual] = raiz;
      atual = proximo;
    }
    return raiz;
  }

  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    const pa = this.rank[ra]!;
    const pb = this.rank[rb]!;
    if (pa < pb) this.parent[ra] = rb;
    else if (pa > pb) this.parent[rb] = ra;
    else {
      this.parent[rb] = ra;
      this.rank[ra] = pa + 1;
    }
  }
}

/**
 * Separa a malha em componentes conexos por aresta.
 *
 * Devolve as partes ordenadas da MAIOR para a menor em volume — o corpo
 * principal primeiro, os parafusos depois, que é a ordem em que se quer ver.
 *
 * Malha de uma peça só devolve uma parte. Isso NÃO é caso degenerado: é a
 * resposta certa, e é o que impede a tela de oferecer "separar" onde não há o
 * que separar.
 */
export function splitLooseParts(
  positions: Float32Array,
  options: SplitOptions = {},
): MeshPart[] {
  const grupos = agruparFaces(positions, Math.max(1, options.minTriangles ?? 1));

  const partes: MeshPart[] = grupos.map((listaDeFaces) => {
    const saida = new Float32Array(listaDeFaces.length * 9);
    listaDeFaces.forEach((f, i) => {
      saida.set(positions.subarray(f * 9, f * 9 + 9), i * 9);
    });

    return {
      positions: saida,
      triangles: listaDeFaces.length,
      boundingBox: boundsOf(saida),
      volumeMm3: signedMeshVolume(saida),
    };
  });

  // Maior primeiro. Empate resolvido pela contagem de triângulos para a ordem
  // ser estável — duas peças idênticas não podem trocar de lugar entre execuções.
  partes.sort((a, b) => b.volumeMm3 - a.volumeMm3 || b.triangles - a.triangles);
  return partes;
}

/**
 * Quantas partes soltas existem, SEM montar as malhas.
 *
 * A tela usa isto para decidir se mostra o botão "Separar partes": alocar N
 * `Float32Array` só para descobrir que a resposta é 1 é desperdício em peça de
 * 400 mil triângulos.
 */
export function countLooseParts(positions: Float32Array, options: SplitOptions = {}): number {
  return agruparFaces(positions, Math.max(1, options.minTriangles ?? 1)).length;
}

/** O trabalho de verdade: solda, une por aresta e devolve as faces de cada peça. */
function agruparFaces(positions: Float32Array, minTriangles: number): number[][] {
  const faces = Math.floor(positions.length / 9);
  if (faces === 0) return [];

  // ── 1. Soldar vértices ────────────────────────────────────────────────────
  // Cada posição vira um id de vértice ÚNICO por coordenada quantizada.
  const idPorChave = new Map<string, number>();
  const vertexId = new Int32Array(faces * 3);

  for (let f = 0; f < faces; f++) {
    for (let k = 0; k < 3; k++) {
      const chave = vertexKey(positions, f * 9 + k * 3);
      let id = idPorChave.get(chave);
      if (id === undefined) {
        id = idPorChave.size;
        idPorChave.set(chave, id);
      }
      vertexId[f * 3 + k] = id;
    }
  }

  // ── 2. Unir faces que compartilham ARESTA ─────────────────────────────────
  // A chave da aresta é o par de vértices ORDENADO: a mesma aresta aparece com
  // sentidos opostos nas duas faces vizinhas (é assim que a orientação fecha), e
  // sem ordenar elas não se encontrariam.
  const uf = new UnionFind(faces);
  const primeiraFaceDaAresta = new Map<string, number>();

  for (let f = 0; f < faces; f++) {
    for (let k = 0; k < 3; k++) {
      const a = vertexId[f * 3 + k]!;
      const b = vertexId[f * 3 + ((k + 1) % 3)]!;
      if (a === b) continue; // aresta degenerada: os dois cantos soldaram no mesmo ponto
      const chave = a < b ? `${a}_${b}` : `${b}_${a}`;
      const anterior = primeiraFaceDaAresta.get(chave);
      if (anterior === undefined) primeiraFaceDaAresta.set(chave, f);
      else uf.union(anterior, f);
    }
  }

  // ── 3. Agrupar as faces por raiz ──────────────────────────────────────────
  const porRaiz = new Map<number, number[]>();
  for (let f = 0; f < faces; f++) {
    const raiz = uf.find(f);
    const lista = porRaiz.get(raiz);
    if (lista) lista.push(f);
    else porRaiz.set(raiz, [f]);
  }

  return [...porRaiz.values()].filter((l) => l.length >= minTriangles);
}
