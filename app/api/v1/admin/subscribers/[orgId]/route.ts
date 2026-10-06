/**
 * GET /api/v1/admin/subscribers/:orgId — one customer in the Subscribers panel:
 * plan columns + derived state, members (with e-mail), the org's PRO requests
 * and the last 20 audit entries.
 *
 * Platform admin only. Every query filters `organization_id` by the path param
 * (validated as uuid) — service role bypasses RLS, so the filter is the guard.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { emailsByUserIds } from "@/lib/auth/admin-users";
import { PLAN_COLUMNS, planStateFromRow } from "@/lib/plan/server";

export const dynamic = "force-dynamic";

const orgIdSchema = z.string().uuid();

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ orgId: string }> }) {
  const requestId = randomUUID();
  const { orgId: rawOrgId } = await ctx.params;

  let adminCtx: Awaited<ReturnType<typeof requirePlatformAdmin>>;
  try {
    adminCtx = await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403, { requestId });
  }

  const idParsed = orgIdSchema.safeParse(rawOrgId);
  if (!idParsed.success) return fail("validation_error", "Invalid organization id", 400, { requestId });
  const orgId = idParsed.data;

  const admin = createAdminClient();

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select(`id, slug, display_name, status, created_at, ${PLAN_COLUMNS}`)
    .eq("id", orgId)
    .maybeSingle();
  if (orgErr) {
    logger.error("admin_subscriber_load_failed", { requestId, orgId, details: orgErr.message });
    return fail("internal_error", "Query failed", 500, { requestId });
  }
  if (!org) return fail("not_found", "Organização não encontrada", 404, { requestId });

  const [memRes, reqRes, auditRes] = await Promise.all([
    admin
      .from("user_organizations")
      .select("id, user_id, role, accepted_at, revoked_at, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true }),
    admin
      .from("pro_signup_requests")
      .select("id, status, buyer_name, buyer_email, amount_cents, currency, created_at, reviewed_at, review_note")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("api_audit_log")
      .select("id, created_at, action, actor_user_id, acting_as_platform_admin, resource_type, resource_id, metadata")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const firstErr = memRes.error ?? reqRes.error ?? auditRes.error;
  if (firstErr) {
    logger.error("admin_subscriber_enrich_failed", { requestId, orgId, details: firstErr.message });
    return fail("internal_error", "Query failed", 500, { requestId });
  }

  const members = (memRes.data ?? []) as MemberRow[];
  const emails = await emailsByUserIds(admin, members.map((m) => m.user_id));

  void audit({
    action: "platform_admin.subscriber_viewed",
    actorUserId: adminCtx.user.id,
    actingAsPlatformAdmin: true,
    bypassedRls: true,
    organizationId: orgId,
    resourceType: "organization",
    resourceId: orgId,
    requestId,
  });

  return ok(
    {
      organization: {
        id: org.id as string,
        slug: org.slug as string,
        display_name: org.display_name as string,
        status: org.status as string,
        created_at: org.created_at as string,
        plan: org.plan as string | null,
        trial_ends_at: org.trial_ends_at as string | null,
        plan_expires_at: org.plan_expires_at as string | null,
      },
      state: planStateFromRow({
        plan: org.plan as string | null,
        trial_ends_at: org.trial_ends_at as string | null,
        plan_expires_at: org.plan_expires_at as string | null,
      }),
      members: members.map((m) => ({
        user_id: m.user_id,
        email: emails.get(m.user_id) ?? null,
        role: m.role,
        accepted_at: m.accepted_at,
        revoked_at: m.revoked_at,
      })),
      requests: reqRes.data ?? [],
      audit: auditRes.data ?? [],
    },
    { requestId },
  );
}
