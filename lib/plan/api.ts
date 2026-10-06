/**
 * Plan gate for `/api/v1/**` route handlers.
 *
 * The `(pro)` layout only guards navigation, and server actions call
 * `assertProAccess` themselves. Route handlers are the third door: without
 * this, an org whose trial expired kept creating contacts, leads, messages and
 * AI agents through the API that the PRO screens use.
 *
 * Usage, right after the org was resolved from the session:
 *   const planDenied = await requireProApi(activeOrg.orgId, requestId);
 *   if (planDenied) return planDenied;
 */
import { fail } from "@/lib/api/wrappers";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { assertProAccess } from "./server";

export async function requireProApi(
  orgId: string,
  requestId?: string | null,
): Promise<ReturnType<typeof fail> | null> {
  const denied = await assertProAccess(orgId);
  if (!denied) return null;
  return fail("plan_required", denied, 403, requestId ? { requestId } : {});
}

/**
 * Same gate for handlers that never resolve the org explicitly and rely on RLS
 * to scope the row (lead move, conversation claim, message send...). The plan
 * checked is the one of the session's ACTIVE org — the org the user is working
 * in. Isolation itself stays with RLS; this only decides "may write at all".
 */
export async function requireProApiForSession(
  requestId?: string | null,
): Promise<ReturnType<typeof fail> | null> {
  const user = await loadAuthUser();
  if (!user) return fail("unauthenticated", "Auth required.", 401, requestId ? { requestId } : {});
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) return fail("forbidden_tenant", "Sem organização ativa.", 403, requestId ? { requestId } : {});
  return requireProApi(activeOrg.orgId, requestId);
}
