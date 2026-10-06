/**
 * Vocabulario de plano e trial.
 *
 * `PlanState` e o unico formato que a UI e o gate consultam. Ele e DERIVADO das
 * tres colunas de `organizations` (plan, trial_ends_at, plan_expires_at) por
 * `resolvePlanState` — nada aqui e persistido.
 */

export type PlanTier = "standard" | "pro" | "enterprise";

export type PlanStatus =
  /** standard com `trial_ends_at` no futuro. */
  | "trialing"
  /** pro/enterprise valido — inclui o caso sem expiracao. */
  | "active"
  /** standard cujo trial ja venceu. */
  | "trial_expired"
  /** pro/enterprise com `plan_expires_at` no passado. */
  | "expired"
  /** standard que nunca trialou. */
  | "none";

export interface PlanState {
  tier: PlanTier;
  status: PlanStatus;
  /** O unico booleano que o gate consulta. */
  hasProAccess: boolean;
  /** Dias inteiros restantes do trial (ceil, clampado em 0). `null` fora do trial. */
  trialDaysLeft: number | null;
  trialEndsAt: string | null;
  planExpiresAt: string | null;
}

/** Entrada crua, como sai do SELECT em `organizations`. */
export interface PlanRow {
  plan: string | null;
  trialEndsAt: string | Date | null;
  planExpiresAt: string | Date | null;
}
