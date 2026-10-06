/**
 * Pure active-org resolution (no cookies, no I/O) so the rule is unit-testable.
 * lib/auth/server.ts reads the cookie and delegates here.
 */
import type { ActiveOrg, AuthUser, UserOrgMembership } from "./types";

/**
 * The membership the request is operating on, REGARDLESS of the org's status.
 * Priority: cookie `active_org` (if member of) → first membership.
 *
 * Only `loadAppShellContext()` should consume this directly: it needs to know
 * that the selected org is suspended in order to redirect to /account-suspended.
 */
export function pickSelectedMembership(
  user: AuthUser,
  cookieOrgId: string | null | undefined,
): UserOrgMembership | null {
  if (user.organizations.length === 0) return null;
  if (cookieOrgId) {
    const found = user.organizations.find((o) => o.organization_id === cookieOrgId);
    if (found) return found;
  }
  return user.organizations[0] ?? null;
}

/**
 * Whether the org of this membership may be operated on. Since migration 0084
 * RLS (`fn_user_org_ids`) only recognises orgs with status `active`; the app
 * mirrors it so API handlers and server actions get `null` instead of running
 * queries that RLS would silently empty. Platform admins keep access (they
 * pass RLS through `fn_is_platform_admin()`).
 *
 * `organization_status` is null when the org row was not readable — which,
 * for a non-admin member, is exactly what RLS does to a suspended org.
 */
export function isMembershipUsable(m: UserOrgMembership, user: AuthUser): boolean {
  return user.is_platform_admin || m.organization_status === "active";
}

export function toActiveOrg(m: UserOrgMembership): ActiveOrg {
  return { orgId: m.organization_id, name: m.organization_name, role: m.role };
}

/**
 * The org API handlers and server actions run against. Never falls back to a
 * different org when the selected one is suspended: switching tenant silently
 * under a mutation is worse than refusing it.
 */
export function pickActiveOrg(
  user: AuthUser,
  cookieOrgId: string | null | undefined,
): ActiveOrg | null {
  const m = pickSelectedMembership(user, cookieOrgId);
  if (!m || !isMembershipUsable(m, user)) return null;
  return toActiveOrg(m);
}
