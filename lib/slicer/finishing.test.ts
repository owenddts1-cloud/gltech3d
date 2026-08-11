/**
 * Acabamento do fatiador: z-hop, ponte, alisamento, raft e altura variável.
 *
 * Integração de verdade — malha entra, G-code sai. Cada recurso tem de provar
 * três coisas: que faz efeito quando ligado, que não faz nada quando desligado,
 * e que não estraga o material depositado.
 */

import { describe, expect, it } from "vitest";

import { sliceToPlan, DEFAULT_SLICE_SETTINGS, type SliceSettings } from "./pipeline";
import { generateGcode, DEFAULT_PROFILE, type PrintSettings } from "./gcode";

function box(
  [x0, y0, z0]: [number, number, number],
  [x1, y1, z1]: [number, number, number],
): number[] {
  const v: Array<[number, number, number]> = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const quads: Array<[number, number, number, number]> = [
    [0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
  ];
  const out: number[] = [];
  for (const [a, b, c, d] of quads) {
    out.push(...v[a]!, ...v[b]!, ...v[c]!, ...v[a]!, ...v[c]!, ...v[d]!);
  }
  return out;
}

const CUBE = new Float32Array(box([0, 0, 0], [20, 20, 10]));

/** Duas colunas e uma tampa ligando as duas: o vão do meio é ponte. */
const PONTE = new Float32Array([
  ...box([0, 0, 0], [6, 20, 10]),
  ...box([24, 0, 0], [30, 20, 10]),
  ...box([0, 0, 10], [30, 20, 13]),
]);

const settings: SliceSettings = { ...DEFAULT_SLICE_SETTINGS, topBottomLayers: 2 };
const PRINT: PrintSettings = {
  layerHeight: 0.2,
  firstLayerHeight: 0.3,
  lineWidth: 0.4,
  filamentDensity: 1.24,
};

const emit = (s: SliceSettings, mesh = CUBE, print: PrintSettings = PRINT) =>
  generateGcode(sliceToPlan(mesh, s).layers, DEFAULT_PROFILE, print);

describe("z-hop", () => {
  const plan = sliceToPlan(CUBE, settings);

  it("levanta o bico junto da retração", () => {
    const g = generateGcode(plan.layers, { ...DEFAULT_PROFILE, zHopMm: 0.4 }, PRINT);
    const zs = (g.gcode.match(/^G0 Z[\d.]+$/gm) ?? []).length;
    // Mais G0 Z que camadas: os extras são o sobe-e-desce.
    expect(zs).toBeGreaterThan(plan.layers.length);
  });

  it("desligado, é exatamente um G0 Z por camada", () => {
    const g = generateGcode(plan.layers, { ...DEFAULT_PROFILE, zHopMm: 0 }, PRINT);
    expect((g.gcode.match(/^G0 Z[\d.]+$/gm) ?? []).length).toBe(plan.layers.length);
  });

  it("não muda o filamento — é movimento, não extrusão", () => {
    const sem = generateGcode(plan.layers, { ...DEFAULT_PROFILE, zHopMm: 0 }, PRINT);
    const com = generateGcode(plan.layers, { ...DEFAULT_PROFILE, zHopMm: 0.4 }, PRINT);
    expect(com.filamentMm).toBeCloseTo(sem.filamentMm, 9);
  });

  it("nunca extruda com o bico levantado", () => {
    // A invariante que importa do z-hop: se o bico subir e o arquivo extrudar
    // ali, o filete sai no ar. O `G0 Z` logo depois de `;LAYER:` é o Z da
    // camada; qualquer Z acima dele é hop, e extrusão nesse estado é defeito.
    const g = generateGcode(plan.layers, { ...DEFAULT_PROFILE, zHopMm: 0.4 }, PRINT);
    let z = 0;
    let layerZ = 0;
    let aguardandoZdaCamada = false;
    let extrusoes = 0;

    for (const line of g.gcode.split("\n")) {
      if (line.startsWith(";LAYER:")) {
        aguardandoZdaCamada = true;
        continue;
      }
      const zMatch = /^G0 Z([\d.]+)$/.exec(line);
      if (zMatch) {
        z = Number(zMatch[1]);
        if (aguardandoZdaCamada) {
          layerZ = z;
          aguardandoZdaCamada = false;
        }
        continue;
      }
      if (line.startsWith("G1 ") && line.includes(" X")) {
        expect(z).toBeCloseTo(layerZ, 6);
        extrusoes++;
      }
    }

    expect(extrusoes).toBeGreaterThan(100); // o laço realmente percorreu a peça
  });
});

describe("ponte", () => {
  it("detecta o vão entre as duas colunas", () => {
    expect(sliceToPlan(PONTE, { ...settings, bridgesEnabled: true }).bridgeLayerCount)
      .toBeGreaterThan(0);
  });

  it("desligada, nenhuma camada tem ponte", () => {
    const r = sliceToPlan(PONTE, { ...settings, bridgesEnabled: false });
    expect(r.bridgeLayerCount).toBe(0);
    expect(r.layers.every((l) => !l.bridges)).toBe(true);
  });

  it("peça maciça não inventa ponte", () => {
    expect(sliceToPlan(CUBE, { ...settings, bridgesEnabled: true }).bridgeLayerCount).toBe(0);
  });

  it("marca ;TYPE:BRIDGE e força a ventoinha ao máximo", () => {
    const g = emit({ ...settings, bridgesEnabled: true }, PONTE);
    expect(g.gcode).toContain(";TYPE:BRIDGE");
    expect(g.gcode).toContain("M106 S255");
  });

  it("não duplica material: a área da ponte sai do sólido normal", () => {
    const sem = emit({ ...settings, bridgesEnabled: false }, PONTE);
    const com = emit({ ...settings, bridgesEnabled: true }, PONTE);
    expect(com.filamentMm).toBeLessThan(sem.filamentMm * 1.15);
  });
});

describe("alisamento", () => {
  it("gera passada no topo quando ligado", () => {
    const r = sliceToPlan(CUBE, { ...settings, ironingEnabled: true });
    expect(r.layers.some((l) => (l.ironing?.length ?? 0) > 0)).toBe(true);
  });

  it("desligado por padrão", () => {
    expect(sliceToPlan(CUBE, settings).layers.every((l) => !l.ironing)).toBe(true);
  });

  it("gasta pouquíssimo material — é alisar, não preencher", () => {
    const sem = emit(settings);
    const com = emit({ ...settings, ironingEnabled: true });
    expect(com.filamentMm).toBeGreaterThan(sem.filamentMm);
    expect(com.filamentMm).toBeLessThan(sem.filamentMm * 1.1);
  });

  it("marca ;TYPE:IRONING", () => {
    expect(emit({ ...settings, ironingEnabled: true }).gcode).toContain(";TYPE:IRONING");
  });
});

describe("raft", () => {
  it("acrescenta as camadas pedidas na frente", () => {
    const r = sliceToPlan(CUBE, { ...settings, raftLayers: 3 });
    expect(r.raftLayerCount).toBe(3);
    expect(r.layers.slice(0, 3).every((l) => l.isRaft === true)).toBe(true);
    expect(r.layers[3]!.isRaft).toBeUndefined();
  });

  it("a peça sobe: a primeira camada dela fica acima do raft", () => {
    const base = sliceToPlan(CUBE, settings);
    const comRaft = sliceToPlan(CUBE, { ...settings, raftLayers: 2 });
    const primeira = comRaft.layers.find((l) => !l.isRaft)!;
    expect(primeira.z).toBeGreaterThan(base.layers[0]!.z);
  });

  it("o raft é MAIOR que a peça — a margem é o que o segura", () => {
    const r = sliceToPlan(CUBE, { ...settings, raftLayers: 1, raftMarginMm: 4 });
    const maxX = Math.max(
      ...r.layers[0]!.perimeters.flatMap((p) =>
        (Array.isArray(p) ? p : p.contour).map((q) => q.x),
      ),
    );
    expect(maxX).toBeGreaterThan(20);
  });

  it("skirt e brim descem para o raft — é ele que toca a mesa agora", () => {
    const r = sliceToPlan(CUBE, {
      ...settings, raftLayers: 2, skirtLoops: 1, brimWidthMm: 2,
    });
    expect(r.layers[0]!.skirt?.length).toBeGreaterThan(0);
    expect(r.layers.find((l) => !l.isRaft)!.skirt).toBeUndefined();
  });

  it("0 camadas não muda nada", () => {
    const r = sliceToPlan(CUBE, { ...settings, raftLayers: 0 });
    expect(r.raftLayerCount).toBe(0);
    expect(r.layers.every((l) => !l.isRaft)).toBe(true);
  });

  it("marca ;TYPE:RAFT e o arquivo continua são", () => {
    const g = emit({ ...settings, raftLayers: 2 });
    expect(g.gcode).toContain(";TYPE:RAFT");
    expect(g.gcode).not.toContain("NaN");
  });
});

describe("altura de camada variável", () => {
  it("cada camada carrega a própria espessura", () => {
    const r = sliceToPlan(CUBE, { ...settings, adaptiveLayers: true });
    expect(r.layers.every((l) => (l.thickness ?? 0) > 0)).toBe(true);
  });

  it("no cubo (só parede vertical) gasta menos camadas que a fina fixa", () => {
    const fino = sliceToPlan(CUBE, { ...settings, layerHeight: 0.08 });
    const adaptativo = sliceToPlan(CUBE, {
      ...settings, adaptiveLayers: true, minLayerHeight: 0.08, maxLayerHeight: 0.28,
    });
    expect(adaptativo.layers.length).toBeLessThan(fino.layers.length);
  });

  it("o E usa a espessura DA CAMADA, não a das configurações", () => {
    // Mesma volta, espessura tripla: tem de consumir o triplo. Se o emissor
    // usasse o valor fixo das configurações, os dois dariam igual — e a parede
    // sairia fina sem nenhum erro aparecer.
    const quadrado = [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ];
    const um = (thickness: number) =>
      generateGcode(
        [{ z: 1, thickness, perimeters: [{ contour: quadrado, kind: "externa" as const }], infill: [] }],
        DEFAULT_PROFILE,
        { ...PRINT, layerHeight: 0.1, firstLayerHeight: 0.1 },
      ).filamentMm;
    expect(um(0.3)).toBeCloseTo(um(0.1) * 3, 5);
  });

  it("desligada, o resultado não muda", () => {
    expect(sliceToPlan(CUBE, { ...settings, adaptiveLayers: false }).layers.length).toBe(
      sliceToPlan(CUBE, settings).layers.length,
    );
  });
});

describe("tudo ligado ao mesmo tempo", () => {
  it("continua sem contorno aberto, sem NaN e com material positivo", () => {
    const completo: SliceSettings = {
      ...settings,
      adaptiveLayers: true,
      raftLayers: 2,
      ironingEnabled: true,
      bridgesEnabled: true,
      skirtLoops: 1,
      brimWidthMm: 2,
      supportsEnabled: true,
      scarfLengthMm: 1,
      seamMode: "canto",
    };
    const r = sliceToPlan(PONTE, completo);
    const g = generateGcode(r.layers, DEFAULT_PROFILE, {
      ...PRINT, seamMode: "canto", scarfLengthMm: 1,
    });

    expect(r.openContourCount).toBe(0);
    expect(g.gcode).not.toContain("NaN");
    expect(g.gcode).not.toContain("undefined");
    expect(g.filamentMm).toBeGreaterThan(0);

    // E das extrusões continua monotônico com tudo ligado.
    const es = g.gcode
      .split("\n")
      .filter((l) => l.startsWith("G1 ") && l.includes(" X") && l.includes(" E"))
      .map((l) => Number(/ E(-?[\d.]+)/.exec(l)![1]));
    for (let i = 1; i < es.length; i++) expect(es[i]!).toBeGreaterThanOrEqual(es[i - 1]!);
  });
});
