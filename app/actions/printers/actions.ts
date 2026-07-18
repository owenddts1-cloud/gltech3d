"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { savePrintFarmSchema } from "@/lib/schemas/printers";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Row → client (camelCase) mappers. The frontend keeps its own string ids
// (stored as `client_id`), so we surface `client_id` as `id`.
// ---------------------------------------------------------------------------
interface PrinterRow {
  client_id: string; name: string; status: string; power_draw: number | string;
  depreciation_per_hour: number | string; active_filament_id: string | null;
  active_print_job: unknown; network_url: string | null;
  api_key: string | null; poll_mode: string | null;
}
interface FilamentRow {
  client_id: string; name: string; material: string | null; color: string | null;
  weight_grams: number | string; initial_weight_grams: number | string;
  cost_per_gram: number | string; min_weight_alert: number | string; supplier: string | null;
}
interface PrintJobRow {
  id: string; printer_client_id: string | null; printer_name: string | null; filename: string | null;
  weight_grams: number | string; print_time_seconds: number | string; filament_client_id: string | null;
  filament_name: string | null; material_cost: number | string | null; energy_cost: number | string | null;
  depreciation_cost: number | string | null; total_cost: number | string | null;
  service_order_id: string | null; completed_at: string;
}

const num = (v: number | string | null | undefined): number => (v == null ? 0 : Number(v));

function mapPrinter(r: PrinterRow) {
  return {
    id: r.client_id,
    name: r.name,
    status: r.status,
    powerDraw: num(r.power_draw),
    depreciationPerHour: num(r.depreciation_per_hour),
    activeFilamentId: r.active_filament_id,
    activePrintJob: r.active_print_job ?? null,
    networkUrl: r.network_url ?? "",
    apiKey: r.api_key ?? "",
    pollMode: (r.poll_mode ?? "browser") as "browser" | "server" | "off",
  };
}
function mapFilament(r: FilamentRow) {
  return {
    id: r.client_id,
    name: r.name,
    material: r.material ?? "",
    color: r.color ?? "",
    weightGrams: num(r.weight_grams),
    initialWeightGrams: num(r.initial_weight_grams),
    costPerGram: num(r.cost_per_gram),
    minWeightAlert: num(r.min_weight_alert),
    supplier: r.supplier ?? "",
  };
}
function mapJob(r: PrintJobRow) {
  const hasCosts = r.total_cost != null;
  return {
    id: r.id,
    printerId: r.printer_client_id,
    printerName: r.printer_name ?? "",
    filename: r.filename ?? "",
    weightGrams: num(r.weight_grams),
    printTimeSeconds: num(r.print_time_seconds),
    filamentId: r.filament_client_id,
    filamentName: r.filament_name ?? "",
    costs: hasCosts
      ? {
          materialCost: num(r.material_cost),
          energyCost: num(r.energy_cost),
          depreciationCost: num(r.depreciation_cost),
          totalCost: num(r.total_cost),
        }
      : null,
    serviceOrderId: r.service_order_id ?? null,
    completedAt: r.completed_at,
  };
}

export async function fetchPrintersAndFilaments() {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const supabase = await createClient();
  // RLS scopes each query to the caller's org; queries degrade to [] if the
  // migration hasn't been applied yet (table missing → error → empty).
  const [printersRes, filamentsRes, jobsRes, orgRes] = await Promise.all([
    supabase.from("printers").select("*").order("created_at", { ascending: true }),
    supabase.from("filaments").select("*").order("created_at", { ascending: true }),
    supabase.from("print_jobs").select("*").order("completed_at", { ascending: false }).limit(100),
    supabase.from("organizations").select("settings").eq("id", activeOrg.orgId).single(),
  ]);

  const settings = (orgRes.data?.settings as Record<string, unknown>) || {};

  return {
    ok: true as const,
    orgId: activeOrg.orgId,
    printers: ((printersRes.data as PrinterRow[] | null) ?? []).map(mapPrinter),
    filaments: ((filamentsRes.data as FilamentRow[] | null) ?? []).map(mapFilament),
    printJobs: ((jobsRes.data as PrintJobRow[] | null) ?? []).map(mapJob),
    kEnergy: (settings.k_energy as number) || 0.85,
  };
}

export async function savePrintersAndFilaments(
  printers: unknown[],
  filaments: unknown[],
  kEnergy?: number,
) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };
  const orgId = activeOrg.orgId;

  const parsed = savePrintFarmSchema.safeParse({ printers, filaments, kEnergy });
  if (!parsed.success) {
    return { ok: false as const, error: "Dados inválidos" };
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const filamentRows = parsed.data.filaments.map((f) => ({
    organization_id: orgId,
    client_id: f.id,
    name: f.name,
    material: f.material,
    color: f.color,
    weight_grams: f.weightGrams,
    initial_weight_grams: f.initialWeightGrams,
    cost_per_gram: f.costPerGram,
    min_weight_alert: f.minWeightAlert,
    supplier: f.supplier,
    created_by: authUser.id,
    updated_at: nowIso,
  }));
  const printerRows = parsed.data.printers.map((p) => ({
    organization_id: orgId,
    client_id: p.id,
    name: p.name,
    status: p.status,
    power_draw: p.powerDraw,
    depreciation_per_hour: p.depreciationPerHour,
    active_filament_id: p.activeFilamentId ?? null,
    active_print_job: p.activePrintJob ?? null,
    network_url: p.networkUrl,
    api_key: p.apiKey || null,
    poll_mode: p.pollMode,
    created_by: authUser.id,
    updated_at: nowIso,
  }));

  // Upsert by (organization_id, client_id); RLS enforces the org boundary.
  if (filamentRows.length > 0) {
    const { error } = await supabase
      .from("filaments")
      .upsert(filamentRows, { onConflict: "organization_id,client_id" });
    if (error) return { ok: false as const, error: error.message };
  }
  if (printerRows.length > 0) {
    const { error } = await supabase
      .from("printers")
      .upsert(printerRows, { onConflict: "organization_id,client_id" });
    if (error) return { ok: false as const, error: error.message };
  }

  // Delete rows the client removed (client_ids are charset-restricted by Zod).
  const keepFil = parsed.data.filaments.map((f) => f.id);
  const keepPrn = parsed.data.printers.map((p) => p.id);
  {
    let q = supabase.from("filaments").delete().eq("organization_id", orgId);
    if (keepFil.length > 0) q = q.not("client_id", "in", `(${keepFil.join(",")})`);
    await q;
  }
  {
    let q = supabase.from("printers").delete().eq("organization_id", orgId);
    if (keepPrn.length > 0) q = q.not("client_id", "in", `(${keepPrn.join(",")})`);
    await q;
  }

  // k_energy (tarifa) stays an org-level scalar in settings.
  if (parsed.data.kEnergy !== undefined) {
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();
    const settings = (orgRow?.settings as Record<string, unknown>) || {};
    await supabase
      .from("organizations")
      .update({ settings: { ...settings, k_energy: parsed.data.kEnergy } })
      .eq("id", orgId);
  }

  // Audit is emitted automatically by the fn_audit_log_row triggers on
  // printers/filaments (printers.created/updated/deleted etc.).

  revalidatePath("/app/dashboard");
  revalidatePath("/app/printers");
  revalidatePath("/app/calculator");
  return { ok: true as const };
}
