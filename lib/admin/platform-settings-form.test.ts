import { describe, expect, it } from "vitest";
import {
  CALCULATOR_DEFAULT_KEYS,
  DEFAULT_PLATFORM_SETTINGS,
  calculatorDefaultsShape,
  platformSettingsPatchSchema,
  platformSettingsToJson,
} from "@/lib/pricing/settings-schema";
import {
  CALCULATOR_FIELDS,
  buildPlanPatch,
  formFromSettings,
  joinBenefit,
  moveItem,
  parsePriceToCents,
  splitBenefitLine,
} from "./platform-settings-form";

const original = platformSettingsToJson(DEFAULT_PLATFORM_SETTINGS);

describe("calculator field metadata", () => {
  it("covers every key exactly once", () => {
    expect(CALCULATOR_FIELDS.map((f) => f.key).sort()).toEqual([...CALCULATOR_DEFAULT_KEYS].sort());
  });

  it("mirrors the server ranges", () => {
    for (const f of CALCULATOR_FIELDS) {
      const schema = calculatorDefaultsShape[f.key];
      expect(schema.safeParse(f.min).success, `${f.key} min`).toBe(true);
      expect(schema.safeParse(f.max).success, `${f.key} max`).toBe(true);
      expect(schema.safeParse(f.max + 1).success, `${f.key} > max`).toBe(false);
      expect(schema.safeParse(f.min - 0.01).success, `${f.key} < min`).toBe(false);
    }
  });
});

describe("plan form", () => {
  it("parses prices typed in pt-BR", () => {
    expect(parsePriceToCents("89,00")).toBe(8900);
    expect(parsePriceToCents("R$ 1.234,5")).toBe(123450);
    expect(parsePriceToCents("89.9")).toBe(8990);
    expect(Number.isNaN(parsePriceToCents("abc"))).toBe(true);
  });

  it("splits and joins benefit lines", () => {
    expect(splitBenefitLine("Vendas — Kanban")).toEqual({ title: "Vendas", detail: "Kanban" });
    expect(splitBenefitLine("Só título")).toEqual({ title: "Só título", detail: "" });
    expect(joinBenefit({ title: " Vendas ", detail: " Kanban " })).toBe("Vendas — Kanban");
    expect(joinBenefit({ title: "Vendas", detail: "" })).toBe("Vendas");
  });

  it("moves items within bounds", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
  });

  it("an untouched form produces an empty patch", () => {
    const r = buildPlanPatch(formFromSettings(original), original);
    expect(r).toEqual({ ok: true, patch: {} });
  });

  it("sends only what changed, in a shape the server accepts", () => {
    const form = formFromSettings(original);
    form.price = "99,90";
    form.calculator.tarifaEnergia = "0,95";
    form.benefits = [...form.benefits.slice(1), { title: "Novo", detail: "" }];
    const r = buildPlanPatch(form, original);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.patch.pro_price_cents).toBe(9990);
    expect(r.patch.calculator_defaults).toEqual({ tarifaEnergia: 0.95 });
    expect(r.patch.pro_benefits?.at(-1)).toBe("Novo");
    expect(r.patch.trial_days).toBeUndefined();
    expect(platformSettingsPatchSchema.safeParse(r.patch).success).toBe(true);
  });

  it("refuses out-of-range values with a readable message", () => {
    const form = formFromSettings(original);
    expect(buildPlanPatch({ ...form, price: "0,50" }, original)).toMatchObject({ ok: false });
    expect(buildPlanPatch({ ...form, trialDays: "120" }, original)).toMatchObject({ ok: false });
    const bad = formFromSettings(original);
    bad.calculator.riscoFalha = "150";
    const r = buildPlanPatch(bad, original);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Risco de falha/);
  });
});
