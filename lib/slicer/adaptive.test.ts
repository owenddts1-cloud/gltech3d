import { describe, expect, it } from "vitest";

import { DEFAULT_ADAPTIVE_OPTIONS, faceSpans, fixedLayerCount, layerSchedule } from "./adaptive";

const OPTS = { ...DEFAULT_ADAPTIVE_OPTIONS, firstLayerHeight: 0.2 };

/** Caixa fechada: só paredes verticais e duas tampas horizontais. */
function box(sx: number, sy: number, sz: number): Float32Array {
  const v: Array<[number, number, number]> = [
    [0, 0, 0], [sx, 0, 0], [sx, sy, 0], [0, sy, 0],
    [0, 0, sz], [sx, 0, sz], [sx, sy, sz], [0, sy, sz],
  ];
  const quads: Array<[number, number, number, number]> = [
    [0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
  ];
  const out: number[] = [];
  for (const [a, b, c, d] of quads) out.push(...v[a]!, ...v[b]!, ...v[c]!, ...v[a]!, ...v[c]!, ...v[d]!);
  return new Float32Array(out);
}

/** Rampa muito rasa: exige camada fina em toda a altura. */
function shallowRamp(): Float32Array {
  return new Float32Array([
    0, 0, 0, 100, 0, 0, 100, 10, 5,
    0, 0, 0, 100, 10, 5, 0, 10, 5,
  ]);
}

describe("faceSpans", () => {
  it("parede vertical tem horizontalidade 0; tampa tem 1", () => {
    const spans = faceSpans(box(10, 10, 10));
    const flats = spans.map((s) => s.flatness).sort((a, b) => a - b);
    expect(flats[0]).toBeCloseTo(0, 6);
    expect(flats.at(-1)).toBeCloseTo(1, 6);
  });

  it("ignora triângulo degenerado", () => {
    expect(faceSpans(new Float32Array([0, 0, 0, 1, 1, 1, 2, 2, 2]))).toHaveLength(0);
  });
});

describe("layerSchedule", () => {
  it("caixa: paredes verticais aceitam a camada mais grossa", () => {
    const schedule = layerSchedule(box(10, 10, 10), OPTS);
    // Fora da primeira e das que encostam nas tampas, tudo no teto.
    const grossas = schedule.filter((h) => Math.abs(h - OPTS.maxLayerHeight) < 1e-9);
    expect(grossas.length).toBeGreaterThan(schedule.length * 0.7);
  });

  it("rampa rasa: exige a camada mais fina", () => {
    const schedule = layerSchedule(shallowRamp(), OPTS);
    expect(schedule.length).toBeGreaterThan(1);
    // A rampa sobe 5 em 100: quase horizontal, |n_z| alto, degrau grande.
    for (const h of schedule.slice(1)) expect(h).toBeLessThan(OPTS.maxLayerHeight);
  });

  it("a primeira camada tem sempre a altura pedida", () => {
    expect(layerSchedule(box(10, 10, 10), { ...OPTS, firstLayerHeight: 0.25 })[0]).toBe(0.25);
  });

  it("respeita piso e teto da máquina", () => {
    for (const mesh of [box(10, 10, 10), shallowRamp(), box(3, 3, 40)]) {
      for (const h of layerSchedule(mesh, OPTS).slice(1)) {
        expect(h).toBeGreaterThanOrEqual(OPTS.minLayerHeight - 1e-9);
        expect(h).toBeLessThanOrEqual(OPTS.maxLayerHeight + 1e-9);
      }
    }
  });

  it("degrau menor exige mais camadas — é a troca que o parâmetro faz", () => {
    const grosso = layerSchedule(shallowRamp(), { ...OPTS, cuspMm: 0.2 });
    const fino = layerSchedule(shallowRamp(), { ...OPTS, cuspMm: 0.02 });
    expect(fino.length).toBeGreaterThan(grosso.length);
  });

  it("a soma cobre a altura da peça", () => {
    const total = layerSchedule(box(10, 10, 12), OPTS).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(12);
    expect(total).toBeLessThan(12 + OPTS.maxLayerHeight + 1e-6);
  });

  it("na caixa alta gasta MENOS camadas que a altura fixa fina", () => {
    const adaptativo = layerSchedule(box(10, 10, 30), OPTS).length;
    const fixo = fixedLayerCount(box(10, 10, 30), OPTS.minLayerHeight, OPTS.firstLayerHeight);
    expect(adaptativo).toBeLessThan(fixo);
  });

  it("entrada inválida devolve lista vazia em vez de laço infinito", () => {
    expect(layerSchedule(new Float32Array([]), OPTS)).toEqual([]);
    expect(layerSchedule(box(10, 10, 10), { ...OPTS, maxLayerHeight: 0 })).toEqual([]);
    expect(layerSchedule(box(10, 10, 10), { ...OPTS, minLayerHeight: 1, maxLayerHeight: 0.1 })).toEqual([]);
  });

  it("toda espessura é finita e positiva", () => {
    for (const h of layerSchedule(shallowRamp(), OPTS)) {
      expect(Number.isFinite(h)).toBe(true);
      expect(h).toBeGreaterThan(0);
    }
  });
});
