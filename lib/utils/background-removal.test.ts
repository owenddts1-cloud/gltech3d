import { describe, it, expect } from "vitest";

import { floodFillBackground } from "./background-removal";

/**
 * O algoritmo anterior amostrava um único pixel e apagava qualquer pixel claro da
 * imagem inteira — o que furava os brilhos da peça. Estes testes fixam a
 * propriedade que importa: só fundo **contíguo às bordas** é removido.
 *
 * `floodFillBackground` é pura sobre o array RGBA justamente para poder ser
 * testada aqui: o jsdom não implementa canvas 2D.
 */

const WHITE: [number, number, number] = [255, 255, 255];
const GOLD: [number, number, number] = [197, 130, 82];

/** Monta uma imagem `w×h` de fundo branco com um retângulo dourado no meio. */
function makeImage(w: number, h: number, paint: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const [r, g, b] = paint(x, y);
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
      data[p + 3] = 255;
    }
  }
  return data;
}

const alphaAt = (data: Uint8ClampedArray, w: number, x: number, y: number) => data[(y * w + x) * 4 + 3];

describe("floodFillBackground", () => {
  it("torna transparente o fundo contíguo e preserva a peça", () => {
    const w = 10;
    const h = 10;
    // Bloco dourado de (3,3) a (6,6).
    const inside = (x: number, y: number) => x >= 3 && x <= 6 && y >= 3 && y <= 6;
    const data = makeImage(w, h, (x, y) => (inside(x, y) ? GOLD : WHITE));

    const cleared = floodFillBackground(data, w, h, { tolerance: 30 });

    expect(cleared).toBe(w * h - 16);
    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, 9, 9)).toBe(0);
    expect(alphaAt(data, w, 4, 4)).toBe(255);
  });

  it("PRESERVA um brilho branco cercado pela peça", () => {
    // Este é o caso que o algoritmo antigo destruía: um pixel branco no meio de
    // uma rosa dourada tem a cor exata do fundo, mas não é fundo.
    const w = 11;
    const h = 11;
    const inside = (x: number, y: number) => x >= 2 && x <= 8 && y >= 2 && y <= 8;
    const highlight = (x: number, y: number) => x === 5 && y === 5;
    const data = makeImage(w, h, (x, y) => (highlight(x, y) ? WHITE : inside(x, y) ? GOLD : WHITE));

    floodFillBackground(data, w, h, { tolerance: 30 });

    expect(alphaAt(data, w, 5, 5)).toBe(255);
    expect(alphaAt(data, w, 0, 0)).toBe(0);
  });

  it("alcança fundo que entra por uma reentrância da borda", () => {
    // Semear só nos cantos não bastaria: aqui o fundo entra pela lateral.
    const w = 9;
    const h = 9;
    // Peça em C: coluna 3..7 exceto a faixa y=4 de x>=5, que fica de fundo.
    const isPiece = (x: number, y: number) => x >= 3 && x <= 7 && y >= 3 && y <= 5 && !(y === 4 && x >= 5);
    const data = makeImage(w, h, (x, y) => (isPiece(x, y) ? GOLD : WHITE));

    floodFillBackground(data, w, h, { tolerance: 30 });

    expect(alphaAt(data, w, 8, 4)).toBe(0);
    expect(alphaAt(data, w, 6, 4)).toBe(0);
    expect(alphaAt(data, w, 4, 4)).toBe(255);
  });

  it("tolerância zero não apaga nada", () => {
    const w = 4;
    const h = 4;
    const data = makeImage(w, h, () => WHITE);

    expect(floodFillBackground(data, w, h, { tolerance: 0 })).toBe(0);
    expect(alphaAt(data, w, 0, 0)).toBe(255);
  });

  it("não remove fundo que difere demais da referência dos cantos", () => {
    const w = 6;
    const h = 6;
    const data = makeImage(w, h, () => GOLD);

    // Cantos são dourados, então a referência é dourada e o limiar baixo não
    // alcança nada além dela própria — a imagem inteira é "fundo" aqui.
    const cleared = floodFillBackground(data, w, h, { tolerance: 5 });
    expect(cleared).toBe(w * h);
  });

  it("lida com dimensões degeneradas sem estourar", () => {
    expect(floodFillBackground(new Uint8ClampedArray(0), 0, 0, { tolerance: 30 })).toBe(0);
  });

  it("aplica alpha parcial na faixa de transição", () => {
    const w = 5;
    const h = 5;
    // Um anel de cor intermediária entre o fundo e a peça no centro.
    const MID: [number, number, number] = [235, 225, 215];
    const data = makeImage(w, h, (x, y) => (x === 2 && y === 2 ? GOLD : x >= 1 && x <= 3 && y >= 1 && y <= 3 ? MID : WHITE));

    floodFillBackground(data, w, h, { tolerance: 20, feather: 4 });

    const mid = alphaAt(data, w, 1, 1)!;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(255);
    // O feather não pode vazar para dentro: o centro segue opaco.
    expect(alphaAt(data, w, 2, 2)).toBe(255);
  });
});
