/**
 * Form model of /admin/planos (PATCH /api/v1/admin/platform-settings).
 *
 * Pure: field metadata for the 12 calculator defaults (labels, units, ranges —
 * a test keeps the ranges equal to `calculatorDefaultsShape`), the benefit list
 * editing helpers and the minimal PATCH diff. The server validates again with
 * `platformSettingsPatchSchema`.
 */
import {
  CALCULATOR_DEFAULT_KEYS,
  PRO_BENEFIT_MAX_CHARS,
  PRO_BENEFIT_MAX_ITEMS,
  type CalculatorDefaultKey,
  type CalculatorDefaults,
} from "@/lib/pricing/settings-schema";

export interface CalculatorFieldMeta {
  key: CalculatorDefaultKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  integer?: boolean;
}

/** Same order as the public calculator form. */
export const CALCULATOR_FIELDS: readonly CalculatorFieldMeta[] = [
  { key: "pesoPeca", label: "Peso da peça", unit: "g", min: 0.1, max: 100_000, step: 1 },
  { key: "precoFilamento", label: "Preço do filamento", unit: "R$/kg", min: 1, max: 10_000, step: 1 },
  { key: "tempoImpressao", label: "Tempo de impressão", unit: "h", min: 0, max: 1_000, step: 0.25 },
  { key: "potenciaMedia", label: "Potência média", unit: "W", min: 1, max: 5_000, step: 10 },
  { key: "tarifaEnergia", label: "Tarifa de energia", unit: "R$/kWh", min: 0, max: 10, step: 0.05 },
  { key: "valorMaquina", label: "Valor da máquina", unit: "R$", min: 0, max: 1_000_000, step: 100 },
  { key: "vidaUtil", label: "Vida útil", unit: "h", min: 1, max: 1_000_000, step: 500 },
  { key: "horaTrabalho", label: "Hora de trabalho", unit: "R$/h", min: 0, max: 10_000, step: 1 },
  { key: "horasManuais", label: "Horas manuais", unit: "h", min: 0, max: 1_000, step: 0.05 },
  { key: "quantidade", label: "Quantidade", unit: "un", min: 1, max: 100_000, step: 1, integer: true },
  { key: "margemLucro", label: "Margem de lucro", unit: "%", min: 0, max: 1_000, step: 5 },
  { key: "riscoFalha", label: "Risco de falha", unit: "%", min: 0, max: 100, step: 1 },
];

/** Settings as the admin API returns them (snake_case). */
export interface PlatformSettingsJson {
  pro_price_cents: number;
  pro_period_days: number;
  trial_days: number;
  pro_benefits: string[];
  calculator_defaults: CalculatorDefaults;
  updated_at: string | null;
}

export interface PlanFormState {
  /** "89,00" — what the person types. */
  price: string;
  periodDays: string;
  trialDays: string;
  benefits: Array<{ title: string; detail: string }>;
  calculator: Record<CalculatorDefaultKey, string>;
}

const decimalStr = (n: number) => String(n).replace(".", ",");

export function splitBenefitLine(line: string): { title: string; detail: string } {
  const idx = line.indexOf(" — ");
  if (idx <= 0) return { title: line.trim(), detail: "" };
  return { title: line.slice(0, idx).trim(), detail: line.slice(idx + 3).trim() };
}

export function joinBenefit(b: { title: string; detail: string }): string {
  const t = b.title.trim();
  const d = b.detail.trim();
  return d ? `${t} — ${d}` : t;
}

export function formFromSettings(s: PlatformSettingsJson): PlanFormState {
  const calculator = {} as Record<CalculatorDefaultKey, string>;
  for (const key of CALCULATOR_DEFAULT_KEYS) calculator[key] = decimalStr(s.calculator_defaults[key]);
  return {
    price: (s.pro_price_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    periodDays: String(s.pro_period_days),
    trialDays: String(s.trial_days),
    benefits: s.pro_benefits.map(splitBenefitLine),
    calculator,
  };
}

/** "1.234,56" / "89" / "89.9" → cents; NaN when not a number. */
export function parsePriceToCents(raw: string): number {
  const s = raw.replace(/[R$\s]/g, "");
  if (!s) return Number.NaN;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  return Math.round(Number(normalized) * 100);
}

export function parseDecimalInput(raw: string): number {
  const s = raw.trim().replace(",", ".");
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return Number.NaN;
  return Number(s);
}

/** Moves item `i` one step up (-1) or down (+1). Out of range = unchanged. */
export function moveItem<T>(list: readonly T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return [...list];
  const next = [...list];
  const a = next[i] as T;
  next[i] = next[j] as T;
  next[j] = a;
  return next;
}

export type PlanPatch = Partial<{
  pro_price_cents: number;
  pro_period_days: number;
  trial_days: number;
  pro_benefits: string[];
  calculator_defaults: Partial<CalculatorDefaults>;
}>;

export type BuildPatchResult = { ok: true; patch: PlanPatch } | { ok: false; error: string };

/** Validates the form and returns only what changed against `original`. */
export function buildPlanPatch(form: PlanFormState, original: PlatformSettingsJson): BuildPatchResult {
  const patch: PlanPatch = {};

  const price = parsePriceToCents(form.price);
  if (!Number.isInteger(price) || price < 100 || price > 10_000_000) {
    return { ok: false, error: "Preço entre R$ 1,00 e R$ 100.000,00." };
  }
  if (price !== original.pro_price_cents) patch.pro_price_cents = price;

  const period = Number(form.periodDays);
  if (!Number.isInteger(period) || period < 1 || period > 3650) return { ok: false, error: "Período entre 1 e 3650 dias." };
  if (period !== original.pro_period_days) patch.pro_period_days = period;

  const trial = Number(form.trialDays);
  if (!Number.isInteger(trial) || trial < 0 || trial > 90) return { ok: false, error: "Teste grátis entre 0 e 90 dias." };
  if (trial !== original.trial_days) patch.trial_days = trial;

  const lines = form.benefits.filter((b) => b.title.trim()).map(joinBenefit);
  if (form.benefits.some((b) => !b.title.trim() && b.detail.trim())) {
    return { ok: false, error: "Todo benefício precisa de um título." };
  }
  if (lines.length > PRO_BENEFIT_MAX_ITEMS) return { ok: false, error: `No máximo ${PRO_BENEFIT_MAX_ITEMS} benefícios.` };
  const tooLong = lines.find((l) => l.length > PRO_BENEFIT_MAX_CHARS);
  if (tooLong) return { ok: false, error: `Benefício com mais de ${PRO_BENEFIT_MAX_CHARS} caracteres: “${tooLong.slice(0, 40)}…”` };
  if (JSON.stringify(lines) !== JSON.stringify(original.pro_benefits)) patch.pro_benefits = lines;

  const calc: Partial<CalculatorDefaults> = {};
  for (const f of CALCULATOR_FIELDS) {
    const v = parseDecimalInput(form.calculator[f.key]);
    if (!Number.isFinite(v) || v < f.min || v > f.max || (f.integer && !Number.isInteger(v))) {
      return {
        ok: false,
        error: `${f.label}: use um valor entre ${decimalStr(f.min)} e ${f.max.toLocaleString("pt-BR")} ${f.unit}.`,
      };
    }
    if (v !== original.calculator_defaults[f.key]) calc[f.key] = v;
  }
  if (Object.keys(calc).length > 0) patch.calculator_defaults = calc;

  return { ok: true, patch };
}
