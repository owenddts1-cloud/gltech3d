import { describe, it, expect } from "vitest";

describe("lib/ui/icons", () => {
  it("re-exports at least 20 named icon members", async () => {
    const mod = await import("@/lib/ui/icons");
    const keys = Object.keys(mod).filter((k) => k !== "default");
    expect(keys.length).toBeGreaterThanOrEqual(20);
  });
});
