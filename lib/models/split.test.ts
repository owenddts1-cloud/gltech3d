/**
 * Separar em partes soltas.
 *
 * Os dois erros que importam são opostos e igualmente caros: partir uma peça
 * inteira em cacos (tolerância apertada demais) e fundir duas peças que só se
 * encostam (frouxa demais). Os dois só apareceriam depois, com o arquivo já
 * salvo errado no catálogo.
 */

import { describe, expect, it } from "vitest";

import { countLooseParts, splitLooseParts, SPLIT_WELD_EPS } from "./split";
import { signedMeshVolume } from "./stl";

/**
 * Cubo fechado de 12 triângulos, com aresta `lado`, deslocado por `off`.
 *
 * Escrito por extenso como o STL faz: cada face repete suas coordenadas, sem
 * índice. É exatamente a forma que obriga a solda a existir.
 */
function cubo(lado: number, off: [number, number, number] = [0, 0, 0]): Float32Array {
  const [ox, oy, oz] = off;
  const v = (i: number): [number, number, number] => [
    ox + (i & 1 ? lado : 0),
    oy + (i & 2 ? lado : 0),
    oz + (i & 4 ? lado : 0),
  ];
  // Duas faces por lado do cubo, em ordem consistente.
  const quads: Array<[number, number, number, number]> = [
    [0, 2, 3, 1], // z-
    [4, 5, 7, 6], // z+
    [0, 1, 5, 4], // y-
    [2, 6, 7, 3], // y+
    [0, 4, 6, 2], // x-
    [1, 3, 7, 5], // x+
  ];
  const out: number[] = [];
  for (const [a, b, c, d] of quads) {
    out.push(...v(a), ...v(b), ...v(c));
    out.push(...v(a), ...v(c), ...v(d));
  }
  return new Float32Array(out);
}

function juntar(...malhas: Float32Array[]): Float32Array {
  const total = malhas.reduce((n, m) => n + m.length, 0);
  const out = new Float32Array(total);
  let at = 0;
  for (const m of malhas) {
    out.set(m, at);
    at += m.length;
  }
  return out;
}

describe("splitLooseParts", () => {
  it("peça ÚNICA devolve exatamente 1 parte", () => {
    // Não é caso degenerado: é a resposta certa, e é o que impede a tela de
    // oferecer "separar" onde não há o que separar.
    const partes = splitLooseParts(cubo(10));
    expect(partes).toHaveLength(1);
    expect(partes[0]!.triangles).toBe(12);
  });

  it("dois cubos afastados devolvem 2 partes", () => {
    const partes = splitLooseParts(juntar(cubo(10), cubo(10, [50, 0, 0])));
    expect(partes).toHaveLength(2);
  });

  it("nenhum triângulo é perdido nem duplicado", () => {
    // O erro silencioso: uma face cair fora de todas as partes. A peça sairia
    // com um furo que só aparece na impressão.
    const original = juntar(cubo(10), cubo(6, [40, 0, 0]), cubo(3, [0, 40, 0]));
    const partes = splitLooseParts(original);
    const soma = partes.reduce((n, p) => n + p.triangles, 0);
    expect(soma).toBe(original.length / 9);
  });

  it("cubos que se tocam só num VÉRTICE continuam sendo 2 peças", () => {
    // Compartilhar ponto não é compartilhar aresta. Uni-los faria duas peças
    // viáveis virarem uma que não se sustenta.
    const partes = splitLooseParts(juntar(cubo(10), cubo(10, [10, 10, 10])));
    expect(partes).toHaveLength(2);
  });

  it("cubos que compartilham uma FACE inteira são uma peça só", () => {
    // Encostados face a face, o material é contínuo: é uma peça.
    const partes = splitLooseParts(juntar(cubo(10), cubo(10, [10, 0, 0])));
    expect(partes).toHaveLength(1);
  });

  it("vem ordenado da MAIOR para a menor", () => {
    const partes = splitLooseParts(juntar(cubo(4, [40, 0, 0]), cubo(20), cubo(8, [0, 40, 0])));
    expect(partes.map((p) => Math.round(Math.cbrt(p.volumeMm3)))).toEqual([20, 8, 4]);
  });

  it("o volume de cada parte bate com o volume da peça sozinha", () => {
    const [maior, menor] = splitLooseParts(juntar(cubo(10), cubo(5, [40, 0, 0])));
    expect(maior!.volumeMm3).toBeCloseTo(signedMeshVolume(cubo(10)), 3);
    expect(menor!.volumeMm3).toBeCloseTo(signedMeshVolume(cubo(5)), 3);
  });

  it("a caixa de cada parte é a da peça, não a do arquivo inteiro", () => {
    // Se fosse a do arquivo, a tela mostraria "não cabe na mesa" para um
    // parafuso de 5 mm.
    const partes = splitLooseParts(juntar(cubo(10), cubo(5, [200, 0, 0])));
    const pequena = partes[1]!;
    expect(pequena.boundingBox.min[0]).toBeCloseTo(200, 3);
    expect(pequena.boundingBox.max[0]).toBeCloseTo(205, 3);
  });

  it("malha vazia devolve lista vazia em vez de quebrar", () => {
    expect(splitLooseParts(new Float32Array(0))).toEqual([]);
  });

  it("minTriangles descarta caco de malha suja", () => {
    // Um triângulo solto no arquivo não é uma peça imprimível.
    const sujeira = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const comSujeira = juntar(cubo(10), sujeira);
    expect(splitLooseParts(comSujeira)).toHaveLength(2);
    expect(splitLooseParts(comSujeira, { minTriangles: 4 })).toHaveLength(1);
  });
});

describe("a tolerância da solda — o número delicado", () => {
  it("ruído ABAIXO da tolerância não parte a peça em cacos", () => {
    // Exportadores gravam o mesmo vértice com bits diferentes em cada face.
    // Sem a solda tolerante, cada triângulo viraria uma "peça".
    const m = cubo(10);
    const ruidoso = Float32Array.from(m, (v, i) =>
      v + (i % 3 === 0 ? SPLIT_WELD_EPS / 10 : -SPLIT_WELD_EPS / 10),
    );
    expect(splitLooseParts(ruidoso)).toHaveLength(1);
  });

  it("peças separadas por MENOS que o bico continuam separadas", () => {
    // 0,05 mm é oito vezes menor que o bico — nem seria impresso como vão. Mas
    // é geometria distinta, e fundir as duas seria decidir pelo usuário.
    const partes = splitLooseParts(juntar(cubo(10), cubo(10, [10.05, 0, 0])));
    expect(partes).toHaveLength(2);
  });
});

describe("countLooseParts", () => {
  it("concorda com splitLooseParts", () => {
    const m = juntar(cubo(10), cubo(6, [40, 0, 0]), cubo(3, [0, 40, 0]));
    expect(countLooseParts(m)).toBe(splitLooseParts(m).length);
  });

  it("respeita minTriangles", () => {
    const m = juntar(cubo(10), new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]));
    expect(countLooseParts(m, { minTriangles: 4 })).toBe(1);
  });
});
