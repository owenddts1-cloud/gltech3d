"use client";
import { Badge } from "@/components/ui/badge";
import type { PlanState } from "@/lib/plan/types";

export function formatDay(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const TIER_LABEL = { standard: "Gratuito", pro: "PRO", enterprise: "Enterprise" } as const;

/** Status of the plan in one badge, derived by `resolvePlanState` (same as the gate). */
export function PlanStatusBadge({ state }: { state: PlanState | null }) {
  if (!state) return <Badge variant="neutral">—</Badge>;
  switch (state.status) {
    case "active":
      return <Badge variant="success">{TIER_LABEL[state.tier]} ativo</Badge>;
    case "trialing": {
      const n = state.trialDaysLeft ?? 0;
      return (
        <Badge variant="info">
          Trial · {n} {n === 1 ? "dia" : "dias"}
        </Badge>
      );
    }
    case "expired":
      return <Badge variant="error">{TIER_LABEL[state.tier]} vencido</Badge>;
    case "trial_expired":
      return <Badge variant="warning">Trial encerrado</Badge>;
    case "none":
      return <Badge variant="neutral">Gratuito</Badge>;
  }
}

/** The date that matters for the current status, in words. */
export function planExpiryText(state: PlanState | null): string {
  if (!state) return "—";
  switch (state.status) {
    case "active":
      return state.planExpiresAt ? `até ${formatDay(state.planExpiresAt)}` : "sem vencimento";
    case "expired":
      return `venceu em ${formatDay(state.planExpiresAt)}`;
    case "trialing":
      return `trial até ${formatDay(state.trialEndsAt)}`;
    case "trial_expired":
      return `trial acabou em ${formatDay(state.trialEndsAt)}`;
    case "none":
      return "—";
  }
}

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Recusado",
  cancelled: "Cancelado",
};
