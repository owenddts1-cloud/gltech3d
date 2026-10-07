import { describe, it, expect } from "vitest";
import {
  MANUFACTURING_MANIFESTO,
  INDUSTRIAL_CATEGORIES,
  MATERIAL_PROPERTIES_TABLE,
  buildB2bWhatsappQuoteUrl,
  type B2bQuoteUrlParams,
} from "@/lib/catalog/b2b-copywriting";

describe("B2B copywriting & conversion engineering (Agent 3)", () => {
  it("defines an authentic manufacturing manifesto with anti-AI vocabulary", () => {
    expect(MANUFACTURING_MANIFESTO.title).toContain("Manufatura Aditiva");
    expect(MANUFACTURING_MANIFESTO.statement).toContain("climatizado");
    expect(MANUFACTURING_MANIFESTO.statement).toContain("repetibilidade");

    // Strictly forbidden AI buzzwords
    const text = (MANUFACTURING_MANIFESTO.title + " " + MANUFACTURING_MANIFESTO.statement).toLowerCase();
    expect(text).not.toContain("revolucionário");
    expect(text).not.toContain("mágico");
    expect(text).not.toContain("inteligência artificial incrível");
  });

  it("defines the 4 technical industrial categories", () => {
    expect(INDUSTRIAL_CATEGORIES.length).toBe(4);
    expect(INDUSTRIAL_CATEGORIES[0].title).toContain("Prototipagem Rápida");
    expect(INDUSTRIAL_CATEGORIES[1].title).toContain("Gabaritos");
    expect(INDUSTRIAL_CATEGORIES[2].title).toContain("Polímeros de Engenharia");
    expect(INDUSTRIAL_CATEGORIES[3].title).toContain("Séries Seriadas");
  });

  it("exports technical materials properties matrix for engineering comparison", () => {
    expect(MATERIAL_PROPERTIES_TABLE.length).toBeGreaterThanOrEqual(4);
    const petg = MATERIAL_PROPERTIES_TABLE.find((m) => m.name.includes("PETG"));
    expect(petg).toBeDefined();
    expect(petg?.density).toBeDefined();
    expect(petg?.heatDeflectionTemp).toBeDefined();
  });

  it("constructs direct WhatsApp quote URL with SKU, page number and UTM tracking", () => {
    const params: B2bQuoteUrlParams = {
      phone: "11987654321",
      productName: "Suporte Articulado Industrial",
      sku: "GL-MEC-042",
      pageNumber: 3,
      material: "PETG Carbon Fiber",
      quantity: 20,
    };

    const url = buildB2bWhatsappQuoteUrl(params);
    expect(url).toContain("https://wa.me/5511987654321?text=");
    
    // Verify decoded message structure
    const decodedUrl = decodeURIComponent(url);
    expect(decodedUrl).toContain("Suporte Articulado Industrial");
    expect(decodedUrl).toContain("GL-MEC-042");
    expect(decodedUrl).toContain("pág. 3");
    expect(decodedUrl).toContain("20 unidades");
    expect(decodedUrl).toContain("PETG Carbon Fiber");
  });
});
