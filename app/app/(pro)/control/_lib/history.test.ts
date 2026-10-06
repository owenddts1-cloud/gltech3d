import { describe, it, expect } from "vitest";
import { commit, undo, redo, canUndo, canRedo, type HistoryState } from "./history";

const start = <T,>(present: T): HistoryState<T> => ({ present, past: [], future: [] });
const LIMIT = 100;

describe("undo", () => {
  it("volta uma edição por vez, na ordem inversa", () => {
    let s = start("a");
    s = commit(s, "b", LIMIT);
    s = commit(s, "c", LIMIT);
    expect(s.present).toBe("c");

    s = undo(s);
    expect(s.present).toBe("b");
    s = undo(s);
    expect(s.present).toBe("a");
  });

  it("é no-op quando não há o que desfazer", () => {
    const s = start("a");
    expect(canUndo(s)).toBe(false);
    expect(undo(s)).toBe(s);
  });
});

describe("redo", () => {
  it("refaz o que o undo tirou", () => {
    let s = start("a");
    s = commit(s, "b", LIMIT);
    s = undo(s);
    expect(s.present).toBe("a");
    expect(canRedo(s)).toBe(true);

    s = redo(s, LIMIT);
    expect(s.present).toBe("b");
    expect(canRedo(s)).toBe(false);
  });

  it("é no-op quando não há o que refazer", () => {
    const s = start("a");
    expect(redo(s, LIMIT)).toBe(s);
  });

  it("sobrevive a undo/redo repetido sem perder estado", () => {
    let s = start("a");
    s = commit(s, "b", LIMIT);
    s = commit(s, "c", LIMIT);
    for (let i = 0; i < 3; i++) {
      s = undo(undo(s));
      expect(s.present).toBe("a");
      s = redo(redo(s, LIMIT), LIMIT);
      expect(s.present).toBe("c");
    }
  });
});

describe("commit", () => {
  it("descarta o redo ao editar depois de um undo (bifurcação)", () => {
    let s = start("a");
    s = commit(s, "b", LIMIT);
    s = undo(s);                    // volta para "a", "b" fica no future
    expect(canRedo(s)).toBe(true);

    s = commit(s, "z", LIMIT);      // edição nova a partir de "a"
    expect(s.present).toBe("z");
    expect(canRedo(s)).toBe(false); // "b" foi descartado — não dá pra refazer o ramo morto
    expect(undo(s).present).toBe("a");
  });

  it("respeita o teto do histórico, descartando o mais antigo", () => {
    let s = start(0);
    for (let i = 1; i <= 5; i++) s = commit(s, i, 3);

    expect(s.past).toHaveLength(3);
    expect(s.past).toEqual([2, 3, 4]); // 0 e 1 caíram fora
    expect(s.present).toBe(5);
  });

  it("não muta o estado anterior", () => {
    const s1 = start("a");
    const s2 = commit(s1, "b", LIMIT);
    expect(s1.present).toBe("a");
    expect(s1.past).toEqual([]);
    expect(s2).not.toBe(s1);
  });
});
