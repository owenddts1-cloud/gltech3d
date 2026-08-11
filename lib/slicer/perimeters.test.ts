import { describe, it, expect } from "vitest";

import {
  offsetRegion,
  subtractRegions,
  intersectRegions,
  unionRegions,
  regionArea,
  generatePerimeters,
} from "./perimeters";
import type { Contour } from "./slice";

/**
 * Perímetro errado = peça fora de medida, e só se descobre com o paquímetro
 * depois de imprimir. Cada asserção aqui mede um número que a peça real tem de
 * ter.
 */

const square = (size: number, x = 0, y = 0): Contour => [
  { x, y }, { x: x + size, y }, { x: x + size, y: y + size }, { x, y: y + size },
];

const bounds = (c: Contour) => ({
  minX: Math.min(...c.map((p) => p.x)), maxX: Math.max(...c.map((p) => p.x)),
  minY: Math.min(...c.map((p) => p.y)), maxY: Math.max(...c.map((p) => p.y)),
});

/** Quadrado de 20 mm com furo de 6 mm no meio. */
const SQUARE_20 = square(20);
const HOLE_6: Contour = [
  { x: 7, y: 7 }, { x: 13, y: 7 }, { x: 13, y: 13 }, { x: 7, y: 13 },
];

describe("offsetRegion", () => {
  it("encolher 1 mm tira 1 mm de CADA lado", () => {
    const [c] = offsetRegion([SQUARE_20], -1);
    const b = bounds(c!);
    expect(b.minX).toBeCloseTo(1, 3);
    expect(b.maxX).toBeCloseTo(19, 3);
    expect(b.maxX - b.minX).toBeCloseTo(18, 3);
  });

  it("expandir 1 mm cresce 1 mm de cada lado", () => {
    const b = bounds(offsetRegion([SQUARE_20], 1)[0]!);
    expect(b.minX).toBeCloseTo(-1, 3);
    expect(b.maxX).toBeCloseTo(21, 3);
  });

  it("delta 0 devolve a região sem alterar a área", () => {
    expect(regionArea(offsetRegion([SQUARE_20], 0))).toBeCloseTo(400, 2);
  });

  it("encolher além do próprio tamanho faz a região SUMIR", () => {
    // Parede fina tem de desaparecer, não virar laço invertido — é o modo
    // clássico de um offset caseiro falhar.
    expect(offsetRegion([SQUARE_20], -15)).toEqual([]);
  });

  it("o FURO cresce quando a peça encolhe", () => {
    // Encolher a peça 1 mm afasta o material 1 mm da parede do furo também.
    // Um offset que tratasse o furo como ilha o encheria — erro grave e mudo.
    const r = offsetRegion([SQUARE_20, HOLE_6], -1);
    expect(r.length).toBe(2);
    // Área = externo (18×18) menos furo (8×8)
    expect(regionArea(r)).toBeCloseTo(18 * 18 - 8 * 8, 1);
  });

  it("canto côncavo não produz laço invertido", () => {
    // Um "L": o canto interno é onde as arestas deslocadas se cruzam.
    const L: Contour = [
      { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 6 },
      { x: 6, y: 6 }, { x: 6, y: 20 }, { x: 0, y: 20 },
    ];
    const areaOriginal = regionArea([L]);
    const encolhido = offsetRegion([L], -1);
    const areaEncolhida = regionArea(encolhido);
    expect(areaEncolhida).toBeGreaterThan(0);
    expect(areaEncolhida).toBeLessThan(areaOriginal);
    // Laço invertido apareceria como contorno extra ou área acima da original.
    expect(encolhido.length).toBe(1);
  });

  it("região vazia devolve vazia", () => {
    expect(offsetRegion([], -1)).toEqual([]);
  });

  it("contorno com menos de 3 pontos é ignorado", () => {
    expect(offsetRegion([[{ x: 0, y: 0 }, { x: 1, y: 1 }]], -0.1)).toEqual([]);
  });
});

