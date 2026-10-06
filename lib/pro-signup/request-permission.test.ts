import { describe, it, expect } from "vitest";

import { canRequestProUpgrade } from "./request-permission";

describe("canRequestProUpgrade", () => {
  it("admin da org pode", () => {
    expect(canRequestProUpgrade({ role: "admin", isPlatformAdmin: false })).toBe(true);
  });
  it.each(["viewer", "agent", "manager"] as const)("%s não pode", (role) => {
    expect(canRequestProUpgrade({ role, isPlatformAdmin: false })).toBe(false);
  });
  it("platform admin pode mesmo sem papel na org", () => {
    expect(canRequestProUpgrade({ role: null, isPlatformAdmin: true })).toBe(true);
  });
  it("sem papel não pode", () => {
    expect(canRequestProUpgrade({ role: undefined, isPlatformAdmin: false })).toBe(false);
  });
});
