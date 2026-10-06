/**
 * GET /api/v1/admin/subscribers — the Subscribers panel list (/admin/assinantes).
 *
 * Platform admin only (requirePlatformAdmin → 403). Cross-tenant read with the
 * service role, by design: this is the platform owner looking at every
 * customer's plan.
 *
 * Filters (`status`):
 *  - all     → orgs with a paid plan OR that ever had a trial
 *  - pro     → pro/enterprise still valid (no expiry, or expiry in the future)
 *  - trial   → standard with trial_ends_at in the future
 *  - expired → pro/enterprise whose expiry has passed
 *  - free    → standard with no trial or an expired trial
 *
 * Owner e-mails come from one batched lookup per page (no per-row query).
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
import { planStateFromRow } from "@/lib/plan/server";
import {
  SUBSCRIBER_FILTERS,
  countMembers,
  decodeSubscriberCursor,
  encodeSubscriberCursor,
  pickOwners,
  sanitizeSearch,
  type MembershipLite,
} from "@/lib/plan/subscribers";

export const dynamic = "force-dynamic";

const querySchema = z
  .object({
    status: z.enum(SUBSCRIBER_FILTERS).default("all"),
    q: z.string().max(200).optional(),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(30),
  })
  .strict();

interface OrgRow {
  id: string;
  slug: string;
  display_name: string;
  status: string;
  plan: string | null;
  trial_ends_at: string | null;
  plan_expires_at: string | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const requestId = randomUUID();

  let adminCtx: Awaited<ReturnType<typeof requirePlatformAdmin>>;
  try {
    adminCtx = await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403, { requestId });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return fail("validation_error", "Invalid query params", 400, {
      requestId,
      details: parsed.error.flatten(),
    });
  }
  const { status, limit } = parsed.data;
  const q = sanitizeSearch(parsed.data.q);
  const cursor = parsed.data.cursor ? decodeSubscriberCursor(parsed.data.cursor) : null;
  if (parsed.data.cursor && !cursor) {
    return fail("invalid_cursor", "Invalid cursor", 400, { requestId });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  let query = admin
    .from("organizations")
    .select("id, slug, display_name, status, plan, trial_ends_at, plan_expires_at, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  switch (status) {
    case "all":
      query = query.or("plan.in.(pro,enterprise),trial_ends_at.not.is.null");
      break;
    case "pro":
      query = query
        .in("plan", ["pro", "enterprise"])
        .or(`plan_expires_at.is.null,plan_expires_at.gt.${nowIso}`);
      break;
    case "trial":
      query = query.eq("plan", "standard").gt("trial_ends_at", nowIso);
      break;
    case "expired":
      query = query.in("plan", ["pro", "enterprise"]).lte("plan_expires_at", nowIso);
      break;
    case "free":
      query = query.eq("plan", "standard").or(`trial_ends_at.is.null,trial_ends_at.lte.${nowIso}`);
      break;
  }

  if (q) {
    // `q` is sanitized (no comma/parenthesis/wildcard) before reaching `.or()`.
    query = query.or(`display_name.ilike.%${q}%,slug.ilike.%${q}%`);
  }
  if (cursor) {
    // Both values were validated as ISO datetime / uuid by Zod.
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) {
    logger.error("admin_subscribers_list_failed", { requestId, details: error.message });
    return fail("internal_error", "Query failed", 500, { requestId });
  }

  const rows = (data ?? []) as OrgRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const orgIds = page.map((r) => r.id);

  let memberships: MembershipLite[] = [];
  const lastRequest = new Map<string, { id: string; status: string; created_at: string }>();

  if (orgIds.length > 0) {
    const [memRes, reqRes] = await Promise.all([
      admin
        .from("user_organizations")
        .select("organization_id, user_id, role, accepted_at, created_at")
        .in("organization_id", orgIds)
        .is("revoked_at", null),
      admin
        .from("pro_signup_requests")
        .select("id, organization_id, status, created_at")
        .in("organization_id", orgIds)
        .order("created_at", { ascending: false }),
    ]);
    if (memRes.error || reqRes.error) {
      logger.error("admin_subscribers_enrich_failed", {
        requestId,
        details: memRes.error?.message ?? reqRes.error?.message,
      });
      return fail("internal_error", "Query failed", 500, { requestId });
    }
    memberships = (memRes.data ?? []) as MembershipLite[];
    for (const r of (reqRes.data ?? []) as Array<{
      id: string;
      organization_id: string;
      status: string;
      created_at: string;
    }>) {
      // Ordered desc: the first one seen per org is the latest.
      if (!lastRequest.has(r.organization_id)) {
        lastRequest.set(r.organization_id, { id: r.id, status: r.status, created_at: r.created_at });
      }
    }
  }

  const owners = pickOwners(memberships);
  const counts = countMembers(memberships);
  const emails = await emailsByUserIds(admin, [...owners.values()]);

  const result = page.map((o) => {
    const ownerId = owners.get(o.id) ?? null;
    return {
      id: o.id,
      display_name: o.display_name,
      slug: o.slug,
      org_status: o.status,
      plan: o.plan,
      trial_ends_at: o.trial_ends_at,
      plan_expires_at: o.plan_expires_at,
      state: planStateFromRow(o),
      members_count: counts.get(o.id) ?? 0,
      owner: ownerId ? { user_id: ownerId, email: emails.get(ownerId) ?? null } : null,
      last_request: lastRequest.get(o.id) ?? null,
      created_at: o.created_at,
    };
  });

  const last = page.at(-1);
  const nextCursor =
    hasMore && last ? encodeSubscriberCursor({ created_at: last.created_at, id: last.id }) : null;

  void audit({
    action: "platform_admin.subscribers_listed",
    actorUserId: adminCtx.user.id,
    actingAsPlatformAdmin: true,
    bypassedRls: true,
    requestId,
    metadata: { filters: { status, has_q: !!q }, result_count: result.length },
  });

  return ok(result, { requestId, meta: { has_more: hasMore, cursor: nextCursor } });
}
