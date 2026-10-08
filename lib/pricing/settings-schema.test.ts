import { describe, expect, it } from "vitest";
import { DEFAULT_INPUTS } from "@/hooks/calculator/useCalculator";
import { PRO_PLANS } from "./pro-plans";
import { TRIAL_DAYS } from "@/lib/tenants/trial";
import {
  CALCULATOR_DEFAULT_KEYS,
  DEFAULT_CALCULATOR_DEFAULTS,
  DEFAULT_PLATFORM_SETTINGS,
  DEFAULT_PRO_BENEFITS,
  PRO_BENEFIT_MAX_CHARS,
  parsePlatformSettingsRow,
  platformSettingsPatchSchema,
  splitBenefit,
} from "./settings-schema";

describe("defaults mirror the values hard-coded before platform_settings", () => {
  it("PRO price, period and trial", () => {
    expect(DEFAULT_PLATFORM_SETTINGS.proPriceCents).toBe(PRO_PLANS.pro.amountCents);
    expect(DEFAULT_PLATFORM_SETTINGS.proPeriodDays).toBe(PRO_PLANS.pro.periodDays);
    expect(DEFAULT_PLATFORM_SETTINGS.trialDays).toBe(TRIAL_DAYS);
  });

  it("calculator defaults equal DEFAULT_INPUTS key by key", () => {
    expect(DEFAULT_CALCULATOR_DEFAULTS).toEqual(DEFAULT_INPUTS);
    expect([...CALCULATOR_DEFAULT_KEYS].sort()).toEqual(Object.keys(DEFAULT_INPUTS).sort());
  });

  it("benefits respect the limits the admin API enforces", () => {
    expect(DEFAULT_PRO_BENEFITS.length).toBeLessThanOrEqual(12);
    for (const b of DEFAULT_PRO_BENEFITS) expect(b.length).toBeLessThanOrEqual(PRO_BENEFIT_MAX_CHARS);
  });
});

describe("parsePlatformSettingsRow", () => {
  it("falls back to defaults for a missing row", () => {
    expect(parsePlatformSettingsRow(null)).toEqual(DEFAULT_PLATFORM_SETTINGS);
  });

  it("reads a valid row", () => {
    const s = parsePlatformSettingsRow({
      pro_price_cents: 12900,
      pro_period_days: 180,
      trial_days: 14,
      pro_benefits: ["Um", "Dois — detalhe"],
      calculator_defaults: { tarifaEnergia: 1.1 },
      updated_at: "2026-10-06T00:00:00Z",
    });
    expect(s.proPriceCents).toBe(12900);
    expect(s.proPeriodDays).toBe(180);
    expect(s.trialDays).toBe(14);
    expect(s.proBenefits).toEqual(["Um", "Dois — detalhe"]);
    expect(s.calculatorDefaults.tarifaEnergia).toBe(1.1);
    expect(s.calculatorDefaults.pesoPeca).toBe(DEFAULT_CALCULATOR_DEFAULTS.pesoPeca);
    expect(s.isFallback).toBe(false);
  });

  it("drops only the invalid field", () => {
    const s = parsePlatformSettingsRow({
      pro_price_cents: -5,
      pro_period_days: 365,
      trial_days: 7,
      pro_benefits: [],
      calculator_defaults: { riscoFalha: 500, quantidade: 2.5, margemLucro: 80 },
    });
    expect(s.proPriceCents).toBe(DEFAULT_PLATFORM_SETTINGS.proPriceCents);
    expect(s.proBenefits).toEqual([...DEFAULT_PRO_BENEFITS]);
    expect(s.calculatorDefaults.riscoFalha).toBe(DEFAULT_CALCULATOR_DEFAULTS.riscoFalha);
    expect(s.calculatorDefaults.quantidade).toBe(DEFAULT_CALCULATOR_DEFAULTS.quantidade);
    expect(s.calculatorDefaults.margemLucro).toBe(80);
  });
});

describe("platformSettingsPatchSchema", () => {
  it("accepts a partial patch", () => {
    expect(platformSettingsPatchSchema.safeParse({ pro_price_cents: 9900 }).success).toBe(true);
    expect(
      platformSettingsPatchSchema.safeParse({ calculator_defaults: { tarifaEnergia: 0.9 } }).success,
    ).toBe(true);
  });

  it("rejects empty, unknown keys and out-of-range values", () => {
    expect(platformSettingsPatchSchema.safeParse({}).success).toBe(false);
    expect(platformSettingsPatchSchema.safeParse({ id: 2 }).success).toBe(false);
    expect(platformSettingsPatchSchema.safeParse({ pro_price_cents: 50 }).success).toBe(false);
    expect(platformSettingsPatchSchema.safeParse({ trial_days: 91 }).success).toBe(false);
    expect(
      platformSettingsPatchSchema.safeParse({ calculator_defaults: { foo: 1 } }).success,
    ).toBe(false);
    expect(
      platformSettingsPatchSchema.safeParse({ pro_benefits: Array(13).fill("x") }).success,
    ).toBe(false);
    expect(
      platformSettingsPatchSchema.safeParse({ pro_benefits: ["x".repeat(121)] }).success,
    ).toBe(false);
  });
});

describe("splitBenefit", () => {
  it("splits on the first ' — '", () => {
    expect(splitBenefit("A — b — c")).toEqual({ title: "A", detail: "b — c" });
    expect(splitBenefit("Só título")).toEqual({ title: "Só título", detail: null });
  });
});
