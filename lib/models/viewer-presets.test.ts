import { describe, it, expect } from "vitest";

import {
  VIEW_MODES,
  MATERIAL_PRESETS,
  STUDIO_ANGLES,
  materialPresetById,
  cameraPoseFor,
  framingRadius,
  type StudioAngle,
} from "./viewer-presets";

describe("MATERIAL_PRESETS", () => {
  it("todo preset tem id único", () => {
    const ids = MATERIAL_PRESETS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("valores ficam nas faixas que o three aceita", () => {
    // Fora de [0,1] o three não avisa — só renderiza errado.
    for (const m of MATERIAL_PRESETS) {
      for (const [key, value] of [
        ["roughness", m.roughness], ["metalness", m.metalness],
        ["clearcoat", m.clearcoat], ["clearcoatRoughness", m.clearcoatRoughness],
        ["opacity", m.opacity], ["transmission", m.transmission],
      ] as const) {
        expect(value, `${m.id}.${key} = ${value}`).toBeGreaterThanOrEqual(0);
        expect(value, `${m.id}.${key} = ${value}`).toBeLessThanOrEqual(1);
      }
      expect(m.color, `${m.id} sem cor hex`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("fosco e argila não são metálicos", () => {
    // metalness alto com roughness alto vira cinza sujo, não plástico fosco.
    for (const id of ["filamento-fosco", "argila"] as const) {
      expect(materialPresetById(id).metalness).toBe(0);
    }
  });

  it("só o vidro é translúcido", () => {
    const translucidos = MATERIAL_PRESETS.filter((m) => m.opacity < 1 || m.transmission > 0);
    expect(translucidos.map((m) => m.id)).toEqual(["vidro"]);
  });

  it("id desconhecido cai no primeiro preset em vez de quebrar", () => {
    expect(materialPresetById("nao-existe" as never).id).toBe(MATERIAL_PRESETS[0]!.id);
  });
});

describe("VIEW_MODES", () => {
  it("cobre os cinco modos, com id único", () => {
    const ids = VIEW_MODES.map((v) => v.id);
    expect([...ids].sort()).toEqual(["matcap", "normals", "solid", "wireframe", "xray"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo modo tem rótulo e dica", () => {
    for (const v of VIEW_MODES) {
      expect(v.label.length).toBeGreaterThan(0);
      expect(v.hint.length).toBeGreaterThan(0);
    }
  });
});

describe("cameraPoseFor", () => {
  const ALL = STUDIO_ANGLES.map((a) => a.id);

  it("a câmera fica à distância pedida em todos os ângulos", () => {
    for (const angle of ALL) {
      const { position } = cameraPoseFor(angle, 100);
      const dist = Math.hypot(...position);
      expect(dist, `${angle} ficou a ${dist}`).toBeGreaterThan(50);
    }
  });

  // `-1 * 0` é `-0`, e `toEqual` usa Object.is, que distingue -0 de +0. Isso é
  // irrelevante para uma posição de câmera; normalizar evita um teste que falha
  // por um detalhe de ponto flutuante e não por comportamento.
  const noNegZero = (v: readonly number[]): number[] => v.map((n) => (n === 0 ? 0 : n));

  it("frente e costas são opostas", () => {
    const f = cameraPoseFor("frente", 100).position;
    const b = cameraPoseFor("costas", 100).position;
    expect(noNegZero(b)).toEqual(noNegZero(f.map((v) => -v)));
  });

  it("esquerda e direita são opostas", () => {
    const l = cameraPoseFor("esquerda", 100).position;
    const r = cameraPoseFor("direita", 100).position;
    expect(noNegZero(r)).toEqual(noNegZero(l.map((v) => -v)));
  });

  it("vista de topo NÃO usa up = +Y", () => {
    // Câmera em (0,d,0) olhando a origem tem direção paralela a +Y; se o `up`
    // também for +Y, a matriz de visão degenera e a tela fica preta.
    const topo = cameraPoseFor("topo", 100);
    expect(topo.up).not.toEqual([0, 1, 0]);
    const dir = topo.position.map((v) => -v);
    const dot = dir[0]! * topo.up[0]! + dir[1]! * topo.up[1]! + dir[2]! * topo.up[2]!;
    expect(Math.abs(dot), "up é paralelo à direção de visão").toBeLessThan(1e-6);
  });

  it("nenhum ângulo tem up paralelo à direção de visão", () => {
    for (const angle of ALL) {
      const { position, up } = cameraPoseFor(angle, 50);
      const len = Math.hypot(...position);
      const dir = position.map((v) => -v / len);
      const dot = Math.abs(dir[0]! * up[0]! + dir[1]! * up[1]! + dir[2]! * up[2]!);
      expect(dot, `${angle}: |dot| = ${dot}`).toBeLessThan(0.999);
    }
  });

  it("raio zero não coloca a câmera dentro do modelo", () => {
    for (const angle of ALL) {
      expect(Math.hypot(...cameraPoseFor(angle, 0).position)).toBeGreaterThan(0);
    }
  });

  it("é determinístico", () => {
    for (const angle of ALL as StudioAngle[]) {
      expect(cameraPoseFor(angle, 42)).toEqual(cameraPoseFor(angle, 42));
    }
  });
});

describe("framingRadius", () => {
  it("cresce com o tamanho do modelo", () => {
    expect(framingRadius(200)).toBeGreaterThan(framingRadius(100));
  });

  it("afasta mais em janela estreita (retrato)", () => {
    // Em tela mais alta que larga o limite é o horizontal; sem compensar, a peça
    // sai cortada nas laterais.
    expect(framingRadius(100, 45, 0.5)).toBeGreaterThan(framingRadius(100, 45, 1));
  });

  it("janela larga não afasta além do necessário", () => {
    expect(framingRadius(100, 45, 2)).toBeCloseTo(framingRadius(100, 45, 1), 5);
  });

  it("FOV maior aproxima a câmera", () => {
    expect(framingRadius(100, 75)).toBeLessThan(framingRadius(100, 30));
  });

  it("modelo de dimensão zero não devolve NaN", () => {
    expect(Number.isFinite(framingRadius(0))).toBe(true);
  });
});
