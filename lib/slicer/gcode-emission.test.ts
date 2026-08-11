/**
 * Invariantes do G-code emitido: retração, ventoinha, aderência e rótulos.
 *
 * O que se testa aqui não é "o arquivo tem a linha X". É que os números batem —
 * porque G-code errado não dá erro nenhum no software, só sai da impressora
 * como peça ruim.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROFILE,
  fanValueFor,
  generateGcode,
  type LayerPlan,
  type PrinterProfile,
  type PrintSettings,
} from "./gcode";
import type { Contour } from "./slice";

const square = (size: number, offset = 0): Contour => [
  { x: offset, y: offset },
  { x: offset + size, y: offset },
  { x: offset + size, y: offset + size },
  { x: offset, y: offset + size },
];

const SETTINGS: PrintSettings = {
  layerHeight: 0.2,
  firstLayerHeight: 0.3,
  lineWidth: 0.4,
  filamentDensity: 1.24,
  seamMode: "alinhada",
  scarfLengthMm: 0,
};

/** Duas ilhas afastadas: garante saltos longos, que é o que dispara retração. */
function twoIslandLayers(count: number): LayerPlan[] {
  return Array.from({ length: count }, (_, i) => ({
    z: 0.3 + i * 0.2,
    perimeters: [
      { contour: square(10), kind: "interna" as const },
      { contour: square(10, 40), kind: "externa" as const },
    ],
    infill: [
      { from: { x: 1, y: 1 }, to: { x: 9, y: 9 } },
      { from: { x: 41, y: 41 }, to: { x: 49, y: 49 } },
    ],
  }));
}

/** Todos os valores de E das linhas de EXTRUSÃO (as que têm X). */
const extrusionEs = (gcode: string): number[] =>
  gcode
    .split("\n")
    .filter((l) => l.startsWith("G1 ") && l.includes(" X") && l.includes(" E"))
    .map((l) => Number(/ E(-?[\d.]+)/.exec(l)![1]));

/** Todos os valores de E, inclusive os das retrações (sem X). */
const allEs = (gcode: string): number[] =>
  gcode
    .split("\n")
    .filter((l) => l.startsWith("G1 ") && l.includes(" E"))
    .map((l) => Number(/ E(-?[\d.]+)/.exec(l)![1]));

const withProfile = (over: Partial<PrinterProfile>): PrinterProfile => ({
  ...DEFAULT_PROFILE,
  ...over,
});

