/**
 * The ONLY place that writes the plan columns of `organizations`
 * (`plan`, `plan_expires_at`, `trial_ends_at`) after creation.
 *
 * `grantProAccess` (payment approval) and the owner panel (/admin/assinantes)
 * both go through here. Two writers with their own UPDATE would drift — one of
 * them would forget `.select()` and an UPDATE matching zero rows would look like
 * success.
 *
 * Requires the service-role client: `organizations` RLS only lets platform
 * admins write, and with a user client a blocked UPDATE matches 0 rows in
 * silence (see docs/runbooks/pendencias-em-aberto.md). The caller is responsible
 * for having proven platform-admin (or a verified signed token) BEFORE calling.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { PlanPatch } from "./admin";

export type WritePlanResult =
  | { ok: true }
  | { ok: false; code: "not_found" | "db_error"; message: string };

export async function writePlanColumns(
  admin: SupabaseClient,
  orgId: string,
  patch: PlanPatch,
): Promise<WritePlanResult> {
  const row: Record<string, string | null> = {
    plan: patch.plan,
    plan_expires_at: patch.plan_expires_at,
  };
  if (patch.trial_ends_at !== undefined) row.trial_ends_at = patch.trial_ends_at;

  const { data, error } = await admin
    .from("organizations")
    .update(row)
    .eq("id", orgId)
    .select("id");

  if (error) return { ok: false, code: "db_error", message: error.message };
  // Zero rows is a failure, not a no-op: the org does not exist or the write was
  // filtered out. Reporting success here would tell the operator the customer
  // has PRO when nothing changed.
  if (!data || data.length === 0) {
    return { ok: false, code: "not_found", message: "organização não encontrada" };
  }
  return { ok: true };
}
