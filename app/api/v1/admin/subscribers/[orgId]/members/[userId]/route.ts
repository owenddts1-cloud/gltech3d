/**
 * PATCH /api/v1/admin/subscribers/:orgId/members/:userId — the platform owner
 * changes a member's role inside a customer org (support case: "the only admin
 * left the company", "promote my partner").
 *
 * Guards (same rules as the tenant route /api/v1/team/[user_id]/role):
 *  - membership must exist in THIS org (both ids from the path) and be active;
 *  - the last active admin cannot be demoted (409 `last_admin`).
 * Audit `member.role_changed_by_platform_admin` with { before, after, reason }.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/wrappers";
import { clientIp } from "@/lib/api/client-ip";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { isLastAdminDemotion } from "@/lib/auth/last-admin";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 30;
const RATE_WINDOW_SEC = 60;

const paramsSchema = z.object({ orgId: z.string().uuid(), userId: z.string().uuid() });

const bodySchema = z
  .object({
    role: z.enum(["viewer", "agent", "manager", "admin"]),
    reason: z.string().trim().min(10, "Motivo precisa de pelo menos 10 caracteres").max(500),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ orgId: string; userId: string }> },
) {
  const requestId = randomUUID();

  let adminCtx: Awaited<ReturnType<typeof requirePlatformAdmin>>;
  try {
    adminCtx = await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403, { requestId });
  }

  const rl = await checkRateLimit(`admin-subscribers:${adminCtx.user.id}`, RATE_LIMIT, RATE_WINDOW_SEC);
  if (!rl.allowed) {
    return fail("rate_limited", "Muitas alterações seguidas. Aguarde um minuto.", 429, {
      requestId,
      headers: {
        "Retry-After": String(RATE_WINDOW_SEC),
        "X-RateLimit-Limit": String(RATE_LIMIT),
        "X-RateLimit-Remaining": "0",
      },
    });
  }

  const p = paramsSchema.safeParse(await ctx.params);
  if (!p.success) return fail("validation_error", "Invalid ids", 400, { requestId });
  const { orgId, userId } = p.data;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("validation_error", "Invalid JSON body", 400, { requestId });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", "Invalid request body", 400, {
      requestId,
      details: parsed.error.flatten(),
    });
  }
  const { role: nextRole, reason } = parsed.data;

  const admin = createAdminClient();
  const { data: target, error: readErr } = await admin
    .from("user_organizations")
    .select("id, role, revoked_at")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr) {
    logger.error("admin_member_read_failed", { requestId, orgId, details: readErr.message });
    return fail("internal_error", "Query failed", 500, { requestId });
  }
  if (!target) return fail("not_found", "Membro não encontrado nesta organização", 404, { requestId });
  if (target.revoked_at) {
    return fail("state_conflict", "Membro está revogado", 409, { requestId });
  }

  const currentRole = target.role as string;
  if (currentRole === nextRole) {
    return ok({ user_id: userId, role: nextRole, changed: false }, { requestId });
  }

  if (currentRole === "admin") {
    const { count, error: countErr } = await admin
      .from("user_organizations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("role", "admin")
      .is("revoked_at", null);
    if (countErr) {
      logger.error("admin_member_count_failed", { requestId, orgId, details: countErr.message });
      return fail("internal_error", "Query failed", 500, { requestId });
    }
    if (isLastAdminDemotion({ currentRole, nextRole, activeAdminCount: count ?? 0 })) {
      return fail(
        "last_admin",
        "Este é o último admin ativo da organização. Promova outra pessoa a admin antes de rebaixá-lo.",
        409,
        { requestId },
      );
    }
  }

  const { data: updated, error: updErr } = await admin
    .from("user_organizations")
    .update({ role: nextRole, updated_at: new Date().toISOString() })
    .eq("id", target.id as string)
    .eq("organization_id", orgId)
    .select("id");
  if (updErr) {
    logger.error("admin_member_update_failed", { requestId, orgId, details: updErr.message });
    return fail("internal_error", "Falha ao alterar o papel", 500, { requestId });
  }
  if (!updated || updated.length === 0) {
    return fail("not_found", "Membro não encontrado nesta organização", 404, { requestId });
  }

  await audit({
    action: "member.role_changed_by_platform_admin",
    actorUserId: adminCtx.user.id,
    actingAsPlatformAdmin: true,
    bypassedRls: true,
    organizationId: orgId,
    resourceType: "membership",
    resourceId: target.id as string,
    requestId,
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
    metadata: { target_user_id: userId, before: currentRole, after: nextRole, reason },
  });

  return ok({ user_id: userId, role: nextRole, changed: true }, { requestId });
}
