/**
 * GET   /api/v1/admin/platform-settings — current PRO price/period, trial days,
 *       PRO benefits and calculator defaults (+ the factory defaults).
 * PATCH /api/v1/admin/platform-settings — change any subset of them.
 *
 * Platform admin only (requirePlatformAdmin → 403). Single row id = 1 of
 * `platform_settings` (migration 0087). Written with the service role AFTER the
 * platform-admin check, like the other /api/v1/admin routes; the RLS of the
 * table (fn_is_platform_admin) would also refuse anyone else.
 *
 * PATCH: Zod strict (unknown key = 400), per-admin rate limit, audit
 * `platform.pricing_changed` { before, after }, then the `platform-settings`
 * cache tag and /calc3d-pro are revalidated so the public page shows the new
 * price immediately.
 *
 * Price changes apply to NEW requests only: a pending pro_signup_request keeps
 * the `amount_cents` it was created with (and the email approval token checks
 * it), so changing the price never makes an existing request inconsistent.
 */
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/wrappers";
import { clientIp } from "@/lib/api/client-ip";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import {
  PLATFORM_SETTINGS_COLUMNS,
  readPlatformSettingsUncached,
  revalidatePlatformSettings,
} from "@/lib/pricing/settings";
import {
  DEFAULT_PLATFORM_SETTINGS,
  parsePlatformSettingsRow,
  platformSettingsPatchSchema,
  platformSettingsToJson,
} from "@/lib/pricing/settings-schema";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 20;
const RATE_WINDOW_SEC = 60;

export async function GET() {
  const requestId = randomUUID();
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403, { requestId });
  }

  const current = await readPlatformSettingsUncached();
  return ok(
    {
      ...platformSettingsToJson(current),
      /** true = the row could not be read; values shown are the defaults. */
      is_fallback: current.isFallback,
      defaults: platformSettingsToJson(DEFAULT_PLATFORM_SETTINGS),
    },
    { requestId },
  );
}

export async function PATCH(req: NextRequest) {
  const requestId = randomUUID();

  let adminCtx: Awaited<ReturnType<typeof requirePlatformAdmin>>;
  try {
    adminCtx = await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403, { requestId });
  }

  const rl = await checkRateLimit(`admin-platform-settings:${adminCtx.user.id}`, RATE_LIMIT, RATE_WINDOW_SEC);
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("validation_error", "Invalid JSON body", 400, { requestId });
  }
  const parsed = platformSettingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", "Invalid request body", 400, {
      requestId,
      details: parsed.error.flatten(),
    });
  }
  const patch = parsed.data;

  const admin = createAdminClient();
  const { data: beforeRow, error: readErr } = await admin
    .from("platform_settings")
    .select(PLATFORM_SETTINGS_COLUMNS)
    .eq("id", 1)
    .maybeSingle();
  if (readErr) {
    logger.error("platform_settings_admin_read_failed", { requestId, code: readErr.code, details: readErr.message });
    return fail("internal_error", "Falha ao ler as configurações", 500, { requestId });
  }
  const before = parsePlatformSettingsRow(beforeRow);

  const row: Record<string, unknown> = {
    id: 1,
    updated_by: adminCtx.user.id,
    updated_at: new Date().toISOString(),
  };
  if (patch.pro_price_cents !== undefined) row.pro_price_cents = patch.pro_price_cents;
  if (patch.pro_period_days !== undefined) row.pro_period_days = patch.pro_period_days;
  if (patch.trial_days !== undefined) row.trial_days = patch.trial_days;
  if (patch.pro_benefits !== undefined) row.pro_benefits = patch.pro_benefits;
  if (patch.calculator_defaults !== undefined) {
    // Partial patch merged over what is stored, so sending one key keeps the others.
    const stored =
      beforeRow && typeof (beforeRow as { calculator_defaults?: unknown }).calculator_defaults === "object"
        ? ((beforeRow as { calculator_defaults: Record<string, unknown> | null }).calculator_defaults ?? {})
        : {};
    row.calculator_defaults = { ...stored, ...patch.calculator_defaults };
  }

  // Upsert: a clone whose seed row is missing gets it created here.
  const { data: afterRow, error: writeErr } = await admin
    .from("platform_settings")
    .upsert(row, { onConflict: "id" })
    .select(PLATFORM_SETTINGS_COLUMNS)
    .single();
  if (writeErr || !afterRow) {
    logger.error("platform_settings_admin_write_failed", {
      requestId,
      code: writeErr?.code,
      details: writeErr?.message ?? "no data",
    });
    if (writeErr?.code === "23514") {
      return fail("validation_error", "Valor fora do intervalo permitido", 400, { requestId });
    }
    return fail("internal_error", "Falha ao gravar as configurações", 500, { requestId });
  }
  const after = parsePlatformSettingsRow(afterRow);

  await audit({
    action: "platform.pricing_changed",
    actorUserId: adminCtx.user.id,
    actingAsPlatformAdmin: true,
    bypassedRls: true,
    resourceType: "platform_settings",
    resourceId: "1",
    requestId,
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
    metadata: {
      fields: Object.keys(patch),
      before: platformSettingsToJson(before),
      after: platformSettingsToJson(after),
    },
  });

  revalidatePlatformSettings();
  revalidatePath("/calc3d-pro");
  revalidatePath("/criar-conta");
  revalidatePath("/app/settings/billing");

  return ok({ ...platformSettingsToJson(after), is_fallback: false }, { requestId });
}
