/**
 * Plan changes made by the platform owner (the /admin/assinantes panel).
 *
 * PURE on purpose: each function only computes the column patch. Writing it is
 * `write.ts`'s job. The rules that are easy to get wrong live here, where they
 * can be tested without a database:
 *
 *  - extending a plan ADDS to the remaining time (`nextExpiry`), it never resets;
 *  - extending a plan that never expires would SHORTEN it, so it is refused;
 *  - revoking also ends an active trial, otherwise "remove plan" would leave the
 *    org with PRO access through `trial_ends_at` and the button would lie.
 */
import { nextExpiry } from "./expiry";
import type { PlanTier } from "./types";

const PAID_TIERS: readonly PlanTier[] = ["pro", "enterprise"];

/** The three plan columns of `organizations`, as read from the database. */
export interface PlanColumnsRow {
  plan: string | null;
  trial_ends_at: string | null;
  plan_expires_at: string | null;
}

/** What gets written. `trial_ends_at` is only present when it must change. */
export interface PlanPatch {
  plan: PlanTier;
  plan_expires_at: string | null;
  trial_ends_at?: string | null;
}

export type PlanPatchErrorCode = "expiry_in_past" | "invalid_expiry" | "no_expiry_to_extend";

export type PlanPatchResult =
  | { ok: true; patch: PlanPatch }
  | { ok: false; code: PlanPatchErrorCode; message: string };

function isPaid(plan: string | null): plan is "pro" | "enterprise" {
  return PAID_TIERS.includes(plan as PlanTier);
}

/**
 * Sets the plan explicitly.
 *
 * `expiresAt = null` with a paid tier means "never expires" (same meaning as the
 * column). For `standard` the expiry is meaningless and is always cleared —
 * keeping a stale date there would resurface as "PRO until X" if someone later
 * flipped the tier by hand. The trial is NOT touched: downgrading is not the
 * same as revoking (use `revokePlan` for that).
 */
export function setPlan(
  input: { plan: PlanTier; expiresAt: string | null },
  now: Date = new Date(),
): PlanPatchResult {
  if (input.plan === "standard") {
    return { ok: true, patch: { plan: "standard", plan_expires_at: null } };
  }
  if (input.expiresAt === null) {
    return { ok: true, patch: { plan: input.plan, plan_expires_at: null } };
  }
  const ts = Date.parse(input.expiresAt);
  if (!Number.isFinite(ts)) {
    return { ok: false, code: "invalid_expiry", message: "Data de vencimento inválida." };
  }
  // Granting a plan that is already expired is always an operator mistake
  // (typo in the year) and would silently lock the customer out.
  if (ts <= now.getTime()) {
    return {
      ok: false,
      code: "expiry_in_past",
      message: "A data de vencimento precisa estar no futuro.",
    };
  }
  return { ok: true, patch: { plan: input.plan, plan_expires_at: new Date(ts).toISOString() } };
}

/**
 * Adds `days` of paid access.
 *
 * Standard orgs (trial or free) become `pro`; enterprise stays enterprise. A
 * paid plan with no expiry is refused: computing `now + days` would turn
 * "never expires" into a finite date — extending would remove access.
 */
export function extendPlan(
  current: PlanColumnsRow,
  days: number,
  now: Date = new Date(),
): PlanPatchResult {
  if (isPaid(current.plan) && current.plan_expires_at === null) {
    return {
      ok: false,
      code: "no_expiry_to_extend",
      message: "Este plano não tem vencimento — não há o que estender.",
    };
  }
  const tier: PlanTier = isPaid(current.plan) ? current.plan : "pro";
  // A leftover expiry on a standard org is not "remaining paid time".
  const base = isPaid(current.plan) ? current.plan_expires_at : null;
  return { ok: true, patch: { plan: tier, plan_expires_at: nextExpiry(base, days, now) } };
}

/**
 * Removes paid access AND ends an active trial.
 *
 * `trial_ends_at` becomes `min(trial_ends_at, now)`: a trial still running is
 * cut to now; a trial already over (or none) is left as is, so the history of
 * "this org had a trial" survives.
 */
export function revokePlan(current: PlanColumnsRow, now: Date = new Date()): PlanPatch {
  const trialTs = current.trial_ends_at ? Date.parse(current.trial_ends_at) : NaN;
  const trialActive = Number.isFinite(trialTs) && trialTs > now.getTime();
  return {
    plan: "standard",
    plan_expires_at: null,
    trial_ends_at: trialActive ? now.toISOString() : current.trial_ends_at,
  };
}