describe("retração", () => {
  it("INVARIANTE: filamento consumido é idêntico com e sem retração", () => {
    // A que mais importa. Retração devolve material — não é consumo. Se o
    // acumulador de depósito e o eixo E fossem a mesma variável, ligar retração
    // mudaria o peso estimado da peça, e o custo sairia errado.
    const layers = twoIslandLayers(4);
    const sem = generateGcode(layers, withProfile({ retractionMm: 0 }), SETTINGS);
    const com = generateGcode(layers, withProfile({ retractionMm: 2 }), SETTINGS);

    expect(com.filamentMm).toBeCloseTo(sem.filamentMm, 9);
    expect(com.filamentGrams).toBeCloseTo(sem.filamentGrams, 9);
    expect(com.retractionCount).toBeGreaterThan(0);
    expect(sem.retractionCount).toBe(0);
  });

  it("E nunca fica negativo", () => {
    const result = generateGcode(twoIslandLayers(3), withProfile({ retractionMm: 5 }), SETTINGS);
    for (const e of allEs(result.gcode)) expect(e).toBeGreaterThanOrEqual(0);
  });

  it("E das extrusões é monotônico — a retração não conta como depósito", () => {
    const result = generateGcode(twoIslandLayers(3), DEFAULT_PROFILE, SETTINGS);
    const es = extrusionEs(result.gcode);
    expect(es.length).toBeGreaterThan(10);
    for (let i = 1; i < es.length; i++) expect(es[i]!).toBeGreaterThanOrEqual(es[i - 1]!);
  });

  it("toda retração é desfeita antes da próxima extrusão", () => {
    const gcode = generateGcode(twoIslandLayers(3), DEFAULT_PROFILE, SETTINGS).gcode;
    const lines = gcode.split("\n").filter((l) => l.startsWith("G1 ") && l.includes(" E"));

    let lastFullE = 0;
    let retracted = false;
    for (const line of lines) {
      const e = Number(/ E(-?[\d.]+)/.exec(line)![1]);
      const isMove = line.includes(" X");
      if (isMove) {
        // Extrudar retraído sairia oco: o bico precisa ter voltado ao valor cheio.
        expect(retracted).toBe(false);
        lastFullE = e;
      } else if (e < lastFullE) {
        expect(retracted).toBe(false); // nunca retrai duas vezes seguidas
        expect(lastFullE - e).toBeCloseTo(DEFAULT_PROFILE.retractionMm, 4);
        retracted = true;
      } else {
        expect(e).toBeCloseTo(lastFullE, 4); // reprime volta EXATAMENTE ao cheio
        retracted = false;
      }
    }
  });

  it("não retrai em salto curto", () => {
    // Um só quadrado: os únicos saltos são parede→preenchimento, todos curtos.
    const tiny: LayerPlan[] = [
      {
        z: 0.3,
        perimeters: [{ contour: square(2), kind: "externa" }],
        infill: [{ from: { x: 0.5, y: 0.5 }, to: { x: 1.5, y: 1.5 } }],
      },
    ];
    const result = generateGcode(tiny, withProfile({ retractionMinTravelMm: 50 }), SETTINGS);
    expect(result.retractionCount).toBe(0);
  });

  it("retração 0 não emite nenhuma linha de retração", () => {
    const result = generateGcode(twoIslandLayers(2), withProfile({ retractionMm: 0 }), SETTINGS);
    expect(result.retractionCount).toBe(0);
    const moves = result.gcode.split("\n").filter((l) => l.startsWith("G1 ") && l.includes(" E"));
    expect(moves.every((l) => l.includes(" X"))).toBe(true);
  });

  it("retrai no fim do arquivo, para o bico não pingar ao subir", () => {
    const result = generateGcode(twoIslandLayers(2), DEFAULT_PROFILE, SETTINGS);
    const lines = result.gcode.trimEnd().split("\n");
    const lastE = lines.filter((l) => l.startsWith("G1 ") && l.includes(" E")).at(-1)!;
    expect(lastE.includes(" X")).toBe(false); // é uma retração, não um movimento
  });

  it("retração aumenta o tempo estimado", () => {
    const layers = twoIslandLayers(4);
    const sem = generateGcode(layers, withProfile({ retractionMm: 0 }), SETTINGS);
    const com = generateGcode(layers, withProfile({ retractionMm: 2 }), SETTINGS);
    expect(com.estimatedSeconds).toBeGreaterThan(sem.estimatedSeconds);
  });
});

