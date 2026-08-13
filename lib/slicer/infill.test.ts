/**
 * Os dois padrões novos — giroide e concêntrico.
 *
 * O erro que estes testes pegam não é estético: linha de preenchimento fora do
 * material vira filete no ar, que enrola no bico e arranca a peça da mesa. E
 * densidade que não responde ao ajuste faz o orçamento mentir, porque a
 * estimativa de filamento sai do comprimento total.
 */

import { describe, expect, it } from "vitest";

import {
  generateInfill,
  linesAreInsideMaterial,
  totalInfillLength,
  type InfillOptions,
} from "./infill";
import type { Contour } from "./slice";

const quadrado = (lado: number): Contour => [
  { x: 0, y: 0 }, { x: lado, y: 0 }, { x: lado, y: lado }, { x: 0, y: lado },
];

/** Quadrado com furo quadrado no meio — o furo é gravado ao contrário. */
const comFuro = (): Contour[] => [
  quadrado(40),
  [{ x: 15, y: 15 }, { x: 15, y: 25 }, { x: 25, y: 25 }, { x: 25, y: 15 }],
];

const opts = (over: Partial<InfillOptions> = {}): InfillOptions => ({
  densityPct: 15,
  lineWidth: 0.4,
  pattern: "giroide",
  angleDeg: 0,
  zMm: 1,
  ...over,
});

describe("giroide", () => {
  it("gera percurso", () => {
    expect(generateInfill([quadrado(40)], opts()).length).toBeGreaterThan(10);
  });

  it("TODA linha cai dentro do material", () => {
    const linhas = generateInfill([quadrado(40)], opts());
    expect(linesAreInsideMaterial(linhas, [quadrado(40)])).toBe(true);
  });

  it("respeita o furo — nada atravessa o vazio", () => {
    const regiao = comFuro();
    const linhas = generateInfill(regiao, opts({ densityPct: 25 }));
    expect(linhas.length).toBeGreaterThan(10);
    expect(linesAreInsideMaterial(linhas, regiao)).toBe(true);
  });

  it("mais densidade gasta mais filamento", () => {
    // É o que liga o ajuste ao orçamento: a estimativa sai deste comprimento.
    const curto = totalInfillLength(generateInfill([quadrado(40)], opts({ densityPct: 10 })));
    const longo = totalInfillLength(generateInfill([quadrado(40)], opts({ densityPct: 30 })));
    expect(longo).toBeGreaterThan(curto * 1.5);
  });

  it("o desenho MUDA com a altura — é uma superfície 3D, não um padrão 2D", () => {
    // Se não mudasse, seriam paredes verticais empilhadas: forte num eixo e
    // fraco nos outros, exatamente o que o giroide existe para evitar.
    const a = generateInfill([quadrado(40)], opts({ zMm: 0.4 }));
    const b = generateInfill([quadrado(40)], opts({ zMm: 3.6 }));
    const chave = (l: typeof a) =>
      l.map((s) => `${s.from.x.toFixed(2)},${s.from.y.toFixed(2)}`).join("|");
    expect(chave(a)).not.toBe(chave(b));
  });

  it("densidade 0 devolve peça oca", () => {
    expect(generateInfill([quadrado(40)], opts({ densityPct: 0 }))).toEqual([]);
  });

  it("região vazia não quebra", () => {
    expect(generateInfill([], opts())).toEqual([]);
  });

  it("nenhuma coordenada sai NaN", () => {
    // `acos` fora de [-1, 1] devolveria NaN e o G-code sairia com `X NaN`, que
    // a impressora interpreta como lixo.
    for (const z of [0, 0.2, 1.7, 5, 12.34]) {
      for (const linha of generateInfill([quadrado(40)], opts({ zMm: z }))) {
        for (const p of [linha.from, linha.to]) {
          expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        }
      }
    }
  });
});

describe("concêntrico", () => {
  it("gera laços dentro do material", () => {
    const linhas = generateInfill([quadrado(40)], opts({ pattern: "concentrico" }));
    expect(linhas.length).toBeGreaterThan(10);
    expect(linesAreInsideMaterial(linhas, [quadrado(40)])).toBe(true);
  });

  it("segue o furo em vez de atravessá-lo", () => {
    const regiao = comFuro();
    const linhas = generateInfill(regiao, opts({ pattern: "concentrico", densityPct: 20 }));
    expect(linesAreInsideMaterial(linhas, regiao)).toBe(true);
  });

  it("mais densidade = mais laços", () => {
    const curto = totalInfillLength(
      generateInfill([quadrado(40)], opts({ pattern: "concentrico", densityPct: 8 })),
    );
    const longo = totalInfillLength(
      generateInfill([quadrado(40)], opts({ pattern: "concentrico", densityPct: 24 })),
    );
    expect(longo).toBeGreaterThan(curto * 1.5);
  });

  it("termina — não fica em laço infinito com região minúscula", () => {
    // O offset de uma região degenerada pode não convergir. O teto de voltas é
    // o que impede a aba do fatiador de travar sem mensagem.
    const linhas = generateInfill([quadrado(0.3)], opts({ pattern: "concentrico" }));
    expect(Array.isArray(linhas)).toBe(true);
  });

  it("densidade 0 devolve peça oca", () => {
    expect(generateInfill([quadrado(40)], opts({ pattern: "concentrico", densityPct: 0 }))).toEqual([]);
  });
});
