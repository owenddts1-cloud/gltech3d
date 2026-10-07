import { describe, it, expect } from "vitest";
import { resolveBestsellers, defaultBestSellersConfig } from "@/lib/landing/bestsellers-config";
import type { LandingProduct } from "@/lib/landing/types";

function mockProduct(id: string, slug: string, name: string, rank?: 1 | 2 | 3): LandingProduct {
  return {
    id,
    slug,
    name,
    description: "teste",
    price: 10,
    category: "Decoração",
    image: "/img.jpg",
    images: ["/img.jpg"],
    videos: [],
    isTop: false,
    bestsellerRank: rank,
    pendingPhoto: false,
    material: "PLA",
    dimensions: "10x10",
    colors: ["Branco"],
    variations: [],
    links: {},
    stockQty: 5,
  };
}

describe("resolveBestsellers", () => {
  it("uses database bestsellers if all 3 ranks are present", () => {
    const p1 = mockProduct("1", "prod-1", "Prod 1", 1);
    const p2 = mockProduct("2", "prod-2", "Prod 2", 2);
    const p3 = mockProduct("3", "prod-3", "Prod 3", 3);
    const all = [p1, p2, p3];

    const result = resolveBestsellers(all, [p1, p2, p3]);
    expect(result.champion?.slug).toBe("prod-1");
    expect(result.runnersUp.map((p) => p.slug)).toEqual(["prod-2", "prod-3"]);
  });

  it("resolves from config slugs when db bestsellers are empty", () => {
    const p1 = mockProduct("1", "lua-cheia", "Lua Cheia");
    const p2 = mockProduct("2", "charizard", "Charizard");
    const p3 = mockProduct("3", "base-watch", "Base Watch");
    const p4 = mockProduct("4", "outro", "Outro");
    const all = [p4, p2, p1, p3];

    const config = {
      championSlug: "lua-cheia",
      secondSlug: "charizard",
      thirdSlug: "base-watch",
    };

    const result = resolveBestsellers(all, [], config);
    expect(result.champion?.slug).toBe("lua-cheia");
    expect(result.runnersUp.map((p) => p.slug)).toEqual(["charizard", "base-watch"]);
  });

  it("falls back gracefully when config slugs are not found", () => {
    const p1 = mockProduct("1", "prod-1", "Prod 1");
    const p2 = mockProduct("2", "prod-2", "Prod 2");
    const all = [p1, p2];

    const config = {
      championSlug: "inexistente-1",
      secondSlug: "inexistente-2",
      thirdSlug: "inexistente-3",
    };

    const result = resolveBestsellers(all, [], config);
    expect(result.champion?.slug).toBe("prod-1");
    expect(result.runnersUp.map((p) => p.slug)).toEqual(["prod-2"]);
  });
});
