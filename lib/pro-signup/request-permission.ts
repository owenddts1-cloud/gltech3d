/**
 * Who may file an in-app PRO request (`POST /api/v1/pro-signup/upgrade`).
 *
 * Only the org admin (or a platform admin). The request carries the org id from
 * the session, and approving it grants the plan to that org — a viewer/agent
 * filing it would be deciding billing for the whole org. Pure so the route and
 * the billing screen apply the same rule.
 */
import type { Role } from "@/lib/auth/types";

export const PRO_REQUEST_FORBIDDEN_MESSAGE = "Só o administrador da organização pode solicitar o PRO.";

export function canRequestProUpgrade(input: {
  role: Role | null | undefined;
  isPlatformAdmin: boolean;
}): boolean {
  return input.isPlatformAdmin || input.role === "admin";
}
