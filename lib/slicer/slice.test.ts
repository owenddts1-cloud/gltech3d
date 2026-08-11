import { describe, it, expect } from "vitest";

import {
  joinOpenPaths,
  sliceMesh,
  sliceSegmentsAt,
  stitchSegments,
  signedArea,
  pointInContour,
  classifyHoles,
  type Contour,
} from "./slice";

/**
 * Fatiamento errado não dá erro: dá peça errada, e só se descobre depois de
 * horas de impressão. Cada caso aqui é um jeito conhecido de o algoritmo falhar.
 */

/** Caixa alinhada aos eixos, como 12 triângulos (formato do parser de STL). */
function box(
  [x0, y0, z0]: [number, number, number],
  [x1, y1, z1]: [number, number, number],
): number[] {
  const v: Array<[number, number, number]> = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const quads: Array<[number, number, number, number]> = [
    [0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4],
    [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
  ];
  const out: number[] = [];
  for (const [a, b, c, d] of quads) {
    out.push(...v[a]!, ...v[b]!, ...v[c]!);
    out.push(...v[a]!, ...v[c]!, ...v[d]!);
  }
  return out;
}

const mesh = (...parts: number[][]) => new Float32Array(parts.flat());

/** Cubo de 10 mm apoiado em z=0. */
const CUBE = mesh(box([0, 0, 0], [10, 10, 10]));

/** Caixa oca: paredes de 2 mm, vazio no meio. Produz 2 contornos por camada. */
const HOLLOW = mesh(box([0, 0, 0], [10, 10, 10]), box([2, 2, 0], [8, 8, 10]));

const bounds = (c: Contour) => ({
  minX: Math.min(...c.map((p) => p.x)), maxX: Math.max(...c.map((p) => p.x)),
  minY: Math.min(...c.map((p) => p.y)), maxY: Math.max(...c.map((p) => p.y)),
});

describe("sliceSegmentsAt", () => {
  it("um cubo cortado no meio dá 8 segmentos (2 por parede)", () => {
    // Cada parede é 2 triângulos, e cada um contribui com um segmento.
    expect(sliceSegmentsAt(CUBE, 5)).toHaveLength(8);
  });

  it("plano fora do modelo não devolve nada", () => {
    expect(sliceSegmentsAt(CUBE, -1)).toHaveLength(0);
    expect(sliceSegmentsAt(CUBE, 99)).toHaveLength(0);
  });

  it("segmento de comprimento zero é descartado", () => {
    for (const s of sliceSegmentsAt(CUBE, 5)) {
      expect(Math.hypot(s.a.x - s.b.x, s.a.y - s.b.y)).toBeGreaterThan(0);
    }
  });
});

describe("stitchSegments", () => {
  it("fecha o quadrado do cubo num contorno só", () => {
    const { contours, openPaths } = stitchSegments(sliceSegmentsAt(CUBE, 5));
    expect(contours).toHaveLength(1);
    expect(openPaths).toHaveLength(0);
    expect(bounds(contours[0]!)).toEqual({ minX: 0, maxX: 10, minY: 0, maxY: 10 });
  });

  it("o contorno não repete o primeiro ponto no fim", () => {
    // Repetir cria um segmento de comprimento zero no G-code.
    const [c] = stitchSegments(sliceSegmentsAt(CUBE, 5)).contours;
    const first = c![0]!;
    const last = c![c!.length - 1]!;
    expect(first.x === last.x && first.y === last.y).toBe(false);
  });

  it("peça oca dá dois contornos", () => {
    expect(stitchSegments(sliceSegmentsAt(HOLLOW, 5)).contours).toHaveLength(2);
  });

  it("segmento solto vira openPath, não contorno falso", () => {
    // Malha com buraco não pode produzir contorno inventado — o fatiador tem de
    // reportar que não fechou.
    const { contours, openPaths } = stitchSegments([
      { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
      { a: { x: 10, y: 0 }, b: { x: 10, y: 10 } },
    ]);
    expect(contours).toHaveLength(0);
    expect(openPaths).toHaveLength(1);
  });

  it("não trava com segmentos duplicados", () => {
    const s = { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } };
    expect(() => stitchSegments([s, s, s, s])).not.toThrow();
  });

  it("costura mesmo com os segmentos na ordem invertida", () => {
    // Os segmentos saem da malha sem ordem e sem direção consistente.
    const { contours } = stitchSegments([
      { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
      { a: { x: 10, y: 10 }, b: { x: 10, y: 0 } },
      { a: { x: 10, y: 10 }, b: { x: 0, y: 10 } },
      { a: { x: 0, y: 0 }, b: { x: 0, y: 10 } },
    ]);
    expect(contours).toHaveLength(1);
    expect(contours[0]).toHaveLength(4);
  });
});

describe("sliceMesh", () => {
  it("cubo de 10 mm com camada de 0,2 dá ~50 camadas", () => {
    const layers = sliceMesh(CUBE, { layerHeight: 0.2 });
    expect(layers.length).toBeGreaterThanOrEqual(49);
    expect(layers.length).toBeLessThanOrEqual(50);
  });

  it("toda camada do cubo tem exatamente um contorno de 10×10", () => {
    for (const layer of sliceMesh(CUBE, { layerHeight: 0.5 })) {
      expect(layer.contours, `z=${layer.z}`).toHaveLength(1);
      const b = bounds(layer.contours[0]!);
      expect(b.maxX - b.minX).toBeCloseTo(10, 3);
      expect(b.maxY - b.minY).toBeCloseTo(10, 3);
    }
  });

  it("nenhuma camada tem contorno aberto numa malha fechada", () => {
    // openPath numa malha sã significa bug de costura.
    for (const layer of sliceMesh(HOLLOW, { layerHeight: 0.3 })) {
      expect(layer.openPaths, `z=${layer.z}`).toHaveLength(0);
    }
  });

  it("primeira camada mais alta desloca as demais", () => {
    const normal = sliceMesh(CUBE, { layerHeight: 0.2 });
    const comPrimeira = sliceMesh(CUBE, { layerHeight: 0.2, firstLayerHeight: 0.3 });
    expect(comPrimeira[0]!.z).toBeCloseTo(0.3, 5);
    expect(normal[0]!.z).toBeCloseTo(0.2, 5);
    expect(comPrimeira.length).toBeLessThanOrEqual(normal.length);
  });

  it("as alturas são estritamente crescentes", () => {
    const layers = sliceMesh(CUBE, { layerHeight: 0.25 });
    for (let i = 1; i < layers.length; i++) {
      expect(layers[i]!.z).toBeGreaterThan(layers[i - 1]!.z);
    }
  });

  it("vértice exatamente na altura da camada não quebra o contorno", () => {
    // O topo do cubo está em z=10 e a base em z=0. Com camada de 1 mm, os planos
    // cairiam em cotas redondas — é o caso que gera contorno degenerado sem o
    // deslocamento de meio micron.
    for (const layer of sliceMesh(CUBE, { layerHeight: 1 })) {
      expect(layer.contours.length + layer.openPaths.length).toBeGreaterThan(0);
      expect(layer.openPaths).toHaveLength(0);
    }
  });

  it("altura de camada inválida é erro explícito", () => {
    expect(() => sliceMesh(CUBE, { layerHeight: 0 })).toThrow(/maior que zero/i);
    expect(() => sliceMesh(CUBE, { layerHeight: -1 })).toThrow();
  });

  it("malha vazia devolve zero camadas em vez de quebrar", () => {
    expect(sliceMesh(new Float32Array(0), { layerHeight: 0.2 })).toEqual([]);
  });

  it("modelo mais fino que a camada devolve zero camadas", () => {
    const filme = mesh(box([0, 0, 0], [10, 10, 0.05]));
    expect(sliceMesh(filme, { layerHeight: 0.2 })).toEqual([]);
  });
});

describe("signedArea", () => {
  it("dá a área correta e o sinal indica a orientação", () => {
    const ccw: Contour = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(signedArea(ccw)).toBeCloseTo(100, 6);
    expect(signedArea([...ccw].reverse())).toBeCloseTo(-100, 6);
  });
});

describe("pointInContour", () => {
  const square: Contour = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

  it("dentro e fora", () => {
    expect(pointInContour({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInContour({ x: 15, y: 5 }, square)).toBe(false);
    expect(pointInContour({ x: -1, y: 5 }, square)).toBe(false);
  });
});

describe("classifyHoles", () => {
  it("o contorno interno da peça oca é marcado como furo", () => {
    const layer = sliceMesh(HOLLOW, { layerHeight: 1 })[3]!;
    const classified = classifyHoles(layer.contours);
    expect(classified.filter((c) => c.isHole)).toHaveLength(1);
    expect(classified.filter((c) => !c.isHole)).toHaveLength(1);

    const hole = classified.find((c) => c.isHole)!.contour;
    const b = bounds(hole);
    expect(b.maxX - b.minX).toBeCloseTo(6, 3); // o vazio de 2..8
  });

  it("aninhamento triplo: ilha dentro de furo volta a ser sólido", () => {
    // A regra ingênua "o maior é externo, o resto é furo" erra este caso.
    const externo: Contour = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }, { x: 0, y: 30 }];
    const furo: Contour = [{ x: 5, y: 5 }, { x: 25, y: 5 }, { x: 25, y: 25 }, { x: 5, y: 25 }];
    const ilha: Contour = [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }, { x: 10, y: 20 }];
    const r = classifyHoles([externo, furo, ilha]);
    expect(r[0]!.isHole).toBe(false);
    expect(r[1]!.isHole).toBe(true);
    expect(r[2]!.isHole).toBe(false);
  });
});

describe("joinOpenPaths — a segunda passada", () => {
  it("junta dois trechos cujas pontas quase se tocam", () => {
    // 1 µm de vão: o que a costura exata (0,1 µm) recusa e a impressora não
    // consegue nem distinguir.
    const a: Contour = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const b: Contour = [{ x: 10, y: 10.000001 }, { x: 0, y: 10 }, { x: 0, y: 0.000001 }];
    const r = joinOpenPaths([a, b]);
    expect(r.contours).toHaveLength(1);
    expect(r.openPaths).toHaveLength(0);
  });

  it("junta mesmo com o trecho guardado ao contrário", () => {
    // Os trechos saem da costura sem direção consistente.
    const a: Contour = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const invertido: Contour = [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }];
    expect(joinOpenPaths([a, invertido]).contours).toHaveLength(1);
  });

  it("NÃO junta o que está genuinamente longe", () => {
    // Buraco de verdade na malha tem de continuar sendo reportado, não costurado
    // por cima — senão o fatiador inventa parede onde não há material.
    const a: Contour = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const b: Contour = [{ x: 50, y: 50 }, { x: 60, y: 50 }];
    const r = joinOpenPaths([a, b]);
    expect(r.contours).toHaveLength(0);
    expect(r.openPaths).toHaveLength(2);
  });

  it("o vão tolerado é muito menor que o bico", () => {
    // 0,1 mm é 1/4 do bico — juntar aí já seria inventar geometria.
    const a: Contour = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const b: Contour = [{ x: 10, y: 10.1 }, { x: 0, y: 10 }, { x: 0, y: 0 }];
    expect(joinOpenPaths([a, b]).contours).toHaveLength(0);
  });

  it("não trava com trecho isolado nem com lista vazia", () => {
    expect(joinOpenPaths([]).contours).toEqual([]);
    const solto: Contour = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    expect(joinOpenPaths([solto]).openPaths).toHaveLength(1);
  });

  it("o contorno resultante não repete o primeiro ponto", () => {
    const a: Contour = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const b: Contour = [{ x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }];
    const [c] = joinOpenPaths([a, b]).contours;
    const first = c![0]!;
    const last = c![c!.length - 1]!;
    expect(first.x === last.x && first.y === last.y).toBe(false);
  });
});
