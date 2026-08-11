import { describe, it, expect } from "vitest";

import { sliceToPlan, DEFAULT_SLICE_SETTINGS, type SliceSettings } from "./pipeline";
import { regionArea } from "./perimeters";
import { generateGcode, DEFAULT_PROFILE } from "./gcode";

/**
 * O pipeline é onde as peças se encontram. Erro aqui não aparece em nenhum
 * módulo isolado — só na peça impressa.
 */

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

const CUBE_20 = new Float32Array(box([0, 0, 0], [20, 20, 10]));
const settings: SliceSettings = { ...DEFAULT_SLICE_SETTINGS, topBottomLayers: 2 };

describe("sliceToPlan — geometria", () => {
  const r = sliceToPlan(CUBE_20, settings);

  it("fatia sem contorno aberto", () => {
    expect(r.openContourCount).toBe(0);
    expect(r.layers.length).toBeGreaterThan(40);
  });

  it("toda camada tem parede", () => {
    expect(r.layersWithoutWalls).toBe(0);
  });

  it("a parede EXTERNA sai meia largura para dentro do modelo", () => {
    // A prova de que a peça sai na medida: o caminho fica em 0,2, e a borda
    // externa do filete (0,2 de meia largura) cai exatamente em 0.
    const camada = r.layers[10]!;
    const contours = camada.perimeters.map((p) => (Array.isArray(p) ? p : p.contour));
    const xs = contours.flat().map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(0.2, 2);
    expect(Math.max(...xs)).toBeCloseTo(19.8, 2);
  });

  it("a parede externa é a ÚLTIMA a ser impressa", () => {
    // Imprimir a externa por último dá acabamento melhor: ela não é empurrada
    // pelas paredes internas depositadas depois. `perimeters` é uma lista de
    // CONTORNOS, então o primeiro elemento é a parede mais interna.
    const camada = r.layers[10]!;
    const contours = camada.perimeters.map((p) => (Array.isArray(p) ? p : p.contour));
    const minX = (c: { x: number }[]) => Math.min(...c.map((p) => p.x));
    const primeira = minX(contours[0]!);
    const ultima = minX(contours[contours.length - 1]!);
    expect(ultima).toBeLessThan(primeira);
  });
});

describe("sliceToPlan — camadas sólidas", () => {
  const r = sliceToPlan(CUBE_20, settings);

  it("as primeiras camadas são sólidas (base)", () => {
    // Nada abaixo = tudo exposto = sólido.
    expect(regionArea(r.layers[0]!.solidRegion)).toBeGreaterThan(200);
  });

  it("as últimas camadas são sólidas (topo)", () => {
    const ultima = r.layers[r.layers.length - 1]!;
    expect(regionArea(ultima.solidRegion)).toBeGreaterThan(200);
  });

  it("o MIOLO não é sólido", () => {
    // Se o meio saísse sólido, a peça viraria um bloco maciço e o preenchimento
    // de 15% não teria efeito nenhum.
    const meio = r.layers[Math.floor(r.layers.length / 2)]!;
    expect(regionArea(meio.solidRegion)).toBeCloseTo(0, 1);
  });

  it("camada sólida gasta mais material que camada de miolo", () => {
    const comprimento = (linhas: { from: { x: number; y: number }; to: { x: number; y: number } }[]) =>
      linhas.reduce((s, l) => s + Math.hypot(l.to.x - l.from.x, l.to.y - l.from.y), 0);
    const base = comprimento(r.layers[0]!.infill);
    const meio = comprimento(r.layers[Math.floor(r.layers.length / 2)]!.infill);
    expect(base).toBeGreaterThan(meio * 2);
  });

  it("topBottomLayers = 0 desliga o sólido", () => {
    const semSolido = sliceToPlan(CUBE_20, { ...settings, topBottomLayers: 0 });
    for (const l of semSolido.layers) expect(l.solidRegion).toEqual([]);
  });
});

describe("sliceToPlan — casos degenerados", () => {
  it("malha vazia devolve plano vazio", () => {
    const r = sliceToPlan(new Float32Array(0), settings);
    expect(r.layers).toEqual([]);
    expect(r.openContourCount).toBe(0);
  });

  it("peça mais fina que o bico não gera parede, e isso é reportado", () => {
    // Placa de 0,3 mm de espessura em x: nem uma parede cabe.
    const fina = new Float32Array(box([0, 0, 0], [0.3, 20, 5]));
    const r = sliceToPlan(fina, settings);
    expect(r.layersWithoutWalls).toBeGreaterThan(0);
  });

  it("zero paredes não quebra o plano", () => {
    const r = sliceToPlan(CUBE_20, { ...settings, wallCount: 0 });
    expect(r.layers.length).toBeGreaterThan(0);
    for (const l of r.layers) expect(l.perimeters).toEqual([]);
  });
});

