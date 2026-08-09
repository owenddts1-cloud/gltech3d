import { describe, it, expect } from "vitest";

import { reorder, sortForDisplay, type OrderableProduct } from "./order";

/**
 * Ordenação da vitrine. O risco aqui não é quebrar — é embaralhar a loja em
 * silêncio: gravar a posição errada não lança erro nenhum, só troca a ordem que
 * o cliente vê.
 */

const make = (...pairs: Array<[string, number | null]>): OrderableProduct[] =>
  pairs.map(([id, sortOrder]) => ({ id, sortOrder }));

const ids = (items: readonly OrderableProduct[]): string[] => items.map((i) => i.id);

describe("sortForDisplay", () => {
  it("ordena por sortOrder crescente", () => {
    expect(ids(sortForDisplay(make(["c", 3000], ["a", 1000], ["b", 2000])))).toEqual(["a", "b", "c"]);
  });

  it("nulos vão para o fim — mesmo critério do site", () => {
    // repository.ts usa `.order("sort_order", { nullsFirst: false })`. Divergir
    // aqui faria o editor mostrar uma ordem e a loja outra.
    expect(ids(sortForDisplay(make(["x", null], ["a", 1000])))).toEqual(["a", "x"]);
  });

  it("é estável em empate", () => {
    const items = make(["b", 1000], ["a", 1000]);
    expect(ids(sortForDisplay(items))).toEqual(["a", "b"]);
    expect(ids(sortForDisplay(items))).toEqual(ids(sortForDisplay(items)));
  });

  it("não muta a entrada", () => {
    const items = make(["c", 3000], ["a", 1000]);
    sortForDisplay(items);
    expect(ids(items)).toEqual(["c", "a"]);
  });
});

describe("reorder — caso normal", () => {
  const base = make(["a", 1000], ["b", 2000], ["c", 3000], ["d", 4000]);

  it("mover para o meio grava UMA linha só", () => {
    // É o ponto do índice fracionário: renumerar a lista inteira a cada arraste
    // seria N escritas por gesto.
    const r = reorder(base, 0, 2);
    expect(ids(r.items)).toEqual(["b", "c", "a", "d"]);
    expect(r.writes).toHaveLength(1);
    expect(r.writes[0]).toEqual({ id: "a", sortOrder: 3500 });
  });

  it("mover para o topo usa posição menor que a primeira", () => {
    const r = reorder(base, 3, 0);
    expect(ids(r.items)).toEqual(["d", "a", "b", "c"]);
    expect(r.writes[0]!.sortOrder).toBeLessThan(1000);
  });

  it("mover para o fim usa posição maior que a última", () => {
    const r = reorder(base, 0, 3);
    expect(ids(r.items)).toEqual(["b", "c", "d", "a"]);
    expect(r.writes[0]!.sortOrder).toBeGreaterThan(4000);
  });

  it("a posição gravada mantém o item no lugar em que foi solto", () => {
    // A prova que importa: reordenar pelo valor gravado tem de reproduzir
    // exatamente a ordem visual do arraste.
    const r = reorder(base, 0, 2);
    expect(ids(sortForDisplay(r.items))).toEqual(ids(r.items));
  });

  it("soltar no mesmo lugar não grava nada", () => {
    const r = reorder(base, 1, 1);
    expect(r.writes).toEqual([]);
    expect(ids(r.items)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("reorder — renumeração", () => {
  it("vizinhos com o mesmo valor forçam renumeração", () => {
    // midpoint devolve NaN aqui; gravar NaN corromperia a coluna numeric.
    const items = make(["a", 1000], ["b", 1000], ["c", 1000]);
    const r = reorder(items, 2, 1);
    expect(r.writes).toHaveLength(3);
    for (const w of r.writes) expect(Number.isFinite(w.sortOrder)).toBe(true);
    expect(ids(sortForDisplay(r.items))).toEqual(ids(r.items));
  });

  it("vizinho com sortOrder nulo força renumeração", () => {
    // Peça que nunca foi ordenada não dá referência para calcular o meio.
    const items = make(["a", 1000], ["b", null], ["c", null]);
    const r = reorder(items, 0, 1);
    expect(r.writes).toHaveLength(3);
    expect(r.items.every((i) => i.sortOrder != null)).toBe(true);
  });

  it("renumeração deixa todos distintos e crescentes", () => {
    const items = make(["a", 1000], ["b", 1000], ["c", 1000]);
    const r = reorder(items, 0, 2);
    const values = r.items.map((i) => i.sortOrder as number);
    expect(new Set(values).size).toBe(values.length);
    expect([...values].sort((x, y) => x - y)).toEqual(values);
  });

  it("nunca grava NaN nem Infinity", () => {
    const cenarios: OrderableProduct[][] = [
      make(["a", 1000], ["b", 1000]),
      make(["a", null], ["b", null]),
      make(["a", 0], ["b", 0], ["c", 0]),
    ];
    for (const items of cenarios) {
      const r = reorder(items, 0, items.length - 1);
      for (const w of r.writes) {
        expect(Number.isFinite(w.sortOrder), `posição inválida: ${w.sortOrder}`).toBe(true);
      }
    }
  });
});

describe("reorder — índices inválidos", () => {
  const base = make(["a", 1000], ["b", 2000]);

  it.each([
    ["negativo", -1, 0],
    ["destino negativo", 0, -1],
    ["fora do fim", 5, 0],
    ["destino fora do fim", 0, 5],
  ])("%s não grava nada", (_label, from, to) => {
    const r = reorder(base, from, to);
    expect(r.writes).toEqual([]);
    expect(ids(r.items)).toEqual(["a", "b"]);
  });

  it("lista vazia não quebra", () => {
    expect(reorder([], 0, 0).writes).toEqual([]);
  });
});

describe("reorder — arrastes repetidos no mesmo ponto", () => {
  it("converge sem produzir posição duplicada", () => {
    // Cada arraste divide o intervalo ao meio; em algum momento o float não dá
    // mais um valor distinto e a renumeração tem de assumir.
    let items = make(["a", 1000], ["b", 2000], ["c", 3000]);
    for (let i = 0; i < 80; i++) {
      const r = reorder(sortForDisplay(items), 2, 1);
      items = r.items;
      for (const w of r.writes) expect(Number.isFinite(w.sortOrder)).toBe(true);
      const values = items.map((x) => x.sortOrder as number);
      expect(new Set(values).size, `posições duplicadas na volta ${i}`).toBe(values.length);
    }
  });
});
