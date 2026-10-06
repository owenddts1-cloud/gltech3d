import type { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateRealCost } from "@/lib/pricing/engine";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import {
  ApiTokenError,
  PRINTER_WEBHOOK_SCOPE,
  extractBearer,
  looksLikeApiToken,
  validateApiToken,
} from "@/lib/auth/api-token";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { resolveGltechOrgId } from "@/lib/marketing/gltech-org";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PrinterRow {
  id: string;
  client_id: string;
  name: string;
  power_draw: number | string;
  depreciation_per_hour: number | string;
  active_filament_id: string | null;
}
interface FilamentRow {
  client_id: string;
  name: string;
  weight_grams: number | string;
  cost_per_gram: number | string;
}

/**
 * Telemetry payload from OctoPrint/Klipper (`print_done`). Validated with Zod;
 * numeric fields are coerced + bounded to reject absurd/garbage values.
 */
const bodySchema = z.object({
  topic: z.string().max(64).optional().default("print_done"),
  printer_id: z.string().min(1).max(128),
  filename: z.string().max(256).optional().default("Unknown"),
  weight_grams: z.coerce.number().nonnegative().max(100_000).optional().default(0),
  print_time_seconds: z.coerce.number().nonnegative().max(30 * 24 * 3600).optional().default(0),
  filament_id: z.string().max(128).optional().nullable(),
  service_order_id: z.string().uuid().optional().nullable(),
});

/** Constant-time comparison; length mismatch short-circuits (length is not secret). */
function secretsMatch(provided: string, configured: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(configured);
  return a.length === b.length && timingSafeEqual(a, b);
}

