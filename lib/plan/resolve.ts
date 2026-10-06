/**
 * Decisao de plano, pura e testavel sem banco.
 *
 * Roda no servidor (gate) e no cliente (cadeado, badge) a partir do mesmo
 * codigo — e por isso este arquivo nao importa React nem Supabase.
 */
import type { PlanRow, PlanState, PlanStatus, PlanTier } from "./types";

const TIERS: readonly PlanTier[] = ["standard", "pro", "enterprise"];
const MS_PER_DAY = 86_400_000;

function toTier(raw: string | null): PlanTier {
  // Fail-closed: plano desconhecido (clone antigo, dado corrompido, coluna nova
  // que alguem esqueceu de mapear) vale como gratuito. O contrario daria acesso
  // PRO de graca a quem tem lixo na coluna.
  return TIERS.includes(raw as PlanTier) ? (raw as PlanTier) : "standard";
}

function toDate(v: string | Date | null): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Dias restantes ate `end`, arredondando para CIMA e nunca abaixo de zero.
 *
 * `ceil` e deliberado: com `floor`, o ultimo dia do trial mostraria "0 dias"
 * enquanto o acesso ainda funciona. O clamp evita "-3 dias" no badge.
 */
function daysUntil(end: Date, now: Date): number {
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY));
}

export function resolvePlanState(input: PlanRow & { now?: Date }): PlanState {
  const now = input.now ?? new Date();
  const tier = toTier(input.plan);
  const trialEnds = toDate(input.trialEndsAt);
  const planExpires = toDate(input.planExpiresAt);

  const trialEndsAt = trialEnds?.toISOString() ?? null;
  const planExpiresAt = planExpires?.toISOString() ?? null;

  if (tier === "pro" || tier === "enterprise") {
    // `plan_expires_at` NULL significa SEM EXPIRACAO. Ler isto como "expirou"
    // trancaria, no deploy da migration 0082, toda org que ja era PRO antes de
    // existir data de vencimento — inclusive a da propria GLTech3D.
    const active = planExpires === null || planExpires.getTime() > now.getTime();
    const status: PlanStatus = active ? "active" : "expired";
    return {
      tier,
      status,
      hasProAccess: active,
      trialDaysLeft: null,
      trialEndsAt,
      planExpiresAt,
    };
  }

  // standard: o trial e uma janela sobre o plano gratuito, nao um plano.
  if (trialEnds && trialEnds.getTime() > now.getTime()) {
    return {
      tier,
      status: "trialing",
      hasProAccess: true,
      trialDaysLeft: daysUntil(trialEnds, now),
      trialEndsAt,
      planExpiresAt,
    };
  }

  return {
    tier,
    status: trialEnds ? "trial_expired" : "none",
    hasProAccess: false,
    trialDaysLeft: trialEnds ? 0 : null,
    trialEndsAt,
    planExpiresAt,
  };
}

/**
 * Texto do selo na sidebar. `null` quando nao ha plano resolvido — a UI entao
 * nao desenha selo nenhum, em vez de mentir dizendo "PRO" como fazia antes.
 */
export function planBadgeLabel(state: PlanState | null): string | null {
  if (!state) return null;
  switch (state.status) {
    case "active":
      return "PRO";
    case "trialing": {
      const n = state.trialDaysLeft ?? 0;
      return `TRIAL · ${n} ${n === 1 ? "dia" : "dias"}`;
    }
    case "trial_expired":
    case "expired":
    case "none":
      return "GRÁTIS";
  }
}
