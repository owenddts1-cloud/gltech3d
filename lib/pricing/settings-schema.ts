/**
 * Platform settings (`platform_settings`, single row id = 1, migration 0087):
 * PRO price/period, trial length, PRO benefits and the public calculator
 * defaults. Editable by the platform admin at runtime instead of a deploy.
 *
 * PURE module: the Zod contract, the defaults and the lenient row parser. The
 * server reader lives in `lib/pricing/settings.ts`. Client components never
 * read the table — their server page passes the values down as props.
 *
 * DEFAULTS mirror what was hard-coded before this table existed
 * (lib/pricing/pro-plans.ts, lib/tenants/trial.ts and DEFAULT_INPUTS of
 * hooks/calculator/useCalculator.ts — a test keeps them equal). They are what
 * the site shows when the row is missing, unreadable or a field is invalid.
 */
import { z } from "zod";

/** Keys of `CalculatorInputs` (hooks/calculator/useCalculator.ts) with sane ranges. */
export const calculatorDefaultsShape = {
  /** Part weight, g. */
  pesoPeca: z.number().min(0.1).max(100_000),
  /** Filament price, R$/kg. */
  precoFilamento: z.number().min(1).max(10_000),
  /** Print time, h. */
  tempoImpressao: z.number().min(0).max(1_000),
  /** Average power, W. */
  potenciaMedia: z.number().min(1).max(5_000),
  /** Energy tariff, R$/kWh. */
  tarifaEnergia: z.number().min(0).max(10),
  /** Machine price, R$. */
  valorMaquina: z.number().min(0).max(1_000_000),
  /** Machine lifetime, h. */
  vidaUtil: z.number().min(1).max(1_000_000),
  /** Labor rate, R$/h. */
  horaTrabalho: z.number().min(0).max(10_000),
  /** Manual labor per part, h. */
  horasManuais: z.number().min(0).max(1_000),
  /** Batch size, units. */
  quantidade: z.number().int().min(1).max(100_000),
  /** Profit margin, %. */
  margemLucro: z.number().min(0).max(1_000),
  /** Failure risk, %. */
  riscoFalha: z.number().min(0).max(100),
} as const;

export type CalculatorDefaultKey = keyof typeof calculatorDefaultsShape;
export const CALCULATOR_DEFAULT_KEYS = Object.keys(calculatorDefaultsShape) as CalculatorDefaultKey[];

export const calculatorDefaultsSchema = z.object(calculatorDefaultsShape).strict();
export type CalculatorDefaults = z.infer<typeof calculatorDefaultsSchema>;

export const PRO_BENEFIT_MAX_ITEMS = 12;
export const PRO_BENEFIT_MAX_CHARS = 120;

export const proBenefitsSchema = z
  .array(z.string().trim().min(1).max(PRO_BENEFIT_MAX_CHARS))
  .max(PRO_BENEFIT_MAX_ITEMS);

/** Limits mirror the CHECK constraints of 0087. */
export const proPriceCentsSchema = z.number().int().min(100).max(10_000_000);
export const proPeriodDaysSchema = z.number().int().min(1).max(3650);
export const trialDaysSchema = z.number().int().min(0).max(90);

