import { describe, expect, it } from "vitest";
import { resolveDropPosition } from "@/app/app/service-orders/_lib/board";

describe("resolveDropPosition", () => {
  it("posição real = offset da página + índice visível", () => {
    expect(resolveDropPosition(1, 5, 0)).toBe(0);
    expect(resolveDropPosition(1, 5, 4)).toBe(4);
    expect(resolveDropPosition(2, 5, 0)).toBe(5);
    expect(resolveDropPosition(3, 5, 4)).toBe(14);
  });
});
