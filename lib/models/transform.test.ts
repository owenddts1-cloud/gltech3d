import { describe, expect, it } from "vitest";

import {
  applyTransform,
  describeTransform,
  determinant,
  IDENTITY_TRANSFORM,
  isIdentityTransform,
  transformMatrix,
  type Transform,
} from "./transform";
import { boundsOf, parseStlBuffer, signedMeshVolume, writeBinaryStl } from "./stl";

function box(sx: number, sy: number, sz: number, at = 0): Float32Array {
  const v: Array<[number, number, number]> = [
    [at, at, at], [at + sx, at, at], [at + sx, at + sy, at], [at, at + sy, at],
    [at, at, at + sz], [at + sx, at, at + sz], [at + sx, at + sy, at + sz], [at, at + sy, at + sz],
  ];
  const quads: Array<[number, number, number, number]> = [
    [0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
  ];
  const out: number[] = [];
  for (const [a, b, c, d] of quads) out.push(...v[a]!, ...v[b]!, ...v[c]!, ...v[a]!, ...v[c]!, ...v[d]!);
  return new Float32Array(out);
}

const size = (p: Float32Array) => {
  const b = boundsOf(p);
  return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]] as const;
};

/** Volume COM sinal — `signedMeshVolume` tira o módulo e esconde a inversão. */
function rawSignedVolume(p: Float32Array): number {
  let v = 0;
  for (let i = 0; i + 8 < p.length; i += 9) {
    const [ax, ay, az] = [p[i]!, p[i + 1]!, p[i + 2]!];
    const [bx, by, bz] = [p[i + 3]!, p[i + 4]!, p[i + 5]!];
    const [cx, cy, cz] = [p[i + 6]!, p[i + 7]!, p[i + 8]!];
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return v;
}

const t = (over: Partial<Transform>): Transform => ({ ...IDENTITY_TRANSFORM, ...over });

describe("transformMatrix", () => {
  it("identidade quando nada muda", () => {
    const m = transformMatrix(IDENTITY_TRANSFORM);
    expect(m[0]![0]).toBeCloseTo(1, 9);
    expect(m[1]![1]).toBeCloseTo(1, 9);
    expect(m[2]![2]).toBeCloseTo(1, 9);
    expect(determinant(m)).toBeCloseTo(1, 9);
  });

  it("determinante = produto das escalas", () => {
    expect(determinant(transformMatrix(t({ scale: { x: 2, y: 3, z: 4 } })))).toBeCloseTo(24, 6);
  });

  it("rotação pura preserva o determinante", () => {
    expect(determinant(transformMatrix(t({ rotationDeg: { x: 30, y: 45, z: 60 } })))).toBeCloseTo(1, 6);
  });

  it("escala negativa deixa o determinante NEGATIVO — é o sinal de espelho", () => {
    expect(determinant(transformMatrix(t({ scale: { x: -1, y: 1, z: 1 } })))).toBeLessThan(0);
  });
});

describe("applyTransform — escala", () => {
  it("dobra o tamanho", () => {
    const [x, y, z] = size(applyTransform(box(10, 20, 30), t({ scale: { x: 2, y: 2, z: 2 } })));
    expect(x).toBeCloseTo(20, 3);
    expect(y).toBeCloseTo(40, 3);
    expect(z).toBeCloseTo(60, 3);
  });

  it("ESCALA NÃO MOVE A PEÇA: o centro fica onde estava", () => {
    // A armadilha. Escalando em torno da origem, uma peça a 500 mm do zero
    // saltaria para 1000 mm — "o dobro do tamanho E do outro lado da mesa".
    const original = box(10, 10, 10, 500);
    const antes = boundsOf(original);
    const depois = boundsOf(applyTransform(original, t({ scale: { x: 2, y: 2, z: 2 } })));
    const centro = (b: ReturnType<typeof boundsOf>) => (b.min[0] + b.max[0]) / 2;
    expect(centro(depois)).toBeCloseTo(centro(antes), 3);
  });

  it("escala por eixo funciona independente", () => {
    const [x, y, z] = size(applyTransform(box(10, 10, 10), t({ scale: { x: 3, y: 1, z: 0.5 } })));
    expect(x).toBeCloseTo(30, 3);
    expect(y).toBeCloseTo(10, 3);
    expect(z).toBeCloseTo(5, 3);
  });

  it("o volume escala pelo produto dos fatores", () => {
    const original = box(10, 10, 10);
    const escalado = applyTransform(original, t({ scale: { x: 2, y: 3, z: 4 } }));
    expect(signedMeshVolume(escalado)).toBeCloseTo(signedMeshVolume(original) * 24, 1);
  });
});

describe("applyTransform — espelho", () => {
  it("ESPELHO NÃO INVERTE A MALHA: o sinal do volume se mantém", () => {
    // Sem a troca de vértices, a peça sai com o dentro para fora — o fatiador lê
    // o material invertido e o resultado é lixo, sem erro nenhum no caminho.
    const original = box(10, 10, 10);
    const espelhado = applyTransform(original, t({ scale: { x: -1, y: 1, z: 1 } }));
    expect(Math.sign(rawSignedVolume(espelhado))).toBe(Math.sign(rawSignedVolume(original)));
  });

  it("espelho preserva o tamanho", () => {
    const [x, y, z] = size(applyTransform(box(10, 20, 30), t({ scale: { x: -1, y: 1, z: 1 } })));
    expect(x).toBeCloseTo(10, 3);
    expect(y).toBeCloseTo(20, 3);
    expect(z).toBeCloseTo(30, 3);
  });

  it("espelho em três eixos também é espelho e é corrigido", () => {
    const original = box(10, 10, 10);
    const espelhado = applyTransform(original, t({ scale: { x: -1, y: -1, z: -1 } }));
    expect(Math.sign(rawSignedVolume(espelhado))).toBe(Math.sign(rawSignedVolume(original)));
  });

  it("espelho em DOIS eixos é rotação, não espelho — não inverte nada", () => {
    const original = box(10, 10, 10);
    const girado = applyTransform(original, t({ scale: { x: -1, y: -1, z: 1 } }));
    expect(determinant(transformMatrix(t({ scale: { x: -1, y: -1, z: 1 } })))).toBeGreaterThan(0);
    expect(Math.sign(rawSignedVolume(girado))).toBe(Math.sign(rawSignedVolume(original)));
  });
});

describe("applyTransform — rotação e translação", () => {
  it("90° em Z troca X por Y", () => {
    const [x, y] = size(applyTransform(box(10, 30, 5), t({ rotationDeg: { x: 0, y: 0, z: 90 } })));
    expect(x).toBeCloseTo(30, 3);
    expect(y).toBeCloseTo(10, 3);
  });

  it("360° volta ao mesmo lugar", () => {
    const original = box(10, 20, 30);
    const voltou = applyTransform(original, t({ rotationDeg: { x: 360, y: 0, z: 0 } }));
    const a = boundsOf(original);
    const b = boundsOf(voltou);
    expect(b.min[0]).toBeCloseTo(a.min[0], 3);
    expect(b.max[2]).toBeCloseTo(a.max[2], 3);
  });

  it("rotação preserva o volume", () => {
    const original = box(10, 20, 30);
    const girado = applyTransform(original, t({ rotationDeg: { x: 17, y: 33, z: 51 } }));
    expect(signedMeshVolume(girado)).toBeCloseTo(signedMeshVolume(original), 0);
  });

  it("translação move sem deformar", () => {
    const original = box(10, 10, 10);
    const movido = applyTransform(original, t({ translationMm: { x: 25, y: -5, z: 3 } }));
    expect(boundsOf(movido).min[0]).toBeCloseTo(boundsOf(original).min[0] + 25, 3);
    expect(size(movido)).toEqual(size(original));
  });

  it("identidade devolve a mesma geometria", () => {
    const original = box(10, 20, 30);
    expect(Array.from(applyTransform(original, IDENTITY_TRANSFORM))).toEqual(Array.from(original));
  });

  it("nunca gera NaN", () => {
    const out = applyTransform(box(10, 10, 10), t({
      rotationDeg: { x: 12, y: -45, z: 200 },
      scale: { x: -2, y: 0.5, z: 3 },
      translationMm: { x: 10, y: 10, z: 10 },
    }));
    for (const v of out) expect(Number.isFinite(v)).toBe(true);
  });

  it("malha vazia não quebra", () => {
    expect(applyTransform(new Float32Array([]), t({ scale: { x: 2, y: 2, z: 2 } })).length).toBe(0);
  });
});

describe("isIdentityTransform", () => {
  it("reconhece a identidade e qualquer desvio", () => {
    expect(isIdentityTransform(IDENTITY_TRANSFORM)).toBe(true);
    expect(isIdentityTransform(t({ scale: { x: 1.0001, y: 1, z: 1 } }))).toBe(false);
    expect(isIdentityTransform(t({ rotationDeg: { x: 0, y: 0, z: 0.001 } }))).toBe(false);
    expect(isIdentityTransform(t({ translationMm: { x: 0.001, y: 0, z: 0 } }))).toBe(false);
  });
});

describe("describeTransform", () => {
  it("descreve o que mudou", () => {
    expect(describeTransform(IDENTITY_TRANSFORM)).toBe("sem alteração");
    expect(describeTransform(t({ scale: { x: 2, y: 2, z: 2 } }))).toContain("200%");
    expect(describeTransform(t({ rotationDeg: { x: 0, y: 0, z: 90 } }))).toContain("90° Z");
    expect(describeTransform(t({ scale: { x: -1, y: 1, z: 1 } }))).toContain("espelhou");
    expect(describeTransform(t({ translationMm: { x: 10, y: 0, z: 0 } }))).toContain("moveu");
  });
});

describe("writeBinaryStl", () => {
  it("ida e volta preserva os triângulos", () => {
    const original = box(10, 20, 30);
    const back = parseStlBuffer(writeBinaryStl(original));
    expect(back.numTriangles).toBe(original.length / 9);
    expect(back.format).toBe("binary");
    for (let i = 0; i < original.length; i++) {
      expect(back.positions[i]).toBeCloseTo(original[i]!, 3);
    }
  });

  it("o tamanho do arquivo bate com a fórmula 84 + n×50", () => {
    const original = box(10, 10, 10);
    expect(writeBinaryStl(original).byteLength).toBe(84 + (original.length / 9) * 50);
  });

  it("RECALCULA a normal em vez de herdar", () => {
    // Depois de espelhar, uma normal herdada apontaria para dentro.
    const espelhado = applyTransform(box(10, 10, 10), t({ scale: { x: -1, y: 1, z: 1 } }));
    const back = parseStlBuffer(writeBinaryStl(espelhado));
    for (let i = 0; i < back.normals.length; i += 3) {
      const len = Math.hypot(back.normals[i]!, back.normals[i + 1]!, back.normals[i + 2]!);
      expect(len).toBeCloseTo(1, 4);
    }
  });

  it("malha vazia gera um STL válido de zero triângulos", () => {
    const buffer = writeBinaryStl(new Float32Array([]));
    expect(buffer.byteLength).toBe(84);
    expect(new DataView(buffer).getUint32(80, true)).toBe(0);
  });

  it("cabeçalho longo demais é cortado, não estoura o arquivo", () => {
    const buffer = writeBinaryStl(box(1, 1, 1), "x".repeat(500));
    expect(buffer.byteLength).toBe(84 + 12 * 50);
    expect(new Uint8Array(buffer)[79]).toBe(0); // último byte do cabeçalho fica zero
  });
});
