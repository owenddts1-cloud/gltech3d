import { describe, expect, it } from "vitest";

import { segmentsCross, travelCrossesWall } from "./combing";
import type { Contour } from "./slice";

const SQUARE: Contour = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe("segmentsCross", () => {
  it("detecta cruzamento em X", () => {
    expect(
      segmentsCross({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }),
    ).toBe(true);
  });

  it("segmentos separados não cruzam", () => {
    expect(
      segmentsCross({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 5 }, { x: 6, y: 5 }),
    ).toBe(false);
  });

  it("paralelos não cruzam", () => {
    expect(
      segmentsCross({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }, { x: 10, y: 1 }),
    ).toBe(false);
  });

  it("tocar a ponta NÃO conta como travessia", () => {
    // Decisão deliberada: o salto costuma partir de um ponto que está em cima
    // de um percurso. Contar esse toque faria retrair sempre.
    expect(
      segmentsCross({ x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    ).toBe(false);
  });

  it("colinear sobreposto não conta", () => {
    expect(
      segmentsCross({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 }),
    ).toBe(false);
  });
});

describe("travelCrossesWall", () => {
  it("salto interno não cruza — é o caso que economiza as 24 mil retrações", () => {
    expect(travelCrossesWall({ x: 2, y: 2 }, { x: 8, y: 8 }, [SQUARE])).toBe(false);
  });

  it("sair da peça cruza", () => {
    expect(travelCrossesWall({ x: 5, y: 5 }, { x: 20, y: 5 }, [SQUARE])).toBe(true);
  });

  it("pular de uma ilha para outra cruza duas vezes — e basta detectar", () => {
    const other: Contour = SQUARE.map((p) => ({ x: p.x + 40, y: p.y }));
    expect(travelCrossesWall({ x: 5, y: 5 }, { x: 45, y: 5 }, [SQUARE, other])).toBe(true);
  });

  it("atravessar um furo conta como sair — por cima do furo é vazio", () => {
    const bore: Contour = [
      { x: 4, y: 4 },
      { x: 6, y: 4 },
      { x: 6, y: 6 },
      { x: 4, y: 6 },
    ];
    expect(travelCrossesWall({ x: 1, y: 5 }, { x: 9, y: 5 }, [SQUARE, bore])).toBe(true);
  });

  it("sem paredes conhecidas, retrai — na dúvida, o lado seguro", () => {
    expect(travelCrossesWall({ x: 0, y: 0 }, { x: 100, y: 100 }, [])).toBe(true);
  });

  it("ignora contorno degenerado sem quebrar", () => {
    expect(travelCrossesWall({ x: 2, y: 2 }, { x: 8, y: 8 }, [SQUARE, [{ x: 1, y: 1 }]])).toBe(
      false,
    );
  });
});
