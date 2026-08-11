import { describe, it, expect } from "vitest";

import { sliceMesh, type Contour } from "./slice";
import {
  generateInfill,
  infillSpacing,
  totalInfillLength,
  linesAreInsideMaterial,
} from "./infill";
import {
  extrusionFor,
  filamentGrams,
  orderByProximity,
  generateGcode,
  formatDuration,
  DEFAULT_PROFILE,
  type PrintSettings,
} from "./gcode";

/**
 * Preenchimento e G-code.
 *
 * O erro caro aqui é silencioso: um `E` errado não trava nada, só produz peça
 * frágil ou empenada — e isso só se descobre horas depois, na impressora.
 */

const SQUARE: Contour = [
  { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 },
];
const HOLE: Contour = [
  { x: 8, y: 8 }, { x: 12, y: 8 }, { x: 12, y: 12 }, { x: 8, y: 12 },
];

const SETTINGS: PrintSettings = {
  layerHeight: 0.2,
  firstLayerHeight: 0.3,
  lineWidth: 0.4,
  filamentDensity: 1.24,
};

describe("infillSpacing", () => {
  it("100% de densidade = linhas encostadas", () => {
    expect(infillSpacing(100, 0.4)).toBeCloseTo(0.4, 6);
  });

  it("20% de densidade = 5× o espaçamento", () => {
    expect(infillSpacing(20, 0.4)).toBeCloseTo(2, 6);
  });

  it("densidade 0 = infinito (peça oca), não divisão por zero", () => {
    expect(infillSpacing(0, 0.4)).toBe(Infinity);
  });

  it("densidade fora da faixa é limitada", () => {
    expect(infillSpacing(150, 0.4)).toBeCloseTo(0.4, 6);
    expect(infillSpacing(-10, 0.4)).toBe(Infinity);
  });
});

describe("generateInfill", () => {
  it("preenche o quadrado com linhas", () => {
    const lines = generateInfill([SQUARE], {
      densityPct: 20, lineWidth: 0.4, pattern: "linhas", angleDeg: 0,
    });
    expect(lines.length).toBeGreaterThan(5);
  });

  it("NENHUMA linha invade o furo", () => {
    // É o teste que importa: preenchimento que atravessa cavidade entope o furo
    // da peça, e ninguém percebe até imprimir.
    const contours = [SQUARE, HOLE];
    const lines = generateInfill(contours, {
      densityPct: 40, lineWidth: 0.4, pattern: "linhas", angleDeg: 0,
    });
    expect(lines.length).toBeGreaterThan(0);
    expect(linesAreInsideMaterial(lines, contours)).toBe(true);
  });

  it("densidade 0 não gera linha nenhuma", () => {
    expect(generateInfill([SQUARE], {
      densityPct: 0, lineWidth: 0.4, pattern: "linhas", angleDeg: 0,
    })).toEqual([]);
  });

  it("mais densidade, mais material", () => {
    const opts = { lineWidth: 0.4, pattern: "linhas" as const, angleDeg: 0 };
    const baixa = totalInfillLength(generateInfill([SQUARE], { ...opts, densityPct: 10 }));
    const alta = totalInfillLength(generateInfill([SQUARE], { ...opts, densityPct: 50 }));
    expect(alta).toBeGreaterThan(baixa * 2);
  });

  it("o ângulo gira o padrão sem mudar a área coberta", () => {
    const opts = { densityPct: 20, lineWidth: 0.4, pattern: "linhas" as const };
    const a = totalInfillLength(generateInfill([SQUARE], { ...opts, angleDeg: 0 }));
    const b = totalInfillLength(generateInfill([SQUARE], { ...opts, angleDeg: 45 }));
    // Num quadrado a 45° o comprimento total fica próximo — não idêntico,
    // porque a varredura corta as pontas.
    expect(b).toBeGreaterThan(a * 0.6);
    expect(b).toBeLessThan(a * 1.5);
  });

  it("grade e triângulo respeitam o furo também", () => {
    for (const pattern of ["grade", "triangulo"] as const) {
      const lines = generateInfill([SQUARE, HOLE], {
        densityPct: 30, lineWidth: 0.4, pattern, angleDeg: 15,
      });
      expect(lines.length, pattern).toBeGreaterThan(0);
      expect(linesAreInsideMaterial(lines, [SQUARE, HOLE]), pattern).toBe(true);
    }
  });

  it("camada sem contorno não quebra", () => {
    expect(generateInfill([], {
      densityPct: 20, lineWidth: 0.4, pattern: "grade", angleDeg: 0,
    })).toEqual([]);
  });
});

