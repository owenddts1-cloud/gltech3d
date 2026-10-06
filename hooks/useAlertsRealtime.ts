"use client";

/**
 * Platform alerts realtime: intentionally DISABLED.
 *
 * It listened on the public broadcast channel `alerts-platform`, which:
 *  - no server code ever published to (a consumer without a producer), and
 *  - anyone with the anon key could publish to, putting attacker-chosen text
 *    (`payload.message`) into a super-admin toast.
 *
 * Supabase broadcast has no authorization yet (see
 * docs/runbooks/pendencias-em-aberto.md), so no cross-tenant channel may exist.
 * The dashboard KPIs (alerts included) already refresh by polling every 30s
 * (`useAdminDashboardKPIs`). Kept as a no-op so the caller needs no change.
 */
export function useAlertsRealtime(): void {
  // No subscription by design — see the comment above.
}