describe("pipeline → G-code", () => {
  it("gera G-code válido do plano completo", () => {
    const r = sliceToPlan(CUBE_20, settings);
    const g = generateGcode(r.layers, DEFAULT_PROFILE, {
      layerHeight: settings.layerHeight,
      firstLayerHeight: settings.firstLayerHeight,
      lineWidth: settings.lineWidth,
      filamentDensity: 1.24,
    });

    expect(g.gcode).not.toContain("NaN");
    expect(g.filamentGrams).toBeGreaterThan(0);
    expect(g.layerCount).toBe(r.layers.length);

    const gNoRetract = generateGcode(r.layers, { ...DEFAULT_PROFILE, retractionMm: 0 }, {
      layerHeight: settings.layerHeight,
      firstLayerHeight: settings.firstLayerHeight,
      lineWidth: settings.lineWidth,
      filamentDensity: 1.24,
    });
    const es = [...gNoRetract.gcode.matchAll(/ E([\d.]+)/g)].map((m) => Number(m[1]));
    for (let i = 1; i < es.length; i++) expect(es[i]).toBeGreaterThanOrEqual(es[i - 1]!);
  });

  it("mais paredes consomem mais filamento", () => {
    const settingsFor = (wallCount: number) => ({ ...settings, wallCount });
    const gramas = (wallCount: number) => {
      const r = sliceToPlan(CUBE_20, settingsFor(wallCount));
      return generateGcode(r.layers, DEFAULT_PROFILE, {
        layerHeight: 0.2, firstLayerHeight: 0.3, lineWidth: 0.4, filamentDensity: 1.24,
      }).filamentGrams;
    };
    expect(gramas(4)).toBeGreaterThan(gramas(1));
  });
});

describe("suportes ligados no pipeline e no G-code", () => {
  /** Peça em T: haste fina embaixo, tampo largo em cima — precisa de suporte. */
  const T = new Float32Array([
    ...box([8, 8, 0], [12, 12, 6]),
    ...box([0, 0, 6], [20, 20, 8]),
  ]);

  it("desligado por padrão, e nenhum percurso de suporte aparece", () => {
    const r = sliceToPlan(T, settings);
    expect(settings.supportsEnabled).toBe(false);
    expect(r.supportVolumeCm3).toBe(0);
    expect(r.layers.every((l) => !l.supports || l.supports.length === 0)).toBe(true);
  });

  it("ligado, gera suporte sob o balanço", () => {
    const r = sliceToPlan(T, { ...settings, supportsEnabled: true });
    expect(r.supportVolumeCm3).toBeGreaterThan(0);
    expect(r.layers.some((l) => (l.supports?.length ?? 0) > 0)).toBe(true);
  });

  it("o suporte vira ;TYPE:SUPPORT no G-code", () => {
    // O comentário é o que faz o visualizador colorir o suporte à parte, e o que
    // permite a impressora/pós-processador tratá-lo diferente.
    const r = sliceToPlan(T, { ...settings, supportsEnabled: true });
    const g = generateGcode(r.layers, DEFAULT_PROFILE, {
      layerHeight: 0.2, firstLayerHeight: 0.3, lineWidth: 0.4, filamentDensity: 1.24,
    });
    expect(g.gcode).toContain(";TYPE:SUPPORT");
    expect(g.gcode).not.toContain("NaN");
  });

  it("suporte consome filamento a mais", () => {
    const gramas = (supportsEnabled: boolean) => {
      const r = sliceToPlan(T, { ...settings, supportsEnabled });
      return generateGcode(r.layers, DEFAULT_PROFILE, {
        layerHeight: 0.2, firstLayerHeight: 0.3, lineWidth: 0.4, filamentDensity: 1.24,
      }).filamentGrams;
    };
    expect(gramas(true)).toBeGreaterThan(gramas(false));
  });

  it("ângulo permissivo gera menos suporte que ângulo conservador", () => {
    const volume = (deg: number) =>
      sliceToPlan(T, { ...settings, supportsEnabled: true, supportMaxOverhangDeg: deg })
        .supportVolumeCm3;
    expect(volume(80)).toBeLessThanOrEqual(volume(20));
  });

  it("peça sem balanço não gera suporte mesmo com a opção ligada", () => {
    // Cubo reto: nada em balanço, nada a apoiar.
    const r = sliceToPlan(CUBE_20, { ...settings, supportsEnabled: true });
    expect(r.supportVolumeCm3).toBeCloseTo(0, 3);
  });

  it("E continua monotônico com suporte", () => {
    const r = sliceToPlan(T, { ...settings, supportsEnabled: true });
    const g = generateGcode(r.layers, { ...DEFAULT_PROFILE, retractionMm: 0 }, {
      layerHeight: 0.2, firstLayerHeight: 0.3, lineWidth: 0.4, filamentDensity: 1.24,
    });
    const es = [...g.gcode.matchAll(/ E([\d.]+)/g)].map((m) => Number(m[1]));
    for (let i = 1; i < es.length; i++) expect(es[i]).toBeGreaterThanOrEqual(es[i - 1]!);
  });
});

