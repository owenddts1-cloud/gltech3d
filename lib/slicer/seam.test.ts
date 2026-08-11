import { describe, expect, it } from "vitest";

import {
  rotateToStart,
  scarfPath,
  seamStartIndex,
  sharpestCornerIndex,
  SEAM_MODES,
  type SeamContext,
} from "./seam";
import type { Contour, Point2 } from "./slice";

/** Quadrado 10×10 com o canto (0,0) primeiro, anti-horário. */
const SQUARE: Contour = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

const ctx = (over: Partial<SeamContext> = {}): SeamContext => ({
  cursor: { x: 0, y: 0 },
  anchor: { x: 0, y: 0 },
  layerIndex: 0,
  ...over,
});

const perimeterOf = (contour: Contour): number => {
  let total = 0;
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i]!;
    const b = contour[(i + 1) % contour.length]!;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
};

/** Comprimento × vazão somados: é o "quanto de material" do percurso. */
const depositedOf = (steps: Array<{ point: Point2; flow: number }>, start: Point2): number => {
  let total = 0;
  let cursor = start;
  for (const step of steps) {
    total += Math.hypot(step.point.x - cursor.x, step.point.y - cursor.y) * step.flow;
    cursor = step.point;
  }
  return total;
};

describe("rotateToStart", () => {
  it("roda o contorno para o índice pedido", () => {
    expect(rotateToStart(SQUARE, 2)).toEqual([
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it("é uma permutação: nenhum ponto some nem duplica", () => {
    for (let i = 0; i < SQUARE.length; i++) {
      const rotated = rotateToStart(SQUARE, i);
      expect(rotated).toHaveLength(SQUARE.length);
      expect([...rotated].sort((a, b) => a.x - b.x || a.y - b.y)).toEqual(
        [...SQUARE].sort((a, b) => a.x - b.x || a.y - b.y),
      );
    }
  });

  it("índice 0 devolve o mesmo contorno", () => {
    expect(rotateToStart(SQUARE, 0)).toEqual(SQUARE);
  });

  it("aceita índice fora da faixa, inclusive negativo", () => {
    expect(rotateToStart(SQUARE, 6)).toEqual(rotateToStart(SQUARE, 2));
    expect(rotateToStart(SQUARE, -1)).toEqual(rotateToStart(SQUARE, 3));
  });

  it("não quebra em contorno degenerado", () => {
    expect(rotateToStart([], 3)).toEqual([]);
    expect(rotateToStart([{ x: 1, y: 1 }], 2)).toEqual([{ x: 1, y: 1 }]);
  });
});

describe("sharpestCornerIndex", () => {
  it("nunca escolhe um vértice colinear — ali não há canto para esconder nada", () => {
    // O vértice 1 está no meio de uma aresta reta: cosseno −1, o pior possível.
    const withCollinear: Contour = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(sharpestCornerIndex(withCollinear)).not.toBe(1);
  });

  it("prefere o bico ao canto de 90°", () => {
    // O vértice 2 é uma agulha: as duas arestas saem dele quase na mesma
    // direção (cosseno ≈ 0,8). Os outros são cantos de 90° (cosseno 0).
    const spike: Contour = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 5, y: -3 }, // agulha
      { x: 6, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(sharpestCornerIndex(spike)).toBe(2);
  });

  it("devolve -1 quando não há canto vivo (círculo)", () => {
    const circle: Contour = Array.from({ length: 64 }, (_, i) => {
      const t = (i / 64) * Math.PI * 2;
      return { x: Math.cos(t) * 10, y: Math.sin(t) * 10 };
    });
    expect(sharpestCornerIndex(circle)).toBe(-1);
  });

  it("não quebra com menos de 3 pontos", () => {
    expect(sharpestCornerIndex([{ x: 0, y: 0 }])).toBe(0);
  });
});

describe("seamStartIndex", () => {
  it("`tras` escolhe o vértice de maior Y", () => {
    const index = seamStartIndex(SQUARE, "tras", ctx());
    expect(SQUARE[index]!.y).toBe(10);
  });

  it("`proxima` escolhe o vértice mais perto do bico", () => {
    const index = seamStartIndex(SQUARE, "proxima", ctx({ cursor: { x: 9, y: 9 } }));
    expect(SQUARE[index]).toEqual({ x: 10, y: 10 });
  });

  it("`alinhada` escolhe o vértice mais perto da âncora", () => {
    const index = seamStartIndex(SQUARE, "alinhada", ctx({ anchor: { x: 0, y: 10 } }));
    expect(SQUARE[index]).toEqual({ x: 0, y: 10 });
  });

  it("`alinhada` dá o MESMO ponto em camadas diferentes — é o que faz a linha reta", () => {
    const a = seamStartIndex(SQUARE, "alinhada", ctx({ layerIndex: 0, cursor: { x: 9, y: 9 } }));
    const b = seamStartIndex(SQUARE, "alinhada", ctx({ layerIndex: 7, cursor: { x: 1, y: 0 } }));
    expect(a).toBe(b);
  });

  it("`canto` cai no alinhado quando a peça é redonda", () => {
    const circle: Contour = Array.from({ length: 64 }, (_, i) => {
      const t = (i / 64) * Math.PI * 2;
      return { x: Math.cos(t) * 10, y: Math.sin(t) * 10 };
    });
    const anchor = { x: -10, y: 0 };
    expect(seamStartIndex(circle, "canto", ctx({ anchor }))).toBe(
      seamStartIndex(circle, "alinhada", ctx({ anchor })),
    );
  });

  it("`aleatoria` é determinística: mesma entrada, mesmo resultado", () => {
    const a = seamStartIndex(SQUARE, "aleatoria", ctx({ layerIndex: 5 }));
    const b = seamStartIndex(SQUARE, "aleatoria", ctx({ layerIndex: 5 }));
    expect(a).toBe(b);
  });

  it("`aleatoria` muda entre camadas — é o objetivo", () => {
    const seen = new Set<number>();
    for (let layerIndex = 0; layerIndex < 12; layerIndex++) {
      seen.add(seamStartIndex(SQUARE, "aleatoria", ctx({ layerIndex })));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("todo modo devolve índice válido", () => {
    for (const mode of SEAM_MODES) {
      const index = seamStartIndex(SQUARE, mode.value, ctx());
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(SQUARE.length);
    }
  });
});

describe("scarfPath", () => {
  it("sem cachecol devolve a volta fechada simples", () => {
    const steps = scarfPath(SQUARE, 0);
    expect(steps).toHaveLength(SQUARE.length); // 3 arestas + o fechamento
    expect(steps.every((s) => s.flow === 1)).toBe(true);
    expect(steps.at(-1)!.point).toEqual(SQUARE[0]);
  });

  it("MATERIAL PRESERVADO: com cachecol deposita o mesmo que sem", () => {
    // A invariante que importa. Se a soma das rampas não der 1, a parede sai
    // mais fina (ou mais grossa) exatamente na emenda.
    const sem = depositedOf(scarfPath(SQUARE, 0), SQUARE[0]!);
    const com = depositedOf(scarfPath(SQUARE, 3), SQUARE[0]!);
    expect(com).toBeCloseTo(sem, 6);
    expect(sem).toBeCloseTo(perimeterOf(SQUARE), 6);
  });

  it("o caminho anda exatamente uma volta mais o cachecol", () => {
    const steps = scarfPath(SQUARE, 3);
    let walked = 0;
    let cursor: Point2 = SQUARE[0]!;
    for (const s of steps) {
      walked += Math.hypot(s.point.x - cursor.x, s.point.y - cursor.y);
      cursor = s.point;
    }
    expect(walked).toBeCloseTo(perimeterOf(SQUARE) + 3, 6);
  });

  it("a rampa de saída deposita menos que a vazão cheia", () => {
    // O último passo não vem com vazão ZERO: `flow` é a MÉDIA do trecho, e a
    // média de uma rampa de 1 a 0 é 0,5. Vazão zero só existe no ponto final,
    // que não é um trecho. Confundir os dois faria a emenda sair sem material.
    const steps = scarfPath(SQUARE, 3);
    const last = steps.at(-1)!;
    expect(last.flow).toBeLessThan(1);
    expect(last.flow).toBeGreaterThan(0);
    expect(last.flow).toBeCloseTo(0.5, 6); // rampa inteira dentro de um trecho
  });

  it("a rampa de entrada começa baixa e o corpo da volta é vazão cheia", () => {
    const steps = scarfPath(SQUARE, 4);
    expect(steps[0]!.flow).toBeLessThan(1);
    expect(steps[0]!.flow).toBeGreaterThan(0);
    expect(steps.some((s) => Math.abs(s.flow - 1) < 1e-9)).toBe(true);
  });

  it("vazão sempre entre 0 e 1", () => {
    for (const L of [0.5, 1, 3, 9]) {
      for (const step of scarfPath(SQUARE, L)) {
        expect(step.flow).toBeGreaterThanOrEqual(0);
        expect(step.flow).toBeLessThanOrEqual(1);
      }
    }
  });

  it("cachecol maior que meia volta é recusado — se sobreporia à própria rampa", () => {
    const perimeter = perimeterOf(SQUARE); // 40
    const steps = scarfPath(SQUARE, perimeter / 2 + 1);
    expect(steps.every((s) => s.flow === 1)).toBe(true);
  });

  it("não quebra em contorno degenerado", () => {
    expect(scarfPath([], 2)).toEqual([]);
    expect(scarfPath([{ x: 1, y: 1 }], 2)).toEqual([{ point: { x: 1, y: 1 }, flow: 1 }]);
  });

  it("não gera NaN nem ponto inválido", () => {
    for (const step of scarfPath(SQUARE, 2.5)) {
      expect(Number.isFinite(step.point.x)).toBe(true);
      expect(Number.isFinite(step.point.y)).toBe(true);
      expect(Number.isFinite(step.flow)).toBe(true);
    }
  });

  it("aguenta contorno com vértice repetido", () => {
    const duplicated: Contour = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 }, // repetido
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const steps = scarfPath(duplicated, 2);
    expect(steps.length).toBeGreaterThan(0);
    expect(depositedOf(steps, duplicated[0]!)).toBeCloseTo(perimeterOf(duplicated), 6);
  });
});
