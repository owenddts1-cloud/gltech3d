import { describe, expect, it } from "vitest";
import { buildFilamentTitle, formatNetWeight } from "./title";

describe("formatNetWeight", () => {
  it("uses kg from 1000 g and g below", () => {
    expect(formatNetWeight(1000)).toBe("1 kg");
    expect(formatNetWeight(1500)).toBe("1,5 kg");
    expect(formatNetWeight(2250)).toBe("2,25 kg");
    expect(formatNetWeight(750)).toBe("750 g");
    expect(formatNetWeight(250)).toBe("250 g");
  });

  it("returns null for missing or invalid weight", () => {
    expect(formatNetWeight(null)).toBeNull();
    expect(formatNetWeight(undefined)).toBeNull();
    expect(formatNetWeight(0)).toBeNull();
    expect(formatNetWeight(Number.NaN)).toBeNull();
  });
});

describe("buildFilamentTitle", () => {
  it("builds the full title with the brand after a dot", () => {
    expect(
      buildFilamentTitle({
        material: "PLA",
        line: "Plus+",
        colorName: "Preto",
        netWeightG: 1000,
        brand: "Voolt",
      }),
    ).toBe("PLA Plus+ Preto 1 kg · Voolt");
  });

  it("skips empty parts", () => {
    expect(buildFilamentTitle({ material: "PETG", colorName: "Azul", netWeightG: 500 })).toBe(
      "PETG Azul 500 g",
    );
    expect(buildFilamentTitle({ material: "ABS", line: "  ", brand: "" })).toBe("ABS");
    expect(buildFilamentTitle({ brand: "Marca" })).toBe("Marca");
    expect(buildFilamentTitle({})).toBe("");
  });

  it("does not repeat the material when the line already names it", () => {
    expect(buildFilamentTitle({ material: "PLA", line: "PLA+ Silk", colorName: "Ouro" })).toBe(
      "PLA+ Silk Ouro",
    );
  });

  it("collapses internal whitespace", () => {
    expect(buildFilamentTitle({ material: " PLA ", colorName: "Branco   Gelo" })).toBe("PLA Branco Gelo");
  });
});
