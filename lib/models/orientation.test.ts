import { describe, expect, it } from "vitest";

import {
  applyMat3,
  applyOrientation,
  bestOrientation,
  candidateDirections,
  facesOf,
  IDENTITY,
  rotationToAlignDown,
  scoreOrientation,
  type Vec3,
} from "./orientation";

/** Caixa fechada, dois triângulos por lado. */
function box(sx: number, sy: number, sz: number): Float32Array {
  const v: Array<[number, number, number]> = [
    [0, 0, 0], [sx, 0, 0], [sx, sy, 0], [0, sy, 0],
    [0, 0, sz], [sx, 0, sz], [sx, sy, sz], [0, sy, sz],
  ];
  const quads: Array<[number, number, number, number]> = [
    [0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
  ];
  const out: number[] = [];
  for (const [a, b, c, d] of quads) out.push(...v[a]!, ...v[b]!, ...v[c]!, ...v[a]!, ...v[c]!, ...v[d]!);
  return new Float32Array(out);
}

/** Cone com a ponta em +Z: base apoiada não precisa de suporte nenhum. */
function cone(radius: number, height: number, segments = 48): Float32Array {
  const out: number[] = [];
  const apex: [number, number, number] = [0, 0, height];
  for (let i = 0; i < segments; i++) {
    const t0 = (i / segments) * Math.PI * 2;
    const t1 = ((i + 1) / segments) * Math.PI * 2;
    const a: [number, number, number] = [Math.cos(t0) * radius, Math.sin(t0) * radius, 0];
    const b: [number, number, number] = [Math.cos(t1) * radius, Math.sin(t1) * radius, 0];
    out.push(...a, ...b, ...apex); // lateral
    out.push(...b, ...a, 0, 0, 0); // base (sentido oposto, normal para baixo)
  }
  return new Float32Array(out);
}

const volumeOf = (positions: Float32Array): number => {
  let total = 0;
  for (let i = 0; i + 8 < positions.length; i += 9) {
    const [ax, ay, az] = [positions[i]!, positions[i + 1]!, positions[i + 2]!];
    const [bx, by, bz] = [positions[i + 3]!, positions[i + 4]!, positions[i + 5]!];
    const [cx, cy, cz] = [positions[i + 6]!, positions[i + 7]!, positions[i + 8]!];
    total += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return Math.abs(total);
};

const boundsOf = (p: Float32Array) => {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i + 2 < p.length; i += 3) {
    minX = Math.min(minX, p[i]!); maxX = Math.max(maxX, p[i]!);
    minY = Math.min(minY, p[i + 1]!); maxY = Math.max(maxY, p[i + 1]!);
    minZ = Math.min(minZ, p[i + 2]!); maxZ = Math.max(maxZ, p[i + 2]!);
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
};

describe("rotationToAlignDown", () => {
  const DOWN: Vec3 = { x: 0, y: 0, z: -1 };

  it("já apontando para baixo devolve identidade", () => {
    expect(rotationToAlignDown(DOWN)).toEqual(IDENTITY);
  });

  it("leva qualquer direção para −Z", () => {
    const dirs: Vec3[] = [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 1, z: 1 },
      { x: -0.3, y: 0.8, z: -0.5 },
    ];
    for (const d of dirs) {
      const len = Math.hypot(d.x, d.y, d.z);
      const unit = { x: d.x / len, y: d.y / len, z: d.z / len };
      const r = applyMat3(rotationToAlignDown(d), unit);
      expect(r.x).toBeCloseTo(0, 6);
      expect(r.y).toBeCloseTo(0, 6);
      expect(r.z).toBeCloseTo(-1, 6);
    }
  });

  it("o caso antiparalelo (+Z) não vira NaN", () => {
    // Sem tratamento explícito o eixo de rotação sai nulo e a matriz inteira
    // vira NaN — que não estoura, só produz peça vazia lá na frente.
    const r = applyMat3(rotationToAlignDown({ x: 0, y: 0, z: 1 }), { x: 0, y: 0, z: 1 });
    expect(Number.isNaN(r.x)).toBe(false);
    expect(r.z).toBeCloseTo(-1, 6);
  });

  it("preserva comprimento — é rotação, não escala", () => {
    const m = rotationToAlignDown({ x: 2, y: -3, z: 1 });
    const v = { x: 3, y: 4, z: 12 }; // comprimento 13
    const r = applyMat3(m, v);
    expect(Math.hypot(r.x, r.y, r.z)).toBeCloseTo(13, 6);
  });
});

describe("facesOf", () => {
  it("uma caixa de 6 lados dá 12 triângulos", () => {
    expect(facesOf(box(10, 10, 10))).toHaveLength(12);
  });

  it("área total da caixa bate com a fórmula", () => {
    const total = facesOf(box(10, 20, 30)).reduce((s, f) => s + f.area, 0);
    expect(total).toBeCloseTo(2 * (10 * 20 + 10 * 30 + 20 * 30), 3);
  });

  it("descarta triângulo degenerado em vez de gerar normal NaN", () => {
    const degenerate = new Float32Array([0, 0, 0, 1, 1, 1, 2, 2, 2]);
    expect(facesOf(degenerate)).toHaveLength(0);
  });

  it("normais são unitárias", () => {
    for (const f of facesOf(cone(10, 20))) {
      expect(Math.hypot(f.normal.x, f.normal.y, f.normal.z)).toBeCloseTo(1, 5);
    }
  });
});

describe("candidateDirections", () => {
  it("inclui sempre os 6 eixos", () => {
    const dirs = candidateDirections(facesOf(cone(10, 20)));
    for (const axis of [
      { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 },
      { x: 0, y: -1, z: 0 }, { x: 0, y: 1, z: 0 },
      { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    ]) {
      expect(dirs.some((d) => Math.abs(d.x - axis.x) < 1e-9 && Math.abs(d.z - axis.z) < 1e-9)).toBe(
        true,
      );
    }
  });

  it("agrupa as centenas de faces do cone em poucas direções", () => {
    // Sem agrupamento seriam ~96 candidatos, quase todos equivalentes.
    const dirs = candidateDirections(facesOf(cone(10, 20, 96)));
    expect(dirs.length).toBeLessThan(70);
  });

  it("respeita o teto de candidatos", () => {
    expect(candidateDirections(facesOf(cone(10, 20, 200)), 4).length).toBeLessThanOrEqual(10);
  });
});

describe("scoreOrientation", () => {
  const CONE = cone(10, 20);
  const coneFaces = facesOf(CONE);

  it("cone com a base para baixo não pede suporte", () => {
    const s = scoreOrientation(coneFaces, CONE, { x: 0, y: 0, z: -1 });
    expect(s.supportCm3).toBeCloseTo(0, 6);
    expect(s.bedContactMm2).toBeGreaterThan(300); // π·10² ≈ 314
  });

  it("cone ÍNGREME invertido não pede suporte — e isso é correto", () => {
    // Raio 10, altura 20: a parede está a atan(10/20) = 26,6° da vertical,
    // dentro dos 45°. Invertido, aquilo imprime sem apoio nenhum. Confundir
    // "de cabeça para baixo" com "precisa de suporte" foi o erro da primeira
    // versão deste teste.
    const s = scoreOrientation(coneFaces, CONE, { x: 0, y: 0, z: 1 });
    expect(s.supportCm3).toBeCloseTo(0, 6);
    expect(s.bedContactMm2).toBeLessThan(1); // mas não apoia em nada
  });

  it("cone RASO invertido pede suporte", () => {
    // Raio 20, altura 10: parede a atan(20/10) = 63,4° da vertical. Passa dos
    // 45° e precisa de apoio.
    const RASO = cone(20, 10);
    const raso = facesOf(RASO);
    const s = scoreOrientation(raso, RASO, { x: 0, y: 0, z: 1 });
    expect(s.supportCm3).toBeGreaterThan(1);
    expect(s.bedContactMm2).toBeLessThan(1);
  });

  it("o limite de balanço muda o veredito, como tem que mudar", () => {
    const RASO = cone(20, 10);
    const raso = facesOf(RASO);
    const opts = { bedWeight: 0.5, heightWeight: 0.2 };
    const a45 = scoreOrientation(raso, RASO, { x: 0, y: 0, z: 1 }, { ...opts, maxOverhangDeg: 45 });
    const a70 = scoreOrientation(raso, RASO, { x: 0, y: 0, z: 1 }, { ...opts, maxOverhangDeg: 70 });
    expect(a45.supportCm3).toBeGreaterThan(0);
    expect(a70.supportCm3).toBeCloseTo(0, 6); // 63,4° < 70°: passa a imprimir
  });

  it("de cabeça para baixo é PIOR que apoiado — é a comparação que importa", () => {
    const apoiado = scoreOrientation(coneFaces, CONE, { x: 0, y: 0, z: -1 });
    const invertido = scoreOrientation(coneFaces, CONE, { x: 0, y: 0, z: 1 });
    expect(invertido.score).toBeGreaterThan(apoiado.score);
  });

  it("a altura muda com a orientação de uma caixa alongada", () => {
    const BOX = box(10, 10, 60);
    const faces = facesOf(BOX);
    const deitada = scoreOrientation(faces, BOX, { x: 1, y: 0, z: 0 });
    const empe = scoreOrientation(faces, BOX, { x: 0, y: 0, z: -1 });
    expect(empe.heightMm).toBeCloseTo(60, 3);
    expect(deitada.heightMm).toBeCloseTo(10, 3);
  });

  it("não quebra com malha vazia", () => {
    const s = scoreOrientation([], new Float32Array([]), { x: 0, y: 0, z: -1 });
    expect(s.score).toBe(0);
  });
});

describe("bestOrientation", () => {
  it("cone: escolhe a base para baixo", () => {
    const r = bestOrientation(cone(10, 20));
    expect(r.best.supportCm3).toBeCloseTo(0, 4);
    expect(r.best.bedContactMm2).toBeGreaterThan(300);
  });

  it("cone já apoiado: não recomenda girar", () => {
    expect(bestOrientation(cone(10, 20)).rotation).toEqual(IDENTITY);
  });

  it("caixa alongada em pé: recomenda deitar", () => {
    const r = bestOrientation(box(10, 10, 60));
    expect(r.best.heightMm).toBeLessThan(r.current.heightMm);
    expect(r.rotation).not.toEqual(IDENTITY);
  });

  it("cubo: nada a ganhar, mantém como está", () => {
    expect(bestOrientation(box(20, 20, 20)).rotation).toEqual(IDENTITY);
  });

  it("a melhor nunca é pior que a atual", () => {
    for (const mesh of [cone(10, 20), box(10, 10, 60), box(20, 20, 20), box(5, 40, 8)]) {
      const r = bestOrientation(mesh);
      expect(r.best.score).toBeLessThanOrEqual(r.current.score + 1e-9);
    }
  });

  it("devolve alternativas ordenadas da melhor para a pior", () => {
    const r = bestOrientation(box(5, 40, 8));
    expect(r.ranked.length).toBeGreaterThan(1);
    for (let i = 1; i < r.ranked.length; i++) {
      expect(r.ranked[i]!.score).toBeGreaterThanOrEqual(r.ranked[i - 1]!.score);
    }
  });

  it("malha vazia não quebra", () => {
    const r = bestOrientation(new Float32Array([]));
    expect(r.rotation).toEqual(IDENTITY);
  });
});

describe("applyOrientation", () => {
  it("assenta a peça na mesa: minZ vira 0", () => {
    const rotated = applyOrientation(box(10, 10, 60), rotationToAlignDown({ x: 1, y: 0, z: 0 }));
    expect(boundsOf(rotated).minZ).toBeCloseTo(0, 5);
  });

  it("centra em XY — girar em torno da origem joga a peça para longe", () => {
    const b = boundsOf(applyOrientation(box(10, 20, 30), rotationToAlignDown({ x: 0, y: 1, z: 0 })));
    expect((b.minX + b.maxX) / 2).toBeCloseTo(0, 5);
    expect((b.minY + b.maxY) / 2).toBeCloseTo(0, 5);
  });

  it("preserva o volume — é rotação rígida, não deformação", () => {
    const original = box(10, 20, 30);
    const rotated = applyOrientation(original, rotationToAlignDown({ x: 1, y: 1, z: 1 }));
    expect(volumeOf(rotated)).toBeCloseTo(volumeOf(original), 2);
  });

  it("preserva a contagem de vértices", () => {
    const original = cone(10, 20);
    expect(applyOrientation(original, IDENTITY).length).toBe(original.length);
  });

  it("com identidade só assenta, sem girar", () => {
    const b = boundsOf(applyOrientation(box(10, 10, 60), IDENTITY));
    expect(b.maxZ - b.minZ).toBeCloseTo(60, 4);
    expect(b.minZ).toBeCloseTo(0, 5);
  });

  it("não gera NaN", () => {
    const rotated = applyOrientation(cone(10, 20), rotationToAlignDown({ x: 0, y: 0, z: 1 }));
    for (const value of rotated) expect(Number.isFinite(value)).toBe(true);
  });
});
