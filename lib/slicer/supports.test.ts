import { describe, it, expect } from "vitest";

import {
  maxOverhangStep,
  unsupportedRegion,
  generateSupports,
  supportVolumeCm3,
  DEFAULT_SUPPORT_OPTIONS,
} from "./supports";
import { regionArea } from "./perimeters";
import type { Contour } from "./slice";

/**
 * Suporte a menos = a peça desaba no meio da impressão. Suporte a mais = horas
 * de material jogado fora e acabamento arruinado ao quebrar. Os dois erros
 * custam caro e só aparecem na impressora.
 */

const rect = (x0: number, y0: number, x1: number, y1: number): Contour => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];

const opts = { ...DEFAULT_SUPPORT_OPTIONS, minAreaMm2: 0.5 };

describe("maxOverhangStep", () => {
  it("a 45° o avanço é igual à altura da camada", () => {
    // tan(45°) = 1. É a razão de 45° ser o limite padrão em FDM.
    expect(maxOverhangStep(0.2, 45)).toBeCloseTo(0.2, 6);
  });

  it("ângulo maior permite avançar mais", () => {
    expect(maxOverhangStep(0.2, 60)).toBeGreaterThan(maxOverhangStep(0.2, 45));
  });

  it("0° não deixa avançar nada (só parede reta)", () => {
    expect(maxOverhangStep(0.2, 0)).toBeCloseTo(0, 9);
  });

  it("não estoura para infinito perto de 90°", () => {
    // tan(90°) é infinito; sem limite, o avanço viraria Infinity e o offset
    // receberia NaN.
    expect(Number.isFinite(maxOverhangStep(0.2, 90))).toBe(true);
    expect(Number.isFinite(maxOverhangStep(0.2, 120))).toBe(true);
  });
});

describe("unsupportedRegion", () => {
  const step = maxOverhangStep(0.2, 45);

  it("coluna reta não precisa de suporte", () => {
    const camada = [rect(0, 0, 10, 10)];
    expect(unsupportedRegion(camada, camada, step)).toEqual([]);
  });

  it("avanço dentro do limite não precisa de suporte", () => {
    // Avança 0,1 mm com limite de 0,2.
    const baixo = [rect(0, 0, 10, 10)];
    const cima = [rect(0, 0, 10.1, 10)];
    expect(regionArea(unsupportedRegion(cima, baixo, step))).toBeCloseTo(0, 2);
  });

  it("avanço além do limite PRECISA de suporte", () => {
    // Avança 3 mm de uma vez: prateleira em balanço.
    const baixo = [rect(0, 0, 10, 10)];
    const cima = [rect(0, 0, 13, 10)];
    const r = unsupportedRegion(cima, baixo, step);
    expect(regionArea(r)).toBeGreaterThan(20); // ~2,8 × 10
  });

  it("camada flutuante sem nada embaixo é toda sem apoio", () => {
    const cima = [rect(0, 0, 10, 10)];
    expect(regionArea(unsupportedRegion(cima, [], step))).toBeCloseTo(100, 1);
  });

  it("camada vazia não gera suporte", () => {
    expect(unsupportedRegion([], [rect(0, 0, 10, 10)], step)).toEqual([]);
  });
});

