import { describe, it, expect } from "vitest";
import { filamentInputSchema, normalizeSimpleSpool, simpleSpoolFormSchema } from "@/lib/schemas/printers";

describe("Simplified Spool Registration & Inventory (No Manual ID, No Health, No Gramatura)", () => {
  it("validates simplified spool input containing only brand, color, material and quantity", () => {
    const input = {
      brand: "Voolt3D",
      color: "#1E40AF",
      material: "PLA",
      quantity: 4,
    };

    const parsed = simpleSpoolFormSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.brand).toBe("Voolt3D");
    expect(parsed.data.color).toBe("#1E40AF");
    expect(parsed.data.material).toBe("PLA");
    expect(parsed.data.quantity).toBe(4);
  });

  it("normalizes a simple spool to full filament format transparently generating ID and standard weight", () => {
    const normalized = normalizeSimpleSpool({
      brand: "eSun",
      color: "#10B981",
      material: "PETG",
      quantity: 3,
    });

    expect(normalized.id).toMatch(/^fil_/);
    expect(normalized.name).toBe("eSun PETG (#10B981)");
    expect(normalized.supplier).toBe("eSun");
    expect(normalized.brand).toBe("eSun");
    expect(normalized.color).toBe("#10B981");
    expect(normalized.material).toBe("PETG");
    expect(normalized.quantity).toBe(3);
    // 3 spools = 3000g transparently for backward-compatible cost/time engines
    expect(normalized.weightGrams).toBe(3000);
    expect(normalized.initialWeightGrams).toBe(3000);
    expect(normalized.costPerGram).toBeGreaterThan(0);
  });

  it("filamentInputSchema accepts simplified payloads without requiring manual id or gramatura", () => {
    const payload = {
      name: "Creality Black",
      brand: "Creality",
      color: "#000000",
      material: "PLA",
      quantity: 2,
    };

    const parsed = filamentInputSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.quantity).toBe(2);
    expect(parsed.data.weightGrams).toBe(2000);
    expect(parsed.data.initialWeightGrams).toBe(2000);
  });

  it("rejects invalid quantities <= 0 or negative numbers", () => {
    const invalid = {
      brand: "Voolt3D",
      color: "#ffffff",
      material: "ABS",
      quantity: 0,
    };

    const parsed = simpleSpoolFormSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});
