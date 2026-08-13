import { describe, it, expect } from "vitest";

import {
  maxOverhangStep,
  unsupportedRegion,
  generateSupports,
  supportVolumeCm3,
  DEFAULT_SUPPORT_OPTIONS,
  type SupportOptions,
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
    // A camada 9 encosta no tampo: com a folga padrão ela fica VAZIA de
    // propósito, senão o suporte funde na peça e não sai.
    expect(s[9]!.region.length).toBe(0);
    // O topo do suporte fica uma camada abaixo...
    expect(regionArea(s[8]!.region)).toBeGreaterThan(50);
    // ...e continua até a primeira camada.
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

describe("folga vertical e interface — o defeito que arrancava material", () => {
  /** Ponte: duas colunas e uma tampa. A tampa precisa de suporte no meio. */
  const camadas = (n: number): Contour[][] => {
    const coluna = (x0: number, x1: number): Contour => [
      { x: x0, y: 0 }, { x: x1, y: 0 }, { x: x1, y: 20 }, { x: x0, y: 20 },
    ];
    const tampa: Contour = [
      { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 },
    ];
    // 10 camadas de coluna, depois a tampa atravessando o vão.
    return Array.from({ length: n }, (_, i) =>
      i < 10 ? [coluna(0, 8), coluna(32, 40)] : [tampa],
    );
  };

  const opcoes = (over: Partial<SupportOptions> = {}): SupportOptions => ({
    ...DEFAULT_SUPPORT_OPTIONS, ...over,
  });

  it("com folga, a camada logo abaixo do balanço fica VAZIA", () => {
    // É a diferença entre quebrar o suporte fora e arrancar material da peça
    // junto com ele.
    const regioes = camadas(14);
    const semFolga = generateSupports(regioes, opcoes({ zClearanceLayers: 0, interfaceLayers: 0 }));
    const comFolga = generateSupports(regioes, opcoes({ zClearanceLayers: 1, interfaceLayers: 0 }));

    // A tampa começa na camada 10; o balanço é detectado ali.
    expect(semFolga[9]!.region.length).toBeGreaterThan(0);
    expect(comFolga[9]!.region.length).toBe(0);
  });

  it("a folga só desloca o suporte, não o elimina", () => {
    const regioes = camadas(14);
    const comFolga = generateSupports(regioes, opcoes({ zClearanceLayers: 1, interfaceLayers: 0 }));
    const totalCamadas = comFolga.filter((s) => s.region.length > 0).length;
    expect(totalCamadas).toBeGreaterThan(0);
  });

  it("folga maior abre vão maior", () => {
    const regioes = camadas(14);
    const uma = generateSupports(regioes, opcoes({ zClearanceLayers: 1, interfaceLayers: 0 }));
    const tres = generateSupports(regioes, opcoes({ zClearanceLayers: 3, interfaceLayers: 0 }));
    const topo = (s: ReturnType<typeof generateSupports>) =>
      s.map((x, i) => (x.region.length > 0 ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
    expect(topo(tres)).toBeLessThan(topo(uma));
  });

  it("zClearance 0 encosta na peça — colado de propósito", () => {
    // O suporte termina na camada imediatamente abaixo do balanço. É o
    // comportamento antigo, mantido para quem quiser pedir suporte colado.
    const regioes = camadas(14);
    const colado = generateSupports(regioes, opcoes({ zClearanceLayers: 0, interfaceLayers: 0 }));
    expect(colado[9]!.region.length).toBeGreaterThan(0);
  });

  it("a INTERFACE é mais densa que o corpo do suporte", () => {
    // Sem isso a face de baixo da peça afunda entre linhas espaçadas de 15%.
    const regioes = camadas(14);
    const s = generateSupports(regioes, opcoes({ zClearanceLayers: 1, interfaceLayers: 2 }));

    const interfaces = s.filter((x) => x.isInterface && x.lines.length > 0);
    const corpo = s.filter((x) => !x.isInterface && x.lines.length > 0);
    expect(interfaces.length).toBeGreaterThan(0);
    expect(corpo.length).toBeGreaterThan(0);

    // Mesma região, densidade maior ⇒ mais linhas.
    const densidade = (arr: typeof interfaces) =>
      arr.reduce((sum, x) => sum + x.lines.length, 0) / arr.length;
    expect(densidade(interfaces)).toBeGreaterThan(densidade(corpo));
  });

  it("interfaceLayers 0 não marca nenhuma camada como interface", () => {
    const s = generateSupports(camadas(14), opcoes({ interfaceLayers: 0 }));
    expect(s.every((x) => !x.isInterface)).toBe(true);
  });

  it("peça sem balanço não ganha suporte, com ou sem folga", () => {
    const cubo: Contour[][] = Array.from({ length: 10 }, () => [[
      { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 },
    ]]);
    for (const z of [0, 1, 3]) {
      const s = generateSupports(cubo, opcoes({ zClearanceLayers: z }));
      expect(s.every((x) => x.region.length === 0)).toBe(true);
    }
  });
});

describe("buildPlateOnly — suporte que nasce em cima da peça", () => {
  /**
   * Base larga → pescoço estreito → topo largo. O balanço do topo fica sobre a
   * BASE, não sobre a mesa: o suporte desce e morre em cima da própria peça,
   * dentro de um vão sem acesso para alicate.
   */
  const halteres = (): Contour[][] => {
    const largo: Contour = [
      { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 },
    ];
    const pescoco: Contour = [
      { x: 8, y: 8 }, { x: 12, y: 8 }, { x: 12, y: 12 }, { x: 8, y: 12 },
    ];
    return [
      ...Array.from({ length: 5 }, () => [largo]),
      ...Array.from({ length: 5 }, () => [pescoco]),
      ...Array.from({ length: 5 }, () => [largo]),
    ];
  };

  it("desligado, o suporte é gerado apoiado na peça", () => {
    const s = generateSupports(halteres(), { ...opts, buildPlateOnly: false });
    const total = s.reduce((sum, l) => sum + regionArea(l.region), 0);
    expect(total).toBeGreaterThan(50);
  });

  it("ligado, esse suporte NÃO é gerado", () => {
    const s = generateSupports(halteres(), { ...opts, buildPlateOnly: true });
    const total = s.reduce((sum, l) => sum + regionArea(l.region), 0);
    expect(total).toBeLessThan(1);
  });

  it("mas não mata o suporte que chega na MESA", () => {
    // Mesa em T: a torre desce livre até a camada 0. Ligar a opção não pode
    // custar o suporte legítimo — senão o tampo desaba.
    const haste = Array.from({ length: 10 }, () => [rect(4, 4, 6, 6)]);
    const tampo = Array.from({ length: 5 }, () => [rect(0, 0, 10, 10)]);
    const s = generateSupports([...haste, ...tampo], { ...opts, buildPlateOnly: true });
    expect(regionArea(s[0]!.region)).toBeGreaterThan(50);
  });
});