/** Body of PATCH /api/v1/admin/platform-settings (snake_case, all optional, strict). */
export const platformSettingsPatchSchema = z
  .object({
    pro_price_cents: proPriceCentsSchema,
    pro_period_days: proPeriodDaysSchema,
    trial_days: trialDaysSchema,
    /** `[]` means "use the default list". */
    pro_benefits: proBenefitsSchema,
    /** Partial: keys left out fall back to the defaults. */
    calculator_defaults: z.object(calculatorDefaultsShape).partial().strict(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para atualizar." });
export type PlatformSettingsPatch = z.infer<typeof platformSettingsPatchSchema>;

export interface PlatformSettings {
  proPriceCents: number;
  proPeriodDays: number;
  trialDays: number;
  /**
   * Benefit lines of the PRO card. `"Título — detalhe"` renders the part before
   * " — " in bold. Empty list in the row = these defaults.
   */
  proBenefits: string[];
  calculatorDefaults: CalculatorDefaults;
  updatedAt: string | null;
  /** True when every value came from DEFAULTS (row missing or unreadable). */
  isFallback: boolean;
}

export const DEFAULT_PRO_BENEFITS: readonly string[] = [
  "Vendas e funil — Pedido do orçamento ao pago, em quadro Kanban com histórico.",
  "Produção e ordens de serviço — Fila de impressão, projetos e OS com documento para o cliente.",
  "Impressoras e filamentos — Cadastro de máquinas e estoque de material puxado direto para o custo.",
  "Produtos com custo real — Ficha do produto calculada pelo mesmo motor desta calculadora.",
  "Dinheiro a receber e a pagar — Lançamentos, despesas e relatório do mês.",
  "Vendas de marketplaces — Registre no CRM os pedidos de Mercado Livre, Shopee e Facebook e veja tudo num painel só.",
  "Inbox do WhatsApp — Atendimento dentro do CRM quando a integração for ativada no seu número.",
  "PDF com a sua marca — Orçamento e ordem de serviço com logo e dados da sua empresa.",
  "Modelos 3D e fatiador — Repositório de peças, estimativa de peso e tempo a partir do STL/3MF.",
  "Estoque e fornecedores — Insumos, consumíveis e compras.",
  "Vitrine pública editável — Sua própria landing de catálogo, editada no painel.",
  "Equipe, auditoria e LGPD — Convite por papel, trilha de auditoria e pedidos de titular.",
];

export const DEFAULT_CALCULATOR_DEFAULTS: CalculatorDefaults = {
  pesoPeca: 45,
  precoFilamento: 110,
  tempoImpressao: 3,
  potenciaMedia: 200,
  tarifaEnergia: 0.85,
  valorMaquina: 3500,
  vidaUtil: 5000,
  horaTrabalho: 1,
  horasManuais: 0.25,
  quantidade: 1,
  margemLucro: 100,
  riscoFalha: 15,
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  proPriceCents: 8900,
  proPeriodDays: 365,
  trialDays: 7,
  proBenefits: [...DEFAULT_PRO_BENEFITS],
  calculatorDefaults: { ...DEFAULT_CALCULATOR_DEFAULTS },
  updatedAt: null,
  isFallback: true,
};

/** Splits `"Título — detalhe"` for rendering. No separator = title only. */
export function splitBenefit(line: string): { title: string; detail: string | null } {
  const idx = line.indexOf(" — ");
  if (idx <= 0) return { title: line, detail: null };
  return { title: line.slice(0, idx), detail: line.slice(idx + 3) };
}

/**
 * Row (raw from PostgREST) → settings. Lenient by field: one invalid value
 * falls back to ITS default instead of discarding the whole row, so a bad
 * calculator key never takes the PRO price down with it.
 */
export function parsePlatformSettingsRow(row: unknown): PlatformSettings {
  if (typeof row !== "object" || row === null) return { ...DEFAULT_PLATFORM_SETTINGS };
  const r = row as Record<string, unknown>;
  const pick = <T>(schema: z.ZodType<T>, value: unknown, fallback: T): T => {
    const parsed = schema.safeParse(typeof value === "string" && value.trim() !== "" ? Number(value) : value);
    return parsed.success ? parsed.data : fallback;
  };

  const benefitsParsed = proBenefitsSchema.safeParse(r.pro_benefits);
  const proBenefits =
    benefitsParsed.success && benefitsParsed.data.length > 0
      ? benefitsParsed.data
      : [...DEFAULT_PRO_BENEFITS];

  const rawCalc =
    typeof r.calculator_defaults === "object" && r.calculator_defaults !== null
      ? (r.calculator_defaults as Record<string, unknown>)
      : {};
  const calculatorDefaults = { ...DEFAULT_CALCULATOR_DEFAULTS };
  for (const key of CALCULATOR_DEFAULT_KEYS) {
    const parsed = calculatorDefaultsShape[key].safeParse(rawCalc[key]);
    if (parsed.success) calculatorDefaults[key] = parsed.data;
  }

  return {
    proPriceCents: pick(proPriceCentsSchema, r.pro_price_cents, DEFAULT_PLATFORM_SETTINGS.proPriceCents),
    proPeriodDays: pick(proPeriodDaysSchema, r.pro_period_days, DEFAULT_PLATFORM_SETTINGS.proPeriodDays),
    trialDays: pick(trialDaysSchema, r.trial_days, DEFAULT_PLATFORM_SETTINGS.trialDays),
    proBenefits,
    calculatorDefaults,
    updatedAt: typeof r.updated_at === "string" ? r.updated_at : null,
    isFallback: false,
  };
}

/** Settings → the snake_case JSON of the admin API. */
export function platformSettingsToJson(s: PlatformSettings) {
  return {
    pro_price_cents: s.proPriceCents,
    pro_period_days: s.proPeriodDays,
    trial_days: s.trialDays,
    pro_benefits: s.proBenefits,
    calculator_defaults: s.calculatorDefaults,
    updated_at: s.updatedAt,
  };
}

/**
 * What a server page hands to client components about the PRO offer. Client
 * code never reads `platform_settings` itself — it receives this as a prop.
 */
export interface PublicProPricing {
  amountCents: number;
  periodDays: number;
  trialDays: number;
  /** Benefit lines (`"Título — detalhe"`, see `splitBenefit`). */
  benefits: string[];
}

export function toPublicProPricing(s: PlatformSettings): PublicProPricing {
  return {
    amountCents: s.proPriceCents,
    periodDays: s.proPeriodDays,
    trialDays: s.trialDays,
    benefits: s.proBenefits,
  };
}