describe("generateSupports", () => {
  it("torre reta não gera suporte nenhum", () => {
    const camadas = Array.from({ length: 20 }, () => [rect(0, 0, 10, 10)]);
    const s = generateSupports(camadas, opts);
    expect(s.every((l) => l.region.length === 0)).toBe(true);
  });

  it("mesa em T gera suporte SOB o balanço, até a base", () => {
    // 10 camadas de haste estreita, depois 5 camadas de tampo largo.
    const haste = Array.from({ length: 10 }, () => [rect(4, 4, 6, 6)]);
    const tampo = Array.from({ length: 5 }, () => [rect(0, 0, 10, 10)]);
    const s = generateSupports([...haste, ...tampo], opts);

    // Sem suporte acima do tampo.
    expect(s[12]!.region.length).toBe(0);
    // Com suporte logo abaixo do tampo...
    expect(regionArea(s[9]!.region)).toBeGreaterThan(50);
    // ...e continuando até a primeira camada.
    expect(regionArea(s[0]!.region)).toBeGreaterThan(50);
  });

  it("o suporte NÃO invade a peça", () => {
    const haste = Array.from({ length: 10 }, () => [rect(4, 4, 6, 6)]);
    const tampo = Array.from({ length: 3 }, () => [rect(0, 0, 10, 10)]);
    const s = generateSupports([...haste, ...tampo], opts);

    // A haste ocupa 4..6. O suporte da camada 5 tem de estar fora dela, com
    // folga — senão funde e não solta.
    for (const line of s[5]!.lines) {
      for (const p of [line.from, line.to]) {
        const dentroDaHaste = p.x > 4 && p.x < 6 && p.y > 4 && p.y < 6;
        expect(dentroDaHaste, `linha em (${p.x}, ${p.y}) invade a peça`).toBe(false);
      }
    }
  });

  it("respeita a folga: nada encosta na peça", () => {
    const haste = Array.from({ length: 6 }, () => [rect(4, 4, 6, 6)]);
    const tampo = [[rect(0, 0, 10, 10)]];
    const s = generateSupports([...haste, ...tampo], { ...opts, xyClearance: 0.5 });
    for (const line of s[3]!.lines) {
      for (const p of [line.from, line.to]) {
        const distX = Math.max(4 - p.x, p.x - 6, 0);
        const distY = Math.max(4 - p.y, p.y - 6, 0);
        // Fora do retângulo da peça em pelo menos um eixo, com folga.
        expect(Math.max(distX, distY)).toBeGreaterThan(0.3);
      }
    }
  });

  it("ilha pequena demais não vira torre", () => {
    // Balanço real, mas com limiar de área alto: não vale a torre, que soltaria
    // no meio da impressão e viraria lixo dentro da peça.
    const camadas = [
      ...Array.from({ length: 6 }, () => [rect(4, 4, 6, 6)]),
      [rect(0, 0, 10, 10)],
    ];
    const s = generateSupports(camadas, { ...opts, minAreaMm2: 500 });
    expect(s.every((l) => l.region.length === 0)).toBe(true);
  });

  it("ângulo mais permissivo gera menos suporte", () => {
    const camadas = [
      ...Array.from({ length: 8 }, () => [rect(4, 0, 6, 10)]),
      ...Array.from({ length: 3 }, () => [rect(0, 0, 10, 10)]),
    ];
    const area = (deg: number) =>
      generateSupports(camadas, { ...opts, maxOverhangDeg: deg })
        .reduce((sum, l) => sum + regionArea(l.region), 0);
    expect(area(70)).toBeLessThanOrEqual(area(30));
  });

  it("lista vazia não quebra", () => {
    expect(generateSupports([], opts)).toEqual([]);
  });

  it("nenhuma coordenada sai NaN", () => {
    const camadas = [
      ...Array.from({ length: 6 }, () => [rect(4, 4, 6, 6)]),
      ...Array.from({ length: 2 }, () => [rect(0, 0, 10, 10)]),
    ];
    for (const l of generateSupports(camadas, opts)) {
      for (const line of l.lines) {
        expect(Number.isFinite(line.from.x) && Number.isFinite(line.to.y)).toBe(true);
      }
    }
  });
});

describe("supportVolumeCm3", () => {
  it("cresce com a quantidade de suporte", () => {
    const camadas = [
      ...Array.from({ length: 10 }, () => [rect(4, 4, 6, 6)]),
      ...Array.from({ length: 3 }, () => [rect(0, 0, 10, 10)]),
    ];
    const denso = supportVolumeCm3(generateSupports(camadas, { ...opts, densityPct: 40 }), opts);
    const ralo = supportVolumeCm3(generateSupports(camadas, { ...opts, densityPct: 10 }), opts);
    expect(denso).toBeGreaterThan(ralo);
  });

  it("sem suporte, volume zero", () => {
    expect(supportVolumeCm3([], opts)).toBe(0);
  });
});
