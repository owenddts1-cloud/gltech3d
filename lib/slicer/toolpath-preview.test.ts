/**
 * O empacotamento do percurso para o preview 3D.
 *
 * O que estes testes protegem é desempenho e honestidade da tela: se os
 * segmentos não saírem ordenados por camada, a faixa visível deixa de ser uma
 * fatia contígua e o preview passa a reconstruir o buffer a cada arrastada — que
 * é exatamente o que trava a aba numa peça de 800 camadas. E se um percurso cair
 * no tipo errado, a tela mostra parede onde é suporte.
 */

import { describe, expect, it } from "vitest";

import {
  buildToolpathBuffers,
  drawRangeFor,
  TOOLPATH_KINDS,
  TOOLPATH_LABELS,
} from "./toolpath-preview";
import type { LayerPlan } from "./gcode";

const quadrado = (lado: number) => [
  { x: 0, y: 0 }, { x: lado, y: 0 }, { x: lado, y: lado }, { x: 0, y: lado },
];

const linha = (x0: number, y0: number, x1: number, y1: number) => ({
  from: { x: x0, y: y0 },
  to: { x: x1, y: y1 },
});

const camada = (z: number, over: Partial<LayerPlan> = {}): LayerPlan => ({
  z,
  perimeters: [{ contour: quadrado(10), kind: "externa" }],
  infill: [linha(1, 1, 9, 9)],
  ...over,
});

describe("buildToolpathBuffers", () => {
  it("um contorno FECHADO vira tantos segmentos quantos vértices", () => {
    // O último ponto liga de volta no primeiro. Esquecer isso deixa a parede com
    // uma fresta na tela que não existe na peça.
    const b = buildToolpathBuffers([camada(0.2)]);
    expect(b.externa.segments).toBe(4);
  });

  it("separa parede externa de interna", () => {
    const b = buildToolpathBuffers([
      camada(0.2, {
        perimeters: [
          { contour: quadrado(10), kind: "externa" },
          { contour: quadrado(9), kind: "interna" },
        ],
      }),
    ]);
    expect(b.externa.segments).toBe(4);
    expect(b.interna.segments).toBe(4);
  });

  it("perímetro sem rótulo conta como externa", () => {
    // O tipo aceita `Contour` cru por compatibilidade. Cair em "interna" por
    // omissão apagaria a parede que se vê na peça.
    const b = buildToolpathBuffers([camada(0.2, { perimeters: [quadrado(10)] })]);
    expect(b.externa.segments).toBe(4);
    expect(b.interna.segments).toBe(0);
  });

  it("cada percurso cai no seu tipo", () => {
    const b = buildToolpathBuffers([
      camada(0.2, {
        bridges: [linha(0, 0, 5, 0), linha(0, 1, 5, 1)],
        ironing: [linha(0, 2, 5, 2)],
        supports: [linha(0, 3, 5, 3), linha(0, 4, 5, 4), linha(0, 5, 5, 5)],
        skirt: [quadrado(14)],
        brim: [quadrado(12)],
      }),
    ]);
    expect(b.ponte.segments).toBe(2);
    expect(b.alisamento.segments).toBe(1);
    expect(b.suporte.segments).toBe(3);
    expect(b.preenchimento.segments).toBe(1);
    expect(b.aderencia.segments).toBe(8); // skirt (4) + brim (4)
  });

  it("camada de RAFT vira aderência, não peça", () => {
    // Pintar o raft de laranja faria parecer que a peça começa embaixo do que
    // vai para o lixo.
    const b = buildToolpathBuffers([camada(0.2, { isRaft: true })]);
    expect(b.externa.segments).toBe(0);
    expect(b.preenchimento.segments).toBe(0);
    expect(b.aderencia.segments).toBe(5); // 4 do contorno + 1 do preenchimento
  });

  it("o Z de cada segmento é o Z da sua camada", () => {
    const b = buildToolpathBuffers([camada(0.2), camada(0.4), camada(0.6)]);
    const zs = new Set<number>();
    for (let i = 2; i < b.externa.positions.length; i += 3) {
      zs.add(Number(b.externa.positions[i]!.toFixed(4)));
    }
    expect([...zs].sort()).toEqual([0.2, 0.4, 0.6]);
  });

  it("os segmentos saem ORDENADOS por camada", () => {
    // É o que faz a faixa visível ser uma fatia contígua — e a troca de faixa,
    // um `setDrawRange` em vez de reconstruir o buffer.
    const b = buildToolpathBuffers([camada(0.2), camada(0.4), camada(0.6)]);
    let anterior = -Infinity;
    for (let i = 2; i < b.externa.positions.length; i += 3) {
      const z = b.externa.positions[i]!;
      expect(z).toBeGreaterThanOrEqual(anterior);
      anterior = z;
    }
  });

  it("layerOffsets tem uma posição a mais e termina no total", () => {
    const b = buildToolpathBuffers([camada(0.2), camada(0.4)]);
    expect(b.externa.layerOffsets).toHaveLength(3);
    expect(b.externa.layerOffsets[2]).toBe(b.externa.segments * 2);
  });

  it("todo tipo existe no resultado, mesmo vazio", () => {
    // A tela lista os tipos para ligar e desligar. Um tipo ausente viraria
    // `undefined` no meio do render.
    const b = buildToolpathBuffers([camada(0.2)]);
    for (const k of TOOLPATH_KINDS) {
      expect(b[k]).toBeDefined();
      expect(b[k].layerOffsets).toHaveLength(2);
    }
  });

  it("lista vazia não quebra", () => {
    const b = buildToolpathBuffers([]);
    expect(b.externa.segments).toBe(0);
    expect(b.externa.layerOffsets).toHaveLength(1);
  });

  it("contorno com menos de 2 pontos é ignorado", () => {
    const b = buildToolpathBuffers([
      camada(0.2, { perimeters: [[{ x: 0, y: 0 }]], infill: [] }),
    ]);
    expect(b.externa.segments).toBe(0);
  });
});

