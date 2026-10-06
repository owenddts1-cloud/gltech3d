/**
 * PATCH /api/v1/admin/subscribers/:orgId/plan — the platform owner changes a
 * customer's plan from the Subscribers panel.
 *
 * Body (discriminated by `action`, every variant requires a `reason` 10..500):
 *  - { action: "set", plan, expires_at: ISO | null }   null = never expires
 *  - { action: "extend", days: 1..3650 }               adds to what remains
 *  - { action: "revoke" }                              standard + ends active trial
 *
 * The patch is computed by lib/plan/admin.ts (pure) and written by
 * lib/plan/write.ts (the only writer of plan columns). Audit carries
 * { before, after, reason }. The customer's admins are emailed in `after()` so
 * the response does not wait for SMTP.
 */
import { randomUUID } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { z } from "zod";

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/wrappers";
import { clientIp } from "@/lib/api/client-ip";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { emailsByUserIds } from "@/lib/auth/admin-users";
import { PLAN_COLUMNS, planStateFromRow } from "@/lib/plan/server";
import { extendPlan, revokePlan, setPlan, type PlanPatchResult } from "@/lib/plan/admin";
import { writePlanColumns } from "@/lib/plan/write";
import { planTierLabel } from "@/lib/plan/subscribers";
import { sendEmail } from "@/lib/email/send";
import { buildPlanChangedEmail, type PlanChangeKind } from "@/lib/email/templates/plan-changed";
import { absoluteSiteUrl } from "@/lib/marketing/site-url";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 30;
const RATE_WINDOW_SEC = 60;

const reason = z.string().trim().min(10, "Motivo precisa de pelo menos 10 caracteres").max(500);

const bodySchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("set"),
      plan: z.enum(["standard", "pro", "enterprise"]),
      expires_at: z.string().datetime({ offset: true }).nullable(),
      reason,
    })
    .strict(),
  z
    .object({
      action: z.literal("extend"),
      days: z.number().int().min(1).max(3650),
      reason,
    })
    .strict(),
  z.object({ action: z.literal("revoke"), reason }).strict(),
]);

const AUDIT_ACTION = {
  set: "tenant.plan_changed",
  extend: "tenant.plan_extended",
  revoke: "tenant.plan_revoked",
} as const;

interface PlanRowDb {
  id: string;
  display_name: string;
  plan: string | null;
  trial_ends_at: string | null;
  plan_expires_at: string | null;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ orgId: string }> }) {
  const requestId = randomUUID();
  const { orgId: rawOrgId } = await ctx.params;

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

  const idParsed = z.string().uuid().safeParse(rawOrgId);
  if (!idParsed.success) return fail("validation_error", "Invalid organization id", 400, { requestId });
  const orgId = idParsed.data;

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
  const input = parsed.data;

  const admin = createAdminClient();
  const { data: current, error: readErr } = await admin
    .from("organizations")
    .select(`id, display_name, ${PLAN_COLUMNS}`)
    .eq("id", orgId)
    .maybeSingle();
  if (readErr) {
    logger.error("admin_plan_read_failed", { requestId, orgId, details: readErr.message });
    return fail("internal_error", "Query failed", 500, { requestId });
  }
  if (!current) return fail("not_found", "Organização não encontrada", 404, { requestId });
  const row = current as PlanRowDb;

  const before = {
    plan: row.plan,
    trial_ends_at: row.trial_ends_at,
    plan_expires_at: row.plan_expires_at,
  };

  const computed: PlanPatchResult =
    input.action === "set"
      ? setPlan({ plan: input.plan, expiresAt: input.expires_at })
      : input.action === "extend"
        ? extendPlan(before, input.days)
        : { ok: true, patch: revokePlan(before) };

  if (!computed.ok) {
    return fail(computed.code, computed.message, 422, { requestId });
  }

  const written = await writePlanColumns(admin, orgId, computed.patch);
  if (!written.ok) {
    logger.error("admin_plan_write_failed", { requestId, orgId, details: written.message });
    return written.code === "not_found"
      ? fail("not_found", "Organização não encontrada", 404, { requestId })
      : fail("internal_error", "Falha ao gravar o plano", 500, { requestId });
  }

  const afterCols = {
    plan: computed.patch.plan,
    trial_ends_at:
      computed.patch.trial_ends_at !== undefined ? computed.patch.trial_ends_at : row.trial_ends_at,
    plan_expires_at: computed.patch.plan_expires_at,
  };
  const state = planStateFromRow(afterCols);

  await audit({
    action: AUDIT_ACTION[input.action],
    actorUserId: adminCtx.user.id,
    actingAsPlatformAdmin: true,
    bypassedRls: true,
    organizationId: orgId,
    resourceType: "organization",
    resourceId: orgId,
    requestId,
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
    metadata: {
      before,
      after: afterCols,
      reason: input.reason,
      ...(input.action === "extend" ? { days: input.days } : {}),
    },
  });

  scheduleCustomerEmail({
    requestId,
    orgId,
    orgName: row.display_name,
    kind: input.action satisfies PlanChangeKind,
    planLabel: planTierLabel(computed.patch.plan),
    expiresAt: afterCols.plan_expires_at ? new Date(afterCols.plan_expires_at) : null,
    hasProAccess: state?.hasProAccess ?? false,
  });

  return ok({ organization_id: orgId, ...afterCols, state }, { requestId });
}

/** Emails the org's active admins. Never blocks or fails the mutation. */
function scheduleCustomerEmail(args: {
  requestId: string;
  orgId: string;
  orgName: string;
  kind: PlanChangeKind;
  planLabel: string;
  expiresAt: Date | null;
  hasProAccess: boolean;
}) {
  after(async () => {
    try {
      const admin = createAdminClient();
      const { data: admins, error } = await admin
        .from("user_organizations")
        .select("user_id")
        .eq("organization_id", args.orgId)
        .eq("role", "admin")
        .is("revoked_at", null);
      if (error) {
        logger.error("admin_plan_email_recipients_failed", {
          requestId: args.requestId,
          orgId: args.orgId,
          details: error.message,
        });
        return;
      }
      const emails = await emailsByUserIds(
        admin,
        (admins ?? []).map((a) => a.user_id as string),
      );
      const to = [...emails.values()];
      if (to.length === 0) {
        logger.warn("admin_plan_email_no_recipients", { requestId: args.requestId, orgId: args.orgId });
        return;
      }
      const mail = buildPlanChangedEmail({
        kind: args.kind,
        orgName: args.orgName,
        planLabel: args.planLabel,
        expiresAt: args.expiresAt,
        hasProAccess: args.hasProAccess,
        appUrl: absoluteSiteUrl("/app/dashboard"),
      });
      const res = await sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text });
      if (!res.ok) {
        logger.error("admin_plan_email_failed", {
          requestId: args.requestId,
          orgId: args.orgId,
          reason: res.error,
          details: res.details,
        });
      }
    } catch (err) {
      logger.error("admin_plan_email_threw", {
        requestId: args.requestId,
        orgId: args.orgId,
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