describe("sliceToPlan — perímetros rotulados", () => {
  const r = sliceToPlan(CUBE_20, { ...settings, wallCount: 3 });

  it("todo perímetro sai rotulado, nenhum como contorno cru", () => {
    for (const layer of r.layers) {
      for (const p of layer.perimeters) {
        expect(Array.isArray(p)).toBe(false);
        expect(["externa", "interna"]).toContain(
          Array.isArray(p) ? "externa" : (p.kind ?? "externa"),
        );
      }
    }
  });

  it("a parede EXTERNA é a última da camada — é a que se vê", () => {
    const layer = r.layers[10]!;
    const kinds = layer.perimeters.map((p) => (Array.isArray(p) ? "externa" : p.kind));
    expect(kinds.at(-1)).toBe("externa");
    expect(kinds[0]).toBe("interna");
  });

  it("com 3 paredes há exatamente uma externa por ilha", () => {
    const layer = r.layers[10]!;
    const externas = layer.perimeters.filter((p) => !Array.isArray(p) && p.kind === "externa");
    expect(externas).toHaveLength(1);
    expect(layer.perimeters).toHaveLength(3);
  });

  it("a externa é a MAIOR — as internas ficam por dentro dela", () => {
    const layer = r.layers[10]!;
    const areaOf = (p: (typeof layer.perimeters)[number]) =>
      regionArea([Array.isArray(p) ? p : p.contour]);
    const externa = layer.perimeters.find((p) => !Array.isArray(p) && p.kind === "externa")!;
    const internas = layer.perimeters.filter((p) => !Array.isArray(p) && p.kind === "interna");
    for (const interna of internas) expect(areaOf(externa)).toBeGreaterThan(areaOf(interna));
  });

  it("o G-code rotula as duas", () => {
    const g = generateGcode(r.layers, DEFAULT_PROFILE, {
      layerHeight: 0.2, firstLayerHeight: 0.3, lineWidth: 0.4, filamentDensity: 1.24,
    });
    expect(g.gcode).toContain(";TYPE:WALL-OUTER");
    expect(g.gcode).toContain(";TYPE:WALL-INNER");
  });
});

describe("sliceToPlan — aderência", () => {
  it("skirt e brim só existem na primeira camada", () => {
    const r = sliceToPlan(CUBE_20, { ...settings, skirtLoops: 2, brimWidthMm: 2 });
    expect(r.layers[0]!.skirt?.length).toBe(2);
    expect(r.layers[0]!.brim?.length).toBe(5); // ceil(2 / 0.4)
    for (const layer of r.layers.slice(1)) {
      expect(layer.skirt).toBeUndefined();
      expect(layer.brim).toBeUndefined();
    }
  });

  it("desligados por padrão de brim e com 0 laços de skirt", () => {
    const r = sliceToPlan(CUBE_20, { ...settings, skirtLoops: 0, brimWidthMm: 0 });
    expect(r.layers[0]!.skirt).toBeUndefined();
    expect(r.layers[0]!.brim).toBeUndefined();
  });

  it("o skirt fica FORA do brim, não em cima dele", () => {
    // A folga do skirt é medida a partir da borda do brim. Medir a partir da
    // peça faria o skirt nascer dentro do brim sempre que o brim fosse mais
    // largo que a folga — que é o caso aqui (brim 4 mm, folga 1 mm).
    const r = sliceToPlan(CUBE_20, {
      ...settings, skirtLoops: 1, skirtGapMm: 1, brimWidthMm: 4,
    });
    const maxX = (loops: { x: number }[][]) =>
      Math.max(...loops.flat().map((p) => p.x));
    expect(maxX(r.layers[0]!.skirt!)).toBeGreaterThan(maxX(r.layers[0]!.brim!));
  });

  it("aderência aumenta o filamento, e some quando desligada", () => {
    const base = sliceToPlan(CUBE_20, { ...settings, skirtLoops: 0, brimWidthMm: 0 });
    const com = sliceToPlan(CUBE_20, { ...settings, skirtLoops: 2, brimWidthMm: 3 });
    const opts = {
      layerHeight: 0.2, firstLayerHeight: 0.3, lineWidth: 0.4, filamentDensity: 1.24,
    };
    const a = generateGcode(base.layers, DEFAULT_PROFILE, opts);
    const b = generateGcode(com.layers, DEFAULT_PROFILE, opts);
    expect(b.filamentMm).toBeGreaterThan(a.filamentMm);
  });
});