describe("ventoinha", () => {
  it("desligada nas camadas iniciais e cheia depois da rampa", () => {
    const profile = withProfile({ fanSpeedPct: 100, fanOffLayers: 1, fanFullAtLayer: 3 });
    expect(fanValueFor(0, profile)).toBe(0);
    expect(fanValueFor(1, profile)).toBeGreaterThan(0);
    expect(fanValueFor(1, profile)).toBeLessThan(255);
    expect(fanValueFor(3, profile)).toBe(255);
    expect(fanValueFor(50, profile)).toBe(255);
  });

  it("a rampa é monotônica", () => {
    const profile = withProfile({ fanOffLayers: 2, fanFullAtLayer: 8 });
    let previous = -1;
    for (let i = 0; i < 12; i++) {
      const value = fanValueFor(i, profile);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("respeita a porcentagem escolhida", () => {
    expect(fanValueFor(9, withProfile({ fanSpeedPct: 50, fanFullAtLayer: 2 }))).toBe(128);
    expect(fanValueFor(9, withProfile({ fanSpeedPct: 0 }))).toBe(0);
  });

  it("M107 na primeira camada, M106 depois — e só quando o valor muda", () => {
    const gcode = generateGcode(twoIslandLayers(8), DEFAULT_PROFILE, SETTINGS).gcode;
    const camadas = gcode.split(";LAYER:");

    expect(camadas[1]).toContain("M107");
    expect(camadas[1]).not.toContain("M106");
    expect(camadas[2]).toContain("M106 S");

    // Depois da rampa o valor para de mudar, então para de ser emitido.
    expect(camadas.at(-1)).not.toContain("M106");
  });

  it("M107 no cabeçalho e no rodapé", () => {
    const gcode = generateGcode(twoIslandLayers(2), DEFAULT_PROFILE, SETTINGS).gcode;
    const head = gcode.slice(0, gcode.indexOf(";LAYER:0"));
    expect(head).toContain("M107");
    expect(gcode.trimEnd().split("\n").join("\n")).toContain("M107 ; desliga a ventoinha");
  });
});

describe("rótulos de parede", () => {
  it("distingue parede externa de interna", () => {
    const gcode = generateGcode(twoIslandLayers(2), DEFAULT_PROFILE, SETTINGS).gcode;
    expect(gcode).toContain(";TYPE:WALL-INNER");
    expect(gcode).toContain(";TYPE:WALL-OUTER");
  });

  it("não repete o rótulo quando o tipo não muda", () => {
    const layers: LayerPlan[] = [
      {
        z: 0.3,
        perimeters: [
          { contour: square(10), kind: "interna" },
          { contour: square(10, 40), kind: "interna" },
        ],
        infill: [],
      },
    ];
    const gcode = generateGcode(layers, DEFAULT_PROFILE, SETTINGS).gcode;
    expect(gcode.split(";TYPE:WALL-INNER").length - 1).toBe(1);
  });
});

describe("aderência no G-code", () => {
  const layers = (): LayerPlan[] => [
    {
      z: 0.3,
      perimeters: [{ contour: square(10), kind: "externa" }],
      infill: [],
      skirt: [square(16, -3)],
      brim: [square(12, -1)],
    },
    { z: 0.5, perimeters: [{ contour: square(10), kind: "externa" }], infill: [] },
  ];

  it("emite skirt e brim, e só na primeira camada", () => {
    const gcode = generateGcode(layers(), DEFAULT_PROFILE, SETTINGS).gcode;
    const camadas = gcode.split(";LAYER:");
    expect(camadas[1]).toContain(";TYPE:SKIRT");
    expect(camadas[1]).toContain(";TYPE:BRIM");
    expect(camadas[2]).not.toContain(";TYPE:SKIRT");
    expect(camadas[2]).not.toContain(";TYPE:BRIM");
  });

  it("skirt e brim saem ANTES da parede da peça", () => {
    const gcode = generateGcode(layers(), DEFAULT_PROFILE, SETTINGS).gcode;
    expect(gcode.indexOf(";TYPE:SKIRT")).toBeLessThan(gcode.indexOf(";TYPE:BRIM"));
    expect(gcode.indexOf(";TYPE:BRIM")).toBeLessThan(gcode.indexOf(";TYPE:WALL-OUTER"));
  });

  it("consomem filamento — não são só comentário", () => {
    const com = generateGcode(layers(), DEFAULT_PROFILE, SETTINGS);
    const sem = generateGcode(
      layers().map((l) => ({ ...l, skirt: undefined, brim: undefined })),
      DEFAULT_PROFILE,
      SETTINGS,
    );
    expect(com.filamentMm).toBeGreaterThan(sem.filamentMm);
  });
});

describe("costura no G-code", () => {
  const layers = (): LayerPlan[] =>
    Array.from({ length: 4 }, (_, i) => ({
      z: 0.3 + i * 0.2,
      perimeters: [{ contour: square(10), kind: "externa" as const }],
      infill: [],
    }));

  it("`alinhada` faz toda camada começar no mesmo ponto", () => {
    const gcode = generateGcode(layers(), DEFAULT_PROFILE, {
      ...SETTINGS,
      seamMode: "alinhada",
    }).gcode;
    const blocos = gcode.split(";LAYER:").slice(1);
    const starts = blocos.map((b) => /G0 F\d+ (X[\d.-]+ Y[\d.-]+)/.exec(b)?.[1]);

    // Os deslocamentos que existem apontam todos para o mesmo lugar.
    expect(new Set(starts.filter(Boolean)).size).toBe(1);

    // E a maioria das camadas nem tem deslocamento: alinhada de verdade faz a
    // volta TERMINAR onde a próxima começa, e aí `emitTravel` não emite nada.
    // Foi isto que fez a primeira versão deste teste acusar dois pontos — o
    // segundo era `undefined`, não um ponto diferente.
    expect(starts.filter((s) => s === undefined).length).toBe(blocos.length - 1);
  });

  it("`proxima` também não desloca à toa numa peça de uma ilha só", () => {
    const gcode = generateGcode(layers(), DEFAULT_PROFILE, {
      ...SETTINGS,
      seamMode: "proxima",
    }).gcode;
    // Zero, na verdade: o bico parte de (0,0), que já é um vértice do quadrado,
    // e daí cada volta termina onde a próxima começa. `≤ 1` porque o que se
    // afirma é "não desloca à toa", não a contagem exata desta geometria.
    expect((gcode.match(/^G0 F\d+ X/gm) ?? []).length).toBeLessThanOrEqual(1);
  });

  it("`tras` começa no lado de maior Y", () => {
    const gcode = generateGcode(layers(), DEFAULT_PROFILE, { ...SETTINGS, seamMode: "tras" }).gcode;
    const first = /G0 F\d+ X([\d.-]+) Y([\d.-]+)/.exec(gcode.split(";LAYER:")[1]!)!;
    expect(Number(first[2])).toBe(10);
  });

  it("mudar a costura não muda o material depositado", () => {
    // Só o ponto de partida muda; o caminho é a mesma volta.
    const base = generateGcode(layers(), DEFAULT_PROFILE, { ...SETTINGS, seamMode: "alinhada" });
    for (const seamMode of ["canto", "tras", "proxima", "aleatoria"] as const) {
      const other = generateGcode(layers(), DEFAULT_PROFILE, { ...SETTINGS, seamMode });
      expect(other.filamentMm).toBeCloseTo(base.filamentMm, 6);
    }
  });

  it("CACHECOL: deposita o mesmo material que sem cachecol", () => {
    const sem = generateGcode(layers(), DEFAULT_PROFILE, { ...SETTINGS, scarfLengthMm: 0 });
    const com = generateGcode(layers(), DEFAULT_PROFILE, { ...SETTINGS, scarfLengthMm: 3 });
    expect(com.filamentMm).toBeCloseTo(sem.filamentMm, 6);
  });

  it("o cachecol alonga o caminho — anda mais que a volta", () => {
    const sem = generateGcode(layers(), DEFAULT_PROFILE, { ...SETTINGS, scarfLengthMm: 0 });
    const com = generateGcode(layers(), DEFAULT_PROFILE, { ...SETTINGS, scarfLengthMm: 3 });
    expect(com.estimatedSeconds).toBeGreaterThan(sem.estimatedSeconds);
  });

  it("cachecol NÃO é aplicado na parede interna", () => {
    const interna: LayerPlan[] = [
      { z: 0.3, perimeters: [{ contour: square(10), kind: "interna" }], infill: [] },
    ];
    const sem = generateGcode(interna, DEFAULT_PROFILE, { ...SETTINGS, scarfLengthMm: 0 });
    const com = generateGcode(interna, DEFAULT_PROFILE, { ...SETTINGS, scarfLengthMm: 3 });
    expect(com.gcode).toBe(sem.gcode);
  });
});

describe("saúde geral do arquivo", () => {
  it("sem NaN, sem undefined", () => {
    const gcode = generateGcode(twoIslandLayers(5), DEFAULT_PROFILE, {
      ...SETTINGS,
      scarfLengthMm: 2,
      seamMode: "canto",
    }).gcode;
    expect(gcode).not.toContain("NaN");
    expect(gcode).not.toContain("undefined");
    expect(gcode).not.toContain("Infinity");
  });

  it("aceita a forma antiga de perímetro (contorno cru) sem quebrar", () => {
    // Compatibilidade: `PerimeterPath` admite o `Contour` puro além do rotulado.
    const legacy = [{ z: 0.3, perimeters: [square(10)], infill: [] }] as LayerPlan[];
    const result = generateGcode(legacy, DEFAULT_PROFILE, SETTINGS);
    expect(result.filamentMm).toBeGreaterThan(0);
    expect(result.gcode).toContain(";TYPE:WALL-OUTER");
  });
});
