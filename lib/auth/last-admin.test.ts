import { describe, it, expect } from "vitest";

import { isLastAdminDemotion } from "./last-admin";

describe("isLastAdminDemotion", () => {
  it("bloqueia rebaixar o único admin ativo", () => {
    expect(isLastAdminDemotion({ currentRole: "admin", nextRole: "manager", activeAdminCount: 1 })).toBe(true);
  });

  it("permite rebaixar quando há outro admin", () => {
    expect(isLastAdminDemotion({ currentRole: "admin", nextRole: "viewer", activeAdminCount: 2 })).toBe(false);
  });

  it("manter admin como admin não é rebaixar", () => {
    expect(isLastAdminDemotion({ currentRole: "admin", nextRole: "admin", activeAdminCount: 1 })).toBe(false);
  });

  it("mudar quem não é admin nunca esbarra na regra", () => {
    expect(isLastAdminDemotion({ currentRole: "agent", nextRole: "viewer", activeAdminCount: 0 })).toBe(false);
  });
});
