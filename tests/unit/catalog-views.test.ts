import { describe, it, expect } from "vitest";
import { formatCatalogPrice } from "@/app/app/(pro)/products/catalog/_components/parts/EditorialCard";

describe("Catalog Live Preview View Components (Agent 2)", () => {
  it("formats prices according to priceMode correctly", () => {
    expect(formatCatalogPrice(15000, "varejo")).toBe("R$ 150,00");
    expect(formatCatalogPrice(15000, "sob_consulta")).toBe("Sob Consulta B2B");
    expect(formatCatalogPrice(15000, "atacado", 20)).toBe("R$ 120,00");
  });
});
