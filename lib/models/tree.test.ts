import { describe, it, expect } from "vitest";
import { wouldCreateCycle, descendantIds, type FolderNodeLite } from "@/lib/models/tree";

// Árvore:
//   a
//   ├── b
//   │   └── d
//   └── c
const tree: FolderNodeLite[] = [
  { id: "a", parentId: null },
  { id: "b", parentId: "a" },
  { id: "c", parentId: "a" },
  { id: "d", parentId: "b" },
];

describe("wouldCreateCycle", () => {
  it("permite mover para a raiz (null)", () => {
    expect(wouldCreateCycle(tree, "b", null)).toBe(false);
  });

  it("rejeita mover uma pasta para dentro dela mesma", () => {
    expect(wouldCreateCycle(tree, "b", "b")).toBe(true);
  });

  it("rejeita mover para um descendente direto", () => {
    expect(wouldCreateCycle(tree, "b", "d")).toBe(true);
  });

  it("rejeita mover a raiz para um neto", () => {
    expect(wouldCreateCycle(tree, "a", "d")).toBe(true);
  });

  it("permite mover para um irmão / não-descendente", () => {
    expect(wouldCreateCycle(tree, "b", "c")).toBe(false);
  });

  it("não entra em loop infinito se o dado já estiver corrompido", () => {
    const corrupt: FolderNodeLite[] = [
      { id: "x", parentId: "y" },
      { id: "y", parentId: "x" },
    ];
    expect(wouldCreateCycle(corrupt, "z", "x")).toBe(false);
  });
});

describe("descendantIds", () => {
  it("lista todos os descendentes, sem incluir o próprio nó", () => {
    expect(descendantIds(tree, "a").sort()).toEqual(["b", "c", "d"]);
  });

  it("retorna vazio para uma folha", () => {
    expect(descendantIds(tree, "d")).toEqual([]);
  });
});