describe("drawRangeFor", () => {
  const buffers = () => buildToolpathBuffers([camada(0.2), camada(0.4), camada(0.6)]);

  it("a faixa inteira cobre todos os segmentos", () => {
    const b = buffers().externa;
    expect(drawRangeFor(b, 0, 2)).toEqual({ start: 0, count: b.segments * 2 });
  });

  it("uma camada só devolve os vértices dela", () => {
    const b = buffers().externa;
    expect(drawRangeFor(b, 1, 1)).toEqual({ start: 8, count: 8 });
  });

  it("faixa invertida é corrigida em vez de devolver count negativo", () => {
    // O three.js aceita `count` negativo e desenha lixo na tela, sem erro.
    const b = buffers().externa;
    expect(drawRangeFor(b, 2, 0)).toEqual(drawRangeFor(b, 0, 2));
  });

  it("índice fora da faixa é preso nos limites", () => {
    const b = buffers().externa;
    expect(drawRangeFor(b, -5, 99)).toEqual({ start: 0, count: b.segments * 2 });
  });

  it("buffer vazio devolve count 0", () => {
    expect(drawRangeFor(buildToolpathBuffers([]).externa, 0, 0)).toEqual({ start: 0, count: 0 });
  });

  it("tipo sem nenhum segmento devolve count 0 em qualquer faixa", () => {
    expect(drawRangeFor(buffers().ponte, 0, 2)).toEqual({ start: 0, count: 0 });
  });
});

describe("rótulos", () => {
  it("todo tipo tem cor e nome", () => {
    for (const k of TOOLPATH_KINDS) {
      expect(TOOLPATH_LABELS[k].label.length).toBeGreaterThan(0);
      expect(TOOLPATH_LABELS[k].color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("as cores são distintas entre si", () => {
    // Duas iguais tornariam a legenda inútil justamente onde ela importa.
    const cores = TOOLPATH_KINDS.map((k) => TOOLPATH_LABELS[k].color.toLowerCase());
    expect(new Set(cores).size).toBe(cores.length);
  });
});
