import { describe, it, expect } from "vitest";
import { filterCatalogProducts } from "@/app/app/(pro)/products/catalog/_components/CatalogConfigSidebar";
import type { CatalogProductItem } from "@/lib/catalog/whatsapp-formatter";

describe("Catalog Editor Integration & Filter Pipeline (Agent 2)", () => {
  const sampleProducts: CatalogProductItem[] = [
    {
      id: "prod-1",
      name: "Engrenagem Helicoidal",
      slug: "engrenagem-helicoidal",
      category: "Mecânica",
      price_cents: 8500,
      sale_price_cents: 8500,
      photo_url: null,
      filament_grams: 45,
      print_time_hours: 2,
      material: "PETG",
      dimensions: null,
      is_top: true,
    },
    {
      id: "prod-2",
      name: "Vaso Geométrico Escandinavo",
      slug: "vaso-geometrico",
      category: "Decoração",
      price_cents: 12000,
      sale_price_cents: 12000,
      photo_url: null,
      filament_grams: 180,
      print_time_hours: 6,
      material: "PLA Silk",
      dimensions: null,
      is_top: false,
    },
  ];

  it("filters products by text search matching name or material", () => {
    const res = filterCatalogProducts(sampleProducts, { search: "Helicoidal", category: "all" });
    expect(res.length).toBe(1);
    expect(res[0]!.id).toBe("prod-1");

    const resMat = filterCatalogProducts(sampleProducts, { search: "silk", category: "all" });
    expect(resMat.length).toBe(1);
    expect(resMat[0]!.id).toBe("prod-2");
  });

  it("filters products by category accurately", () => {
    const res = filterCatalogProducts(sampleProducts, { search: "", category: "Decoração" });
    expect(res.length).toBe(1);
    expect(res[0]!.name).toContain("Vaso");
  });

  it("returns all products when search is empty and category is all", () => {
    const res = filterCatalogProducts(sampleProducts, { search: "", category: "all" });
    expect(res.length).toBe(2);
  });
});
