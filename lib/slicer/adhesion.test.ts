import { describe, expect, it } from "vitest";

import { footprintOf, generateBrim, generateSkirt, outerOnly } from "./adhesion";
import { regionArea } from "./perimeters";
import type { Contour, Point2 } from "./slice";

const square = (size: number, offset = 0): Contour => [
  { x: offset, y: offset },
  { x: offset + size, y: offset },
  { x: offset + size, y: offset + size },
  { x: offset, y: offset + size },
];

/** Tubo: quadrado 20 com furo 10 centrado (furo em sentido contrário). */
const TUBE: Contour[] = [
  square(20),
  [
    { x: 5, y: 5 },
    { x: 5, y: 15 },
    { x: 15, y: 15 },
    { x: 15, y: 5 },
  ],
];

const boundsOf = (contours: Contour[]) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of contours) {
    for (const p of c) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, minY, maxX, maxY };
};

/** Menor distância de um ponto a um segmento. */
function distToSegment(p: Point2, a: Point2, b: Point2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function minPointsToEdges(points: Point2[], region: Contour[]): number {
  let best = Infinity;
  for (const p of points) {
    for (const contour of region) {
      for (let i = 0; i < contour.length; i++) {
        const a = contour[i]!;
        const b = contour[(i + 1) % contour.length]!;
        best = Math.min(best, distToSegment(p, a, b));
      }
    }
  }
  return best;
}

/**
 * Menor distância entre as BORDAS de duas regiões.
 *
 * Tem de ser simétrica. Medir só "vértices de A até as arestas de B" dá um
 * número maior que o real quando o deslocamento usa canto vivo: o vértice
 * deslocado de um canto de 90° fica a `d × √2` da peça, enquanto as ARESTAS
 * ficam corretamente a `d`. Foi exatamente esse engano que fez este teste
 * acusar 4,52 mm onde a folga real era 3,2.
 */
function minGapBetween(a: Contour[], b: Contour[]): number {
  return Math.min(minPointsToEdges(a.flat(), b), minPointsToEdges(b.flat(), a));
}

describe("outerOnly", () => {
  it("descarta o furo e mantém o externo", () => {
    const outer = outerOnly(TUBE);
    expect(outer).toHaveLength(1);
    expect(boundsOf(outer)).toEqual({ minX: 0, minY: 0, maxX: 20, maxY: 20 });
  });

  it("mantém duas ilhas separadas", () => {
    expect(outerOnly([square(10), square(10, 30)])).toHaveLength(2);
  });

  it("região vazia devolve vazio", () => {
    expect(outerOnly([])).toEqual([]);
  });
});

describe("footprintOf", () => {
  it("silhueta de um tubo é o quadrado cheio, sem o furo", () => {
    const footprint = footprintOf(TUBE);
    // 20×20 inteiro: se o furo tivesse sobrado, a área cairia para 300.
    expect(regionArea(footprint)).toBeCloseTo(400, 3);
  });

  it("ilhas separadas somam área, sem se cancelar", () => {
    const footprint = footprintOf([square(10), square(10, 30)]);
    expect(regionArea(footprint)).toBeCloseTo(200, 3);
  });

  it("CONTRATO: contornos sobrepostos não são suportados — e por quê", () => {
    // `classifyHoles` decide furo por ANINHAMENTO: se o primeiro ponto de um
    // contorno cai dentro de outro, é furo. Dois quadrados que se sobrepõem
    // sem se aninhar fazem o segundo ser lido como furo e descartado — sobra
    // 100 em vez de 175.
    //
    // Isto NÃO é alcançável pelo pipeline: `sliceMesh` numa malha fechada só
    // produz contornos disjuntos ou propriamente aninhados. Só uma malha
    // auto-intersectante chegaria aqui, e o efeito seria cosmético (uma ilha
    // sem skirt). Fica registrado para ninguém confundir com bug depois.
    expect(regionArea(footprintOf([square(10), square(10, 5)]))).toBeCloseTo(100, 3);
  });
});

describe("generateSkirt", () => {
  const footprint = footprintOf([square(20)]);

  it("gera a quantidade de laços pedida", () => {
    expect(generateSkirt(footprint, { loops: 3, gapMm: 3, lineWidth: 0.4 })).toHaveLength(3);
  });

  it("respeita a folga: o skirt não encosta na peça", () => {
    const skirt = generateSkirt(footprint, { loops: 1, gapMm: 3, lineWidth: 0.4 });
    const gap = minGapBetween(skirt, footprint);
    // O caminho é o CENTRO do filete, a gap + lineWidth/2 — assim a borda do
    // filete fica exatamente a `gap` da peça.
    expect(gap).toBeGreaterThanOrEqual(3);
    expect(gap).toBeCloseTo(3.2, 3);
  });

  it("cada laço fica mais para fora que o anterior", () => {
    const skirt = generateSkirt(footprint, { loops: 3, gapMm: 2, lineWidth: 0.4 });
    const areas = skirt.map((loop) => regionArea([loop]));
    expect(areas[1]!).toBeGreaterThan(areas[0]!);
    expect(areas[2]!).toBeGreaterThan(areas[1]!);
  });

  it("o skirt envolve a peça — nunca fica por dentro", () => {
    const skirt = generateSkirt(footprint, { loops: 1, gapMm: 3, lineWidth: 0.4 });
    const b = boundsOf(skirt);
    expect(b.minX).toBeLessThan(0);
    expect(b.minY).toBeLessThan(0);
    expect(b.maxX).toBeGreaterThan(20);
    expect(b.maxY).toBeGreaterThan(20);
  });

  it("não entra no furo do tubo", () => {
    const skirt = generateSkirt(footprintOf(TUBE), { loops: 1, gapMm: 1, lineWidth: 0.4 });
    // Tudo fora da caixa da peça: nada no miolo, onde estaria o furo.
    for (const p of skirt.flat()) {
      const foraDaPeca = p.x < 0 || p.x > 20 || p.y < 0 || p.y > 20;
      expect(foraDaPeca).toBe(true);
    }
  });

  it("desligado com 0 laços, e não quebra com entrada inválida", () => {
    expect(generateSkirt(footprint, { loops: 0, gapMm: 3, lineWidth: 0.4 })).toEqual([]);
    expect(generateSkirt([], { loops: 2, gapMm: 3, lineWidth: 0.4 })).toEqual([]);
    expect(generateSkirt(footprint, { loops: 2, gapMm: -1, lineWidth: 0.4 })).toEqual([]);
    expect(generateSkirt(footprint, { loops: 2, gapMm: 3, lineWidth: 0 })).toEqual([]);
  });
});

describe("generateBrim", () => {
  const footprint = footprintOf([square(20)]);

  it("largura de 3 filetes vira exatamente 3 laços", () => {
    expect(generateBrim(footprint, { widthMm: 1.2, lineWidth: 0.4 })).toHaveLength(3);
  });

  it("largura que não é múltiplo arredonda para cima — a aba nunca sai menor", () => {
    expect(generateBrim(footprint, { widthMm: 1, lineWidth: 0.4 })).toHaveLength(3);
  });

  it("todo laço fica FORA do contorno da peça", () => {
    const brim = generateBrim(footprint, { widthMm: 2, lineWidth: 0.4 });
    for (const loop of brim) {
      expect(regionArea([loop])).toBeGreaterThan(regionArea(footprint));
    }
  });

  it("o primeiro laço encosta na peça: meia largura para fora", () => {
    // Espelho da parede externa, que anda meia largura para DENTRO. As bordas
    // dos dois filetes se encontram exatamente sobre a superfície do modelo.
    const brim = generateBrim(footprint, { widthMm: 0.4, lineWidth: 0.4 });
    expect(minGapBetween(brim, footprint)).toBeCloseTo(0.2, 3);
  });

  it("sai do mais EXTERNO para o mais interno — o bico termina colado na peça", () => {
    const brim = generateBrim(footprint, { widthMm: 1.2, lineWidth: 0.4 });
    const areas = brim.map((loop) => regionArea([loop]));
    expect(areas[0]!).toBeGreaterThan(areas[1]!);
    expect(areas[1]!).toBeGreaterThan(areas[2]!);
  });

  it("não entra no furo do tubo", () => {
    const brim = generateBrim(footprintOf(TUBE), { widthMm: 2, lineWidth: 0.4 });
    expect(brim.length).toBeGreaterThan(0);
    for (const p of brim.flat()) {
      const foraDaPeca = p.x < 0 || p.x > 20 || p.y < 0 || p.y > 20;
      expect(foraDaPeca).toBe(true);
    }
  });

  it("desligado com largura 0, e não quebra com entrada inválida", () => {
    expect(generateBrim(footprint, { widthMm: 0, lineWidth: 0.4 })).toEqual([]);
    expect(generateBrim([], { widthMm: 2, lineWidth: 0.4 })).toEqual([]);
    expect(generateBrim(footprint, { widthMm: 2, lineWidth: 0 })).toEqual([]);
  });
});