describe("extrusionFor", () => {
  it("bate com o cálculo de volume feito à mão", () => {
    // 100 mm de percurso, 0,4 × 0,2 de seção = 8 mm³.
    // Fio de 1,75 tem área de 2,4053 mm² → 8 / 2,4053 = 3,3260 mm.
    expect(extrusionFor(100, 0.4, 0.2, 1.75)).toBeCloseTo(3.326, 3);
  });

  it("é linear no comprimento", () => {
    const a = extrusionFor(50, 0.4, 0.2, 1.75);
    expect(extrusionFor(100, 0.4, 0.2, 1.75)).toBeCloseTo(a * 2, 6);
  });

  it("camada mais alta consome mais", () => {
    expect(extrusionFor(100, 0.4, 0.3, 1.75)).toBeGreaterThan(extrusionFor(100, 0.4, 0.2, 1.75));
  });

  it("fio mais grosso consome MENOS milímetros para o mesmo volume", () => {
    // Erro clássico de sinal: inverter isto entope ou esfomeia a extrusora.
    expect(extrusionFor(100, 0.4, 0.2, 2.85)).toBeLessThan(extrusionFor(100, 0.4, 0.2, 1.75));
  });

  it("distância zero ou negativa não extruda", () => {
    expect(extrusionFor(0, 0.4, 0.2, 1.75)).toBe(0);
    expect(extrusionFor(-5, 0.4, 0.2, 1.75)).toBe(0);
  });
});

describe("filamentGrams", () => {
  it("1 metro de PLA 1,75 pesa ~3 g", () => {
    // Valor conferível: 1000 mm × 2,4053 mm² = 2405 mm³ = 2,405 cm³ × 1,24.
    expect(filamentGrams(1000, 1.75, 1.24)).toBeCloseTo(2.98, 1);
  });

  it("é linear e nunca negativo para entrada válida", () => {
    expect(filamentGrams(2000, 1.75, 1.24)).toBeCloseTo(filamentGrams(1000, 1.75, 1.24) * 2, 5);
    expect(filamentGrams(0, 1.75, 1.24)).toBe(0);
  });
});

describe("orderByProximity", () => {
  it("escolhe o percurso mais próximo primeiro", () => {
    const paths = [
      { from: { x: 100, y: 100 }, to: { x: 101, y: 100 } },
      { from: { x: 1, y: 0 }, to: { x: 2, y: 0 } },
      { from: { x: 50, y: 50 }, to: { x: 51, y: 50 } },
    ];
    expect(orderByProximity(paths, { x: 0, y: 0 })[0]!.from).toEqual({ x: 1, y: 0 });
  });

  it("reduz o deslocamento total", () => {
    const paths = Array.from({ length: 20 }, (_, i) => ({
      from: { x: (i % 2) * 100, y: i * 5 },
      to: { x: (i % 2) * 100 + 10, y: i * 5 },
    }));
    const travel = (list: typeof paths) => {
      let total = 0;
      let cursor = { x: 0, y: 0 };
      for (const p of list) {
        total += Math.hypot(p.from.x - cursor.x, p.from.y - cursor.y);
        cursor = p.to;
      }
      return total;
    };
    expect(travel(orderByProximity(paths))).toBeLessThan(travel(paths));
  });

  it("não perde nem duplica percurso", () => {
    const paths = Array.from({ length: 8 }, (_, i) => ({
      from: { x: i, y: 0 }, to: { x: i, y: 1 },
    }));
    const ordered = orderByProximity(paths);
    expect(ordered).toHaveLength(8);
    expect(new Set(ordered).size).toBe(8);
  });

  it("lista vazia devolve vazia", () => {
    expect(orderByProximity([])).toEqual([]);
  });
});

