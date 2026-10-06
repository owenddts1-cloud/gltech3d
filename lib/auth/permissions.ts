import { ROLE_RANK, type Role } from "./types";

/**
 * Client-side permission map: action -> minimum role inside the tenant.
 *
 * This is COSMETIC (hides menu items and buttons the user cannot use). The real
 * gate is always on the server (page guards, route handlers, RLS). Keep each
 * entry aligned with the guard of the screen it represents, otherwise the menu
 * shows an item that leads to /403.
 */
export const ACTION_MIN_ROLE = {
  "inbox.view": "viewer",
  "inbox.reply": "agent",
  "inbox.claim": "agent",
  "contact.view": "viewer",
  "contact.create": "agent",
  "contact.update": "agent",
  // RLS (migration 0084): DELETE on contacts is admin-only.
  "contact.delete": "admin",
  "pipeline.view": "viewer",
  "pipeline.create": "manager",
  "pipeline.move_card": "agent",
  "team.invite": "admin",
  "team.change_role": "admin",
  "settings.write": "admin",
  // app/app/settings/tenant/page.tsx redirects non-admins to /403.
  "org.settings.manage": "admin",
  // app/app/(pro)/connections/page.tsx redirects non-admins to /403.
  "channels.manage": "admin",
  "lgpd.execute_redact": "admin",
  "audit.view": "manager",
  // app/app/(pro)/ai/agents/page.tsx redirects below manager to /403.
  "ai.agents.view": "manager",
  "ai.agents.write": "admin",
  "ai.credentials.view": "manager",
  "ai.credentials.write": "admin",
} as const satisfies Record<string, Role>;

export type PermissionAction = keyof typeof ACTION_MIN_ROLE;

function isKnownAction(action: string): action is PermissionAction {
  return Object.prototype.hasOwnProperty.call(ACTION_MIN_ROLE, action);
}

/**
 * Pure permission check. Unknown actions are denied (fail closed): a typo in an
 * action name must hide the item, never expose it.
 */
export function roleCan(
  role: Role | null | undefined,
  action: string,
  opts?: { isPlatformAdmin?: boolean },
): boolean {
  if (opts?.isPlatformAdmin) return true;
  if (!role) return false;
  if (!isKnownAction(action)) return false;
  return ROLE_RANK[role] >= ROLE_RANK[ACTION_MIN_ROLE[action]];
}
