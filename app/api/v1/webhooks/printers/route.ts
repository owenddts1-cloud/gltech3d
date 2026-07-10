import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateRealCost } from "@/lib/pricing/engine";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { randomUUID } from "node:crypto";
import { loadAuthUser } from "@/lib/auth/server";

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
});

function json(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const url = new URL(req.url);

  // 1) Shared-secret auth or active dashboard user session.
  const configured = process.env.PRINTER_WEBHOOK_SECRET;
  const provided = req.headers.get("x-webhook-secret") ?? url.searchParams.get("secret") ?? "";

  let authorized = false;
  if (configured && configured.length >= 8 && provided === configured) {
    authorized = true;
  } else {
    const user = await loadAuthUser();
    if (user) {
      authorized = true;
    }
  }

  if (!authorized) {
    if (!configured || configured.length < 8) {
      return json(503, { ok: false, error: "webhook_not_configured", requestId });
    }
    return json(401, { ok: false, error: "unauthorized", requestId });
  }

  // 2) Require an EXPLICIT orgId — never fall back to "the first organization".
  const orgId = url.searchParams.get("orgId");
  if (!orgId) {
    return json(400, { ok: false, error: "missing_orgId", requestId });
  }

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
  const { printer_id, filename, weight_grams, print_time_seconds, filament_id } = parsed;

  const supabase = createAdminClient();

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

  // Log the job.
  const { data: job, error: jobErr } = await supabase
    .from("print_jobs")
    .insert({
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
    })
    .select("id")
    .single();

  if (jobErr) {
    return json(500, { ok: false, error: jobErr.message, requestId });
  }

  return json(200, { ok: true, jobId: job?.id ?? null, costs: costInfo, requestId });
}