describe("generateGcode", () => {
  const plan = [
    { z: 0.3, perimeters: [SQUARE], infill: generateInfill([SQUARE], {
      densityPct: 20, lineWidth: 0.4, pattern: "linhas", angleDeg: 0,
    }) },
    { z: 0.5, perimeters: [SQUARE], infill: [] },
  ];

  it("emite cabeçalho, temperaturas e rodapé", () => {
    const { gcode } = generateGcode(plan, DEFAULT_PROFILE, SETTINGS);
    for (const expected of ["G21", "G90", "M82", "G28", "M109 S210", "M140 S60", "M84"]) {
      expect(gcode, `falta ${expected}`).toContain(expected);
    }
  });

  it("marca camada e tipo de extrusão para o preview", () => {
    const { gcode } = generateGcode(plan, DEFAULT_PROFILE, SETTINGS);
    expect(gcode).toContain(";LAYER:0");
    expect(gcode).toContain(";LAYER:1");
    expect(gcode).toContain(";TYPE:WALL-OUTER");
    expect(gcode).toContain(";TYPE:FILL");
  });

  it("E é monotônico crescente (extrusora em modo absoluto)", () => {
    // Em M82 o E é acumulado. Se algum valor cair, a extrusora RETRAI no meio
    // da peça — falha grave e invisível no software.
    const { gcode } = generateGcode(plan, { ...DEFAULT_PROFILE, retractionMm: 0 }, SETTINGS);
    const values = [...gcode.matchAll(/ E([\d.]+)/g)].map((m) => Number(m[1]));
    expect(values.length).toBeGreaterThan(10);
    for (let i = 1; i < values.length; i++) {
      expect(values[i], `E caiu em ${i}`).toBeGreaterThanOrEqual(values[i - 1]!);
    }
  });

  it("deslocamento em vazio (G0) nunca leva E", () => {
    // G0 com E extruda enquanto se move no ar — deixa fio atravessado na peça.
    const { gcode } = generateGcode(plan, DEFAULT_PROFILE, SETTINGS);
    for (const line of gcode.split("\n")) {
      if (line.startsWith("G0 ")) expect(line, line).not.toMatch(/ E[\d.]/);
    }
  });

  it("primeira camada usa a velocidade e a altura de primeira camada", () => {
    const { gcode } = generateGcode(plan, DEFAULT_PROFILE, SETTINGS);
    const layer0 = gcode.slice(gcode.indexOf(";LAYER:0"), gcode.indexOf(";LAYER:1"));
    // 20 mm/s × 60 = 1200 mm/min
    expect(layer0).toContain("F1200");
  });

  it("o perímetro fecha o laço (volta ao primeiro ponto)", () => {
    const { gcode } = generateGcode(
      [{ z: 0.3, perimeters: [SQUARE], infill: [] }],
      DEFAULT_PROFILE,
      SETTINGS,
    );
    const moves = [...gcode.matchAll(/G1 F\d+ X([\d.-]+) Y([\d.-]+)/g)].map((m) => ({
      x: Number(m[1]), y: Number(m[2]),
    }));
    expect(moves.at(-1)).toEqual({ x: 0, y: 0 });
  });

  it("estimativas são positivas e coerentes", () => {
    const r = generateGcode(plan, DEFAULT_PROFILE, SETTINGS);
    expect(r.filamentMm).toBeGreaterThan(0);
    expect(r.filamentGrams).toBeGreaterThan(0);
    expect(r.estimatedSeconds).toBeGreaterThan(0);
    expect(r.layerCount).toBe(2);
    // Coerência: gramas tem de bater com o mm pela mesma fórmula.
    expect(r.filamentGrams).toBeCloseTo(filamentGrams(r.filamentMm, 1.75, 1.24), 6);
  });

  it("plano vazio gera G-code válido, sem NaN", () => {
    const r = generateGcode([], DEFAULT_PROFILE, SETTINGS);
    expect(r.gcode).toContain("G28");
    expect(r.filamentMm).toBe(0);
    expect(r.gcode).not.toContain("NaN");
  });

  it("nenhum NaN em nenhuma coordenada", () => {
    const { gcode } = generateGcode(plan, DEFAULT_PROFILE, SETTINGS);
    expect(gcode).not.toContain("NaN");
    expect(gcode).not.toContain("undefined");
  });
});

describe("integração — cubo fatiado vira G-code", () => {
  it("do STL ao G-code, com número de camadas coerente", () => {
    const v: Array<[number, number, number]> = [
      [0, 0, 0], [20, 0, 0], [20, 20, 0], [0, 20, 0],
      [0, 0, 10], [20, 0, 10], [20, 20, 10], [0, 20, 10],
    ];
    const quads: Array<[number, number, number, number]> = [
      [0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
    ];
    const tris: number[] = [];
    for (const [a, b, c, d] of quads) {
      tris.push(...v[a]!, ...v[b]!, ...v[c]!, ...v[a]!, ...v[c]!, ...v[d]!);
    }

    const layers = sliceMesh(new Float32Array(tris), { layerHeight: 0.2, firstLayerHeight: 0.3 });
    const plan = layers.map((layer, i) => ({
      z: layer.z,
      perimeters: layer.contours,
      infill: generateInfill(layer.contours, {
        densityPct: 15, lineWidth: 0.4, pattern: "grade", angleDeg: i % 2 ? 45 : 0,
      }),
    }));

    const r = generateGcode(plan, DEFAULT_PROFILE, SETTINGS);
    expect(r.layerCount).toBeGreaterThan(40);
    expect(r.filamentGrams).toBeGreaterThan(0.5);
    expect(r.filamentGrams).toBeLessThan(50); // sanidade: cubo de 20 mm com 15%
    expect(r.gcode.split("\n").length).toBeGreaterThan(500);
  });
});

describe("formatDuration", () => {
  it.each([
    [3725, "1 h 02 min"],
    [600, "10 min"],
    [45, "45 s"],
    [0, "0 s"],
  ])("%i s → %s", (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });

  it("negativo não vira texto estranho", () => {
    expect(formatDuration(-10)).toBe("0 s");
  });
});
