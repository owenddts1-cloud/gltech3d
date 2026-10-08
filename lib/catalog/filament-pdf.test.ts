import { describe, expect, it } from "vitest";
import { gridCellRect } from "./pdf-layout";
import {
  FILAMENT_CARD_IMAGE_H,
  FILAMENT_GRID,
  FILAMENTS_PER_PAGE,
  filamentPdfPageCount,
  hexToRgb,
  pdfTempRange,
  selectFilamentsForPdf,
} from "./filament-pdf";

describe("filament PDF layout", () => {
  it("fits 6 cards per page inside the margins", () => {
    expect(FILAMENTS_PER_PAGE).toBe(6);
    const last = gridCellRect(FILAMENTS_PER_PAGE - 1, FILAMENT_GRID);
    expect(last.x + last.w).toBeCloseTo(210 - FILAMENT_GRID.margin);
    expect(last.y + last.h).toBeCloseTo(FILAMENT_GRID.bottom);
  });

  it("leaves room for the text block under the photo", () => {
    const { h } = gridCellRect(0, FILAMENT_GRID);
    // photo + eyebrow/title/specs/temps (~26 mm) + price baseline
    expect(3 + FILAMENT_CARD_IMAGE_H + 26).toBeLessThanOrEqual(h);
  });

  it("counts the cover plus card pages", () => {
    expect(filamentPdfPageCount(0)).toBe(2);
    expect(filamentPdfPageCount(6)).toBe(2);
    expect(filamentPdfPageCount(7)).toBe(3);
  });
});

describe("filament PDF helpers", () => {
  it("parses hex colors", () => {
    expect(hexToRgb("#A6815C")).toEqual([166, 129, 92]);
    expect(hexToRgb("ffffff")).toEqual([255, 255, 255]);
    expect(hexToRgb("#FFF")).toBeNull();
    expect(hexToRgb(null)).toBeNull();
  });

  it("formats temperatures with PDF-safe characters", () => {
    expect(pdfTempRange(200, 220)).toBe("200-220°C");
    expect(pdfTempRange(60, null)).toBe("60°C");
    expect(pdfTempRange(null, null)).toBeNull();
  });

  it("selects by published flag and material, keeping order", () => {
    const list = [
      { id: "a", isPublished: true, materialId: "pla" },
      { id: "b", isPublished: false, materialId: "pla" },
      { id: "c", isPublished: true, materialId: "petg" },
    ];
    expect(selectFilamentsForPdf(list, { onlyPublished: true, materialId: "" }).map((f) => f.id)).toEqual(["a", "c"]);
    expect(selectFilamentsForPdf(list, { onlyPublished: false, materialId: "pla" }).map((f) => f.id)).toEqual(["a", "b"]);
  });
});
