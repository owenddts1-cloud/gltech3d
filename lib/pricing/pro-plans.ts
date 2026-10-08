/**
 * Catálogo de planos do Calc3D PRO.
 *
 * Por que aqui e não em env ou no banco: o preço é copy da página de venda e
 * precisa ser revisável em PR e testável. Mais importante — `amount_cents` nunca
 * pode chegar pelo corpo da requisição. A rota pública de intake deriva o valor
 * DESTE arquivo a partir do `plan`, o que elimina a classe inteira de tampering
 * de preço em vez de tentar validá-la.
 *
 * Só existe um plano pago hoje porque o Pix é manual: cobrar mensalidade por Pix
 * à mão é inviável, então a cobrança é anual e única. Mensal entra quando houver
 * gateway com webhook.
 */

export type ProPlanId = 'pro';

export interface ProPlan {
  readonly id: ProPlanId;
  readonly label: string;
  readonly amountCents: number;
  readonly currency: 'BRL';
  /** Período coberto por um pagamento, em dias. Usado só na copy por enquanto. */
  readonly periodDays: number;
  readonly tagline: string;
}

export const PRO_PLANS: Readonly<Record<ProPlanId, ProPlan>> = {
  pro: {
    id: 'pro',
    label: 'Calc3D PRO — Anual',
    amountCents: 8900,
    currency: 'BRL',
    periodDays: 365,
    tagline: 'Um Pix por ano. Sem mensalidade, sem cartão, sem fidelidade.',
  },
} as const;

export function getProPlan(id: ProPlanId): ProPlan {
  return PRO_PLANS[id];
}

/** Formata centavos em BRL. Centraliza o locale para a página e o e-mail não divergirem. */
export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

/** Preço equivalente por mês, só para a copy ("sai por R$ X/mês"). */
export function monthlyEquivalentCents(plan: ProPlan): number {
  const months = plan.periodDays / 30.4375;
  return Math.round(plan.amountCents / months);
}

/**
 * The plan with the price/period currently set in `platform_settings`.
 *
 * `PRO_PLANS` keeps the TYPE and the defaults; the live values come from
 * `getProPlanLive()` (lib/pricing/settings.ts) on the server. Pure, so client
 * components can rebuild the plan from the numbers their page passed down.
 */
export function proPlanWith(values: { amountCents: number; periodDays: number }): ProPlan {
  const base = PRO_PLANS.pro;
  const isYearly = values.periodDays === 365 || values.periodDays === 366;
  return {
    ...base,
    amountCents: values.amountCents,
    periodDays: values.periodDays,
    label: isYearly ? base.label : `Calc3D PRO — ${values.periodDays} dias`,
    tagline: isYearly
      ? base.tagline
      : `Um Pix a cada ${values.periodDays} dias. Sem cartão, sem fidelidade.`,
  };
}

/** Suffix after the price: "ano", "mês" or "N dias". */
export function periodSuffix(periodDays: number): string {
  if (periodDays === 365 || periodDays === 366) return "ano";
  if (periodDays === 30 || periodDays === 31) return "mês";
  return `${periodDays} dias`;
}
