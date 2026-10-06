/**
 * What a PRO approval does - or deliberately does NOT do - with the buyer's
 * membership in the org that receives the plan. Pure and client-safe (the
 * panel and the /aprovar page render the warning).
 *
 * Approval NEVER changes an existing membership: a paid request is not proof
 * of authority inside the org, and promoting the requester would let any
 * viewer/agent buy their way to admin. A revoked membership is reported, never
 * silently reactivated - the owner decides in the Assinantes panel.
 */
export type BuyerMembership =
  /** Buyer already an active member; role untouched. */
  | "active_kept"
  /** Buyer's membership was revoked; NOT reactivated. */
  | "revoked_not_reactivated"
  /** Account exists but has no row in this org; nothing created. */
  | "missing_not_created"
  /** No account with the buyer's e-mail. */
  | "no_account";

export function buyerMembershipOutcome(
  userId: string | null,
  row: { revoked_at: string | null } | null,
): BuyerMembership {
  if (!userId) return "no_account";
  if (!row) return "missing_not_created";
  return row.revoked_at ? "revoked_not_reactivated" : "active_kept";
}

/** Warning for the operator, or `null` when nothing needs attention. */
export function buyerMembershipWarning(m: BuyerMembership | null | undefined): string | null {
  switch (m) {
    case "revoked_not_reactivated":
      return "O acesso do comprador a esta organização estava REVOGADO e não foi reativado. O plano foi liberado para a organização; se ele deve voltar, um admin da organização precisa convidá-lo de novo.";
    case "missing_not_created":
      return "A conta do comprador não é membro desta organização e nenhum acesso foi criado. O plano foi liberado para a organização; um admin dela precisa convidá-lo.";
    default:
      return null;
  }
}
