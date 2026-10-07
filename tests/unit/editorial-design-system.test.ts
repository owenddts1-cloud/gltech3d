import { describe, it, expect } from "vitest";
import {
  EDITORIAL_THEMES,
  CATALOG_LAYOUT_SPECS,
  TECHNICAL_BADGES,
  getThemeTokens,
  formatDimensionBadge,
} from "@/lib/catalog/editorial-design-system";

describe("editorial design system tokens and specs (Agent 1)", () => {
  it("defines authentic Warm Studio and Technical Monolith palettes", () => {
    expect(EDITORIAL_THEMES.warm_studio.bg).toBe("#FAF8F5");
    expect(EDITORIAL_THEMES.warm_studio.fg).toBe("#171615");
    expect(EDITORIAL_THEMES.warm_studio.border).toBe("#E5E2DC");
    expect(EDITORIAL_THEMES.warm_studio.accent).toBe("#9E5A38");

    expect(EDITORIAL_THEMES.technical_monolith.bg).toBe("#0D0E11");
    expect(EDITORIAL_THEMES.technical_monolith.fg).toBe("#F4F4F6");
    expect(EDITORIAL_THEMES.technical_monolith.border).toBe("#262933");
    expect(EDITORIAL_THEMES.technical_monolith.accent).toBe("#F59E0B");
  });

  it("retrieves theme tokens via helper with fallback", () => {
    const light = getThemeTokens("warm_studio");
    expect(light.id).toBe("warm_studio");
    expect(light.isDark).toBe(false);

    const dark = getThemeTokens("technical_monolith");
    expect(dark.id).toBe("technical_monolith");
    expect(dark.isDark).toBe(true);
  });

  it("defines the 4 required layout specifications with exact item counts", () => {
    expect(CATALOG_LAYOUT_SPECS.grid_2x2.itemsPerPage).toBe(4);
    expect(CATALOG_LAYOUT_SPECS.hero_plus_3.itemsPerPage).toBe(4);
    expect(CATALOG_LAYOUT_SPECS.editorial_detail.itemsPerPage).toBe(1);
    expect(CATALOG_LAYOUT_SPECS.technical_list.itemsPerPage).toBe(6);
  });

  it("formats technical dimensions cleanly for engineering badges", () => {
    expect(formatDimensionBadge({ x: 120, y: 80, z: 45 })).toBe("120 × 80 × 45 mm");
    expect(formatDimensionBadge(null)).toBe("Sob Medida");
  });

  it("exports official tolerance and manufacturing stamps", () => {
    expect(TECHNICAL_BADGES.tolerance).toContain("±0.05mm");
    expect(TECHNICAL_BADGES.resolution).toContain("0.12");
    expect(TECHNICAL_BADGES.supportedPolymers.length).toBeGreaterThanOrEqual(4);
  });
});
