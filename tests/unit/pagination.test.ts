import { describe, expect, it } from "vitest";
import { paginate } from "@/lib/pagination";

describe("paginate", () => {
  const list = Array.from({ length: 12 }, (_, i) => i + 1);

  it("fatia por página e calcula o total de páginas", () => {
    const p1 = paginate(list, 1, 5);
    expect(p1.items).toEqual([1, 2, 3, 4, 5]);
    expect(p1.totalPages).toBe(3);
    expect(paginate(list, 3, 5).items).toEqual([11, 12]);
  });

  it("clampa páginas fora do intervalo (0 e além do fim)", () => {
    expect(paginate(list, 0, 5).page).toBe(1);
    expect(paginate(list, 99, 5).page).toBe(3);
    expect(paginate([], 5, 5).totalPages).toBe(1);
  });

  it("usa perPage=5 por padrão quando omitido", () => {
    expect(paginate(list, 1).items).toEqual([1, 2, 3, 4, 5]);
  });

  it("respeita um perPage diferente do padrão", () => {
    const p = paginate(list, 2, 4);
    expect(p.items).toEqual([5, 6, 7, 8]);
    expect(p.totalPages).toBe(3);
  });
});