function json(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type AuthOutcome =
  | { ok: true; orgId: string; via: "api_token" | "session" | "legacy_secret" }
  | { ok: false; status: number; error: string };

/**
 * Resolves WHICH org this call may write to. Three paths, in order:
 *
 * 1. Per-org API token (`dsk_...`, scope `printer:webhook`) in
 *    `Authorization: Bearer` or `X-Webhook-Secret`. The org comes FROM THE
 *    TOKEN ROW; a `?orgId=` that disagrees is rejected (never trusted).
 * 2. Logged-in dashboard member (browser simulator): org = active org; a
 *    `?orgId=` must match it.
 * 3. DEPRECATED global `PRINTER_WEBHOOK_SECRET` in `X-Webhook-Secret`: one
 *    secret shared by every tenant, so it is accepted ONLY for the site's own
 *    org (lib/marketing/gltech-org.ts) and logs a deprecation warning.
 *
 * Credentials are header-only — never `?secret=` (leaks into access logs).
 */
async function authorize(req: NextRequest, queryOrgId: string | null): Promise<AuthOutcome> {
  const headerSecret = req.headers.get("x-webhook-secret")?.trim() ?? "";
  const bearer = extractBearer(req.headers.get("authorization"));
  const presentedToken = looksLikeApiToken(bearer)
    ? bearer
    : looksLikeApiToken(headerSecret)
      ? headerSecret
      : null;

  // 1) Per-org API token.
  if (presentedToken) {
    try {
      const token = await validateApiToken(presentedToken, { requiredScope: PRINTER_WEBHOOK_SCOPE });
      if (queryOrgId && queryOrgId !== token.organizationId.toLowerCase()) {
        return { ok: false, status: 403, error: "org_mismatch" };
      }
      return { ok: true, orgId: token.organizationId, via: "api_token" };
    } catch (err) {
      if (err instanceof ApiTokenError) {
        if (err.code === "token_lookup_failed") {
          logger.error("[printer-webhook] token lookup failed", { error: err.message });
        }
        return { ok: false, status: err.httpStatus, error: err.code };
      }
      throw err;
    }
  }

  // 2) Browser simulator: logged-in member of the active org.
  const user = await loadAuthUser();
  if (user) {
    const activeOrg = await resolveActiveOrg(user);
    if (activeOrg && (!queryOrgId || queryOrgId === activeOrg.orgId.toLowerCase())) {
      return { ok: true, orgId: activeOrg.orgId, via: "session" };
    }
  }

  // 3) Deprecated global secret — site org only.
  const configured = env.PRINTER_WEBHOOK_SECRET;
  if (configured && configured.length >= 8 && headerSecret && secretsMatch(headerSecret, configured)) {
    const siteOrgId = await resolveGltechOrgId(createAdminClient());
    if (!siteOrgId) {
      return { ok: false, status: 503, error: "webhook_not_configured" };
    }
    if (queryOrgId && queryOrgId !== siteOrgId.toLowerCase()) {
      return { ok: false, status: 403, error: "legacy_secret_site_org_only" };
    }
    logger.warn("[printer-webhook] global PRINTER_WEBHOOK_SECRET is deprecated; use a per-org token", {
      org_id: siteOrgId,
    });
    return { ok: true, orgId: siteOrgId, via: "legacy_secret" };
  }

  return { ok: false, status: 401, error: "unauthorized" };
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const url = new URL(req.url);

  // Optional: the org now comes from the credential. When present it must
  // agree with it — it can never select a different tenant.
  const queryOrgId = url.searchParams.get("orgId")?.trim().toLowerCase() || null;

  const auth = await authorize(req, queryOrgId);
  if (!auth.ok) {
    return json(auth.status, { ok: false, error: auth.error, requestId });
  }
  const orgId = auth.orgId;

  // 3) Per-org rate limit.
  const rl = await checkRateLimit(`printer-webhook:${orgId}`, 60, 60);
  if (!rl.allowed) {
    return json(429, { ok: false, error: "rate_limited", requestId });
  }

  // 4) Validate the payload.
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return json(400, { ok: false, error: "invalid_payload", requestId });
  }
  const { printer_id, filename, weight_grams, print_time_seconds, filament_id, service_order_id } = parsed;

  const supabase = createAdminClient();

  // Se veio uma OS vinculada, confirme que ela pertence a ESTA org antes de
  // gravar — o admin client abaixo bypassa RLS, então a checagem é obrigatória.
  let linkedServiceOrderId: string | null = null;
  if (service_order_id) {
    const { data: so } = await supabase
      .from("service_orders")
      .select("id")
      .eq("organization_id", orgId)
      .eq("id", service_order_id)
      .limit(1)
      .maybeSingle();
    if (!so) {
      return json(400, { ok: false, error: "service_order_not_found", requestId });
    }
    linkedServiceOrderId = service_order_id;
  }

  // Energy tariff stays an org-level scalar in settings.
  const { data: orgRow, error: orgErr } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .single();
  if (orgErr || !orgRow) {
    return json(404, { ok: false, error: "organization_not_found", requestId });
  }
  const kEnergy = ((orgRow.settings as Record<string, unknown>)?.k_energy as number) || 0.85;

  // Find printer by client_id, then by name — org-scoped explicit filters.
  let printer =
    ((
      await supabase
        .from("printers")
        .select("id, client_id, name, power_draw, depreciation_per_hour, active_filament_id")
        .eq("organization_id", orgId)
        .eq("client_id", printer_id)
        .limit(1)
        .maybeSingle()
    ).data as PrinterRow | null) ?? null;
  if (!printer) {
    printer =
      ((
        await supabase
          .from("printers")
          .select("id, client_id, name, power_draw, depreciation_per_hour, active_filament_id")
          .eq("organization_id", orgId)
          .eq("name", printer_id)
          .limit(1)
          .maybeSingle()
      ).data as PrinterRow | null) ?? null;
  }
  if (!printer) {
    return json(404, { ok: false, error: "printer_not_found", requestId });
  }

  const targetFilamentId = filament_id || printer.active_filament_id;
  let filamentName = "Generic";
  let costInfo: { materialCost: number; energyCost: number; depreciationCost: number; totalCost: number } | null = null;

  if (targetFilamentId) {
    const { data: fil } = await supabase
      .from("filaments")
      .select("client_id, name, weight_grams, cost_per_gram")
      .eq("organization_id", orgId)
      .eq("client_id", targetFilamentId)
      .limit(1)
      .maybeSingle();
    const filament = fil as FilamentRow | null;
    if (filament) {
      filamentName = filament.name;
      const newWeight = Math.max(0, Number(filament.weight_grams) - weight_grams);
      await supabase
        .from("filaments")
        .update({ weight_grams: newWeight, updated_at: new Date().toISOString() })
        .eq("organization_id", orgId)
        .eq("client_id", targetFilamentId);

      costInfo = calculateRealCost({
        m_piece: weight_grams,
        c_gram: Number(filament.cost_per_gram) || 0.12,
        t_print: print_time_seconds,
        k_energy: kEnergy,
        power_draw: Number(printer.power_draw) || 200,
        d_machine: Number(printer.depreciation_per_hour) || 0.4,
      });
    }
  }

  // Mark the printer idle (row-level; no whole-settings clobber).
  await supabase
    .from("printers")
    .update({ status: "idle", active_print_job: null, updated_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("id", printer.id);

  // Log the job. `service_order_id` só é incluído quando há OS vinculada, para
  // não quebrar o insert em bancos onde a migration 0032 ainda não foi aplicada.
  const jobRow: Record<string, unknown> = {
    organization_id: orgId,
    printer_client_id: printer.client_id,
    printer_name: printer.name,
    filename,
    weight_grams,
    print_time_seconds,
    filament_client_id: targetFilamentId || null,
    filament_name: filamentName,
    material_cost: costInfo?.materialCost ?? null,
    energy_cost: costInfo?.energyCost ?? null,
    depreciation_cost: costInfo?.depreciationCost ?? null,
    total_cost: costInfo?.totalCost ?? null,
    completed_at: new Date().toISOString(),
  };
  if (linkedServiceOrderId) jobRow.service_order_id = linkedServiceOrderId;

  const { data: job, error: jobErr } = await supabase
    .from("print_jobs")
    .insert(jobRow)
    .select("id")
    .single();

  if (jobErr) {
    return json(500, { ok: false, error: jobErr.message, requestId });
  }

  return json(200, { ok: true, jobId: job?.id ?? null, costs: costInfo, requestId });
}
