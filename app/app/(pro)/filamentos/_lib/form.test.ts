import { describe, expect, it } from "vitest";
import { filamentCreateSchema, filamentPatchSchema } from "@/lib/filament-catalog/schemas";
import {
  EMPTY_FILAMENT_FORM,
  intOrNull,
  payloadFromForm,
  previewTitle,
  validateFilamentForm,
  type FilamentFormState,
} from "./form";

const filled: FilamentFormState = {
  ...EMPTY_FILAMENT_FORM,
  materialId: "6f1c1b7e-3d3a-4f1e-9a43-0f2c7b9d1a11",
  line: "Plus+",
  brand: "Voolt",
  colorName: "Preto",
  colorHex: "#111111",
  price: "89,90",
  nozzleTempMin: "200",
  nozzleTempMax: "220",
  bedTempMin: "60",
  bedTempMax: "60",
};

describe("filament form", () => {
  it("previews the automatic title with the server function", () => {
    expect(previewTitle(filled, "PLA")).toBe("PLA Plus+ Preto 1 kg · Voolt");
  });

  it("parses integer fields", () => {
    expect(intOrNull("")).toBeNull();
    expect(intOrNull(" 210 ")).toBe(210);
    expect(Number.isNaN(intOrNull("abc"))).toBe(true);
  });

  it("validates what the person can fix", () => {
    expect(validateFilamentForm(EMPTY_FILAMENT_FORM, null)).toMatch(/material e a cor/);
    expect(validateFilamentForm({ ...filled, nozzleTempMin: "230" }, "PLA")).toMatch(/mínima/);
    expect(validateFilamentForm({ ...filled, colorHex: "#12" }, "PLA")).toMatch(/RRGGBB/);
    expect(validateFilamentForm({ ...filled, tdsUrl: "http://x.com" }, "PLA")).toMatch(/https/);
    expect(validateFilamentForm({ ...filled, price: "", isPublished: true }, "PLA")).toMatch(/valor de venda/);
    expect(validateFilamentForm(filled, "PLA")).toBeNull();
  });

  it("builds a create payload the server schema accepts (auto title = no name)", () => {
    const p = payloadFromForm(filled, "create");
    expect(p.name).toBeUndefined();
    expect(p.salePriceCents).toBe(8990);
    const parsed = filamentCreateSchema.safeParse(p);
    expect(parsed.success).toBe(true);
  });

  it("sends name:null on update to go back to the automatic title", () => {
    const p = payloadFromForm(filled, "update");
    expect(p.name).toBeNull();
    expect(filamentPatchSchema.safeParse(p).success).toBe(true);
    const manual = payloadFromForm({ ...filled, autoName: false, name: "Meu PLA" }, "update");
    expect(manual.name).toBe("Meu PLA");
  });
});
