import { describe, expect, it } from "vitest";
import { GUIDES } from "./registry";
import { canSeeGuide, guidePermission } from "./permissions";
import { guideForPath } from "./registry";

const byPath = (p: string) => {
  const g = guideForPath(p);
  if (!g) throw new Error(`no guide for ${p}`);
  return g;
};

describe("guide visibility by role", () => {
  it("guides of restricted screens inherit the sidebar permission", () => {
    expect(guidePermission(byPath("/app/settings/tenant"))).toBe("org.settings.manage");
    expect(guidePermission(byPath("/app/connections"))).toBe("channels.manage");
    expect(guidePermission(byPath("/app/ai/agents"))).toBe("ai.agents.view");
  });

  it("an agent does not see admin/manager-only guides", () => {
    expect(canSeeGuide(byPath("/app/settings/tenant"), "agent")).toBe(false);
    expect(canSeeGuide(byPath("/app/ai/agents"), "agent")).toBe(false);
    expect(canSeeGuide(byPath("/app/projects"), "agent")).toBe(true);
  });

  it("a manager sees agents but not organization settings", () => {
    expect(canSeeGuide(byPath("/app/ai/agents"), "manager")).toBe(true);
    expect(canSeeGuide(byPath("/app/settings/tenant"), "manager")).toBe(false);
  });

  it("admin and platform admin see everything", () => {
    expect(GUIDES.every((g) => canSeeGuide(g, "admin"))).toBe(true);
    expect(GUIDES.every((g) => canSeeGuide(g, "viewer", { isPlatformAdmin: true }))).toBe(true);
  });
});
