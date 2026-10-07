import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  calculateEditorialPageCount,
  partitionProductsForLayout,
  type EditorialPdfOptions,
} from "@/lib/catalog/editorial-pdf-engine";
import type { CatalogProductItem } from "@/lib/catalog/whatsapp-formatter";

describe("Editorial PDF Engine (Agent 4)", () => {
  it("converts hex color codes to RGB triples accurately", () => {
    expect(hexToRgb("#FAF8F5")).toEqual([250, 248, 245]);
    expect(hexToRgb("#0D0E11")).toEqual([13, 14, 17]);
    expect(hexToRgb("#F59E0B")).toEqual([245, 158, 11]);
  });

  it("calculates exact total page count including cover, manifesto and backcover", () => {
    const opts: EditorialPdfOptions = {
      layoutMode: "grid_2x2",
      theme: "warm_studio",
      includeCover: true,
      includeManifesto: true,
      includeBackcover: true,
      priceMode: "varejo",
    };

    // 8 items in 2x2 (4/page) = 2 content pages + 1 cover + 1 manifesto + 1 backcover = 5 pages
    expect(calculateEditorialPageCount(8, opts)).toBe(5);

    // 1 item in editorial_detail (1/page) = 1 content page + 3 special pages = 4 pages
    expect(
      calculateEditorialPageCount(1, { ...opts, layoutMode: "editorial_detail" })
    ).toBe(4);

    // No special pages
    expect(
      calculateEditorialPageCount(8, {
        ...opts,
        includeCover: false,
        includeManifesto: false,
        includeBackcover: false,
      })
    ).toBe(2);
  });

  it("partitions product list into pages respecting layout card capacities without orphan items", () => {
    const mockProducts: CatalogProductItem[] = Array.from({ length: 9 }).map((_, i) => ({
      id: `prod-${i + 1}`,
      name: `Peça Técnica ${i + 1}`,
      slug: `peca-${i + 1}`,
      category: "Usinagem Aditiva",
      price_cents: 15000,
      photo_url: null,
      filament_grams: 120,
      print_time_hours: 3.5,
      material: "PETG",
      dimensions: { x: 100, y: 100, z: 50 },
      is_top: i === 0,
    }));

    // Grid 2x2 = 4 per page -> [4, 4, 1]
    const pages2x2 = partitionProductsForLayout(mockProducts, "grid_2x2");
    expect(pages2x2.length).toBe(3);
    expect(pages2x2[0].length).toBe(4);
    expect(pages2x2[1].length).toBe(4);
    expect(pages2x2[2].length).toBe(1);

    // Editorial Detail = 1 per page -> 9 pages
    const pagesDetail = partitionProductsForLayout(mockProducts, "editorial_detail");
    expect(pagesDetail.length).toBe(9);
    expect(pagesDetail[0].length).toBe(1);

    // Technical List = 6 per page -> [6, 3]
    const pagesTech = partitionProductsForLayout(mockProducts, "technical_list");
    expect(pagesTech.length).toBe(2);
    expect(pagesTech[0].length).toBe(6);
    expect(pagesTech[1].length).toBe(3);
  });
});
