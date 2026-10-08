import { afterEach, describe, expect, it, vi } from "vitest";
import { containRect, gridCellRect, pageCount } from "./pdf-layout";
import { fitWithin, loadImageAsJpegDataUrl, loadPdfImages, uniqueImageUrls } from "./pdf-images";
import { CATALOG_GRID, GRID_IMAGE_H, catalogPageCount } from "./pdf-generator";

describe("gridCellRect", () => {
  it("lays the catalog 2x2 grid inside the page margins", () => {
    const a = gridCellRect(0, CATALOG_GRID);
    const b = gridCellRect(1, CATALOG_GRID);
    const c = gridCellRect(2, CATALOG_GRID);
    const d = gridCellRect(3, CATALOG_GRID);

    expect(a).toEqual({ x: 12, y: 35, w: 89, h: 116 });
    expect(b.x).toBeCloseTo(12 + 89 + 8);
    expect(b.y).toBe(35);
    expect(c).toMatchObject({ x: 12, y: 35 + 116 + 8 });
    // Right edge touches the right margin, bottom edge touches the grid bottom.
    expect(d.x + d.w).toBeCloseTo(210 - 12);
    expect(d.y + d.h).toBeCloseTo(CATALOG_GRID.bottom);
  });

  it("wraps indexes past the last cell back to the first row", () => {
    expect(gridCellRect(4, CATALOG_GRID)).toEqual(gridCellRect(0, CATALOG_GRID));
  });

  it("leaves room for the text below the photo in a grid card", () => {
    const { h } = gridCellRect(0, CATALOG_GRID);
    // photo + top padding + title/copy/specs (~35mm) + price line (~10mm)
    expect(4 + GRID_IMAGE_H + 45).toBeLessThanOrEqual(h);
  });
});

describe("pageCount / catalogPageCount", () => {
  it("rounds up and never returns 0", () => {
    expect(pageCount(0, 4)).toBe(1);
    expect(pageCount(4, 4)).toBe(1);
    expect(pageCount(5, 4)).toBe(2);
    expect(pageCount(3, 0)).toBe(3);
  });

  it("uses one page per product in detail mode", () => {
    expect(catalogPageCount(7, "detail")).toBe(7);
    expect(catalogPageCount(7, "grid")).toBe(2);
    expect(catalogPageCount(0, "detail")).toBe(1);
  });
});

describe("containRect", () => {
  const box = { x: 10, y: 20, w: 100, h: 50 };

  it("fits a wide image to the box width and centers it vertically", () => {
    const r = containRect(400, 100, box);
    expect(r.w).toBeCloseTo(100);
    expect(r.h).toBeCloseTo(25);
    expect(r.x).toBeCloseTo(10);
    expect(r.y).toBeCloseTo(20 + 12.5);
  });

  it("fits a tall image to the box height and centers it horizontally", () => {
    const r = containRect(100, 200, box);
    expect(r.h).toBeCloseTo(50);
    expect(r.w).toBeCloseTo(25);
    expect(r.x).toBeCloseTo(10 + 37.5);
    expect(r.y).toBeCloseTo(20);
  });

  it("returns an empty rect for degenerate sizes", () => {
    expect(containRect(0, 100, box)).toMatchObject({ w: 0, h: 0 });
  });
});

describe("fitWithin", () => {
  it("downscales the longest side to maxPx, keeping the aspect", () => {
    expect(fitWithin(4000, 3000, 800)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1000, 2000, 800)).toEqual({ width: 400, height: 800 });
  });

  it("never upscales", () => {
    expect(fitWithin(640, 480, 800)).toEqual({ width: 640, height: 480 });
  });

  it("handles empty images", () => {
    expect(fitWithin(0, 100, 800)).toEqual({ width: 0, height: 0 });
  });
});

describe("uniqueImageUrls", () => {
  it("drops empty values and duplicates, keeping first-seen order", () => {
    expect(uniqueImageUrls(["b", null, " a ", undefined, "", "b", "a"])).toEqual(["b", "a"]);
  });
});

describe("image loading failures", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a failure (not a throw) when fetch is blocked by CORS", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(loadImageAsJpegDataUrl("https://x.supabase.co/a.jpg")).resolves.toEqual({
      ok: false,
      reason: "Failed to fetch",
    });
  });

  it("returns a failure on HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 404 })));
    await expect(loadImageAsJpegDataUrl("https://x.supabase.co/a.jpg")).resolves.toEqual({
      ok: false,
      reason: "HTTP 404",
    });
  });

  it("reports progress for every distinct URL and keeps going after failures", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    const progress: Array<[number, number]> = [];

    const results = await loadPdfImages(["a", "b", "a", null, "c"], {
      concurrency: 2,
      onProgress: (done, total) => progress.push([done, total]),
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect([...results.keys()].sort()).toEqual(["a", "b", "c"]);
    expect([...results.values()].every((r) => !r.ok)).toBe(true);
    expect(progress[0]).toEqual([0, 3]);
    expect(progress[progress.length - 1]).toEqual([3, 3]);
  });

  it("does nothing (but still reports) when there are no images", async () => {
    const progress: Array<[number, number]> = [];
    const results = await loadPdfImages([null, ""], { onProgress: (d, t) => progress.push([d, t]) });
    expect(results.size).toBe(0);
    expect(progress).toEqual([[0, 0]]);
  });
});