describe("booleanos 2D", () => {
  it("diferença abre o furo", () => {
    const r = subtractRegions([SQUARE_20], [square(6, 7, 7)]);
    expect(regionArea(r)).toBeCloseTo(400 - 36, 1);
  });

  it("interseção de quadrados sobrepostos", () => {
    expect(regionArea(intersectRegions([square(10)], [square(10, 5, 5)]))).toBeCloseTo(25, 1);
  });

  it("união de quadrados sobrepostos não conta a sobreposição duas vezes", () => {
    expect(regionArea(unionRegions([square(10)], [square(10, 5, 5)]))).toBeCloseTo(175, 1);
  });

  it("diferença por região vazia devolve o original", () => {
    expect(regionArea(subtractRegions([SQUARE_20], []))).toBeCloseTo(400, 1);
  });

  it("interseção disjunta é vazia", () => {
    expect(intersectRegions([square(5)], [square(5, 100, 100)])).toEqual([]);
  });
});

describe("generatePerimeters", () => {
  const opts = { lineWidth: 0.4, wallCount: 3 };

  it("a PRIMEIRA parede fica meia largura para dentro", () => {
    // A prova que importa: o filete é centrado no caminho, então a borda externa
    // do filete cai exatamente sobre a superfície do modelo. Sem isso a peça
    // sai 0,4 mm maior no total.
    const { walls } = generatePerimeters([SQUARE_20], opts);
    const b = bounds(walls[0]![0]!);
    expect(b.minX).toBeCloseTo(0.2, 3);
    expect(b.maxX).toBeCloseTo(19.8, 3);
    expect(b.maxX - b.minX).toBeCloseTo(19.6, 3);
  });

  it("cada parede seguinte anda uma largura a mais", () => {
    const { walls } = generatePerimeters([SQUARE_20], opts);
    expect(walls).toHaveLength(3);
    expect(bounds(walls[1]![0]!).minX).toBeCloseTo(0.6, 3);
    expect(bounds(walls[2]![0]!).minX).toBeCloseTo(1.0, 3);
  });

  it("a peça impressa fica na medida do modelo", () => {
    // Borda externa do filete = caminho + metade da largura.
    const { walls } = generatePerimeters([SQUARE_20], opts);
    const b = bounds(walls[0]![0]!);
    const larguraImpressa = (b.maxX + 0.2) - (b.minX - 0.2);
    expect(larguraImpressa).toBeCloseTo(20, 3);
  });

  it("para de gerar parede quando não cabe mais", () => {
    // Tira de 1 mm com bico de 0,4: cabe uma parede, a segunda não.
    const tira: Contour = [
      { x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 1 }, { x: 0, y: 1 },
    ];
    const { walls } = generatePerimeters([tira], { lineWidth: 0.4, wallCount: 5 });
    expect(walls.length).toBeGreaterThan(0);
    expect(walls.length).toBeLessThan(5);
  });

  it("a região de preenchimento fica DENTRO da última parede", () => {
    const { walls, infillRegion } = generatePerimeters([SQUARE_20], opts);
    const ultima = bounds(walls[walls.length - 1]![0]!);
    const infill = bounds(infillRegion[0]!);
    expect(infill.minX).toBeGreaterThan(ultima.minX);
    expect(infill.maxX).toBeLessThan(ultima.maxX);
  });

  it("o furo é respeitado em todas as paredes", () => {
    const { walls } = generatePerimeters([SQUARE_20, HOLE_6], opts);
    for (const [i, wall] of walls.entries()) {
      expect(wall.length, `parede ${i} perdeu o furo`).toBe(2);
    }
  });

  it("peça menor que uma parede não gera parede nem preenchimento", () => {
    const minusculo = square(0.3);
    const r = generatePerimeters([minusculo], opts);
    expect(r.walls).toEqual([]);
    expect(r.infillRegion).toEqual([]);
  });

  it("entrada inválida não quebra", () => {
    expect(generatePerimeters([], opts).walls).toEqual([]);
    expect(generatePerimeters([SQUARE_20], { lineWidth: 0, wallCount: 2 }).walls).toEqual([]);
    expect(generatePerimeters([SQUARE_20], { lineWidth: 0.4, wallCount: 0 }).walls).toEqual([]);
  });

  it("nenhuma coordenada sai NaN", () => {
    const { walls, infillRegion } = generatePerimeters([SQUARE_20, HOLE_6], opts);
    for (const contour of [...walls.flat(), ...infillRegion]) {
      for (const p of contour) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
    }
  });
});
