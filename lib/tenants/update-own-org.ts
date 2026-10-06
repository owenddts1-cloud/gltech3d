import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Writes to the caller's OWN organization row.
 *
 * WHY the service role: RLS on `organizations` only lets platform admins write
 * (`orgs_write_platform_admin`) — that is what stops a tenant from promoting
 * itself to PRO. A tenant-side update through the user client therefore matches
 * zero rows and returns no error: the form says "saved" and nothing persists.
 * That was the state of the tenant settings form and of the energy tariff.
 *
 * SAFETY CONTRACT (the caller owns these, this helper cannot check them):
 *  - `orgId` comes from the session (`resolveActiveOrg`), NEVER from input;
 *  - the caller already enforced the role required for the change.
 *
 * What this helper does guarantee:
 *  - plan columns can never be written from here (see FORBIDDEN_COLUMNS);
 *  - zero affected rows is an error, not a silent success.
 */

const FORBIDDEN_COLUMNS = new Set([
  "id",
  "slug",
  "plan",
  "trial_ends_at",
  "plan_expires_at",
  "status",
  "suspended_at",
  "suspended_reason",
  "onboarded_at",
]);

export type OwnOrgPatch = Record<string, unknown>;

export type UpdateOwnOrgResult = { ok: true } | { ok: false; error: string };

export function assertPatchAllowed(patch: OwnOrgPatch): string | null {
  for (const key of Object.keys(patch)) {
    if (FORBIDDEN_COLUMNS.has(key)) return key;
  }
  return null;
}

export async function updateOwnOrganization(
  orgId: string,
  patch: OwnOrgPatch,
  client: SupabaseClient = createAdminClient(),
): Promise<UpdateOwnOrgResult> {
  const forbidden = assertPatchAllowed(patch);
  if (forbidden) return { ok: false, error: `forbidden_column:${forbidden}` };

  const { data, error } = await client
    .from("organizations")
    .update(patch)
    .eq("id", orgId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "organization_not_updated" };
  return { ok: true };
}

/**
 * Read-merge-write for `organizations.settings`, so one key (e.g. `k_energy`)
 * never wipes the others. Same safety contract as `updateOwnOrganization`.
 */
export async function mergeOwnOrgSettings(
  orgId: string,
  partial: Record<string, unknown>,
  client: SupabaseClient = createAdminClient(),
): Promise<UpdateOwnOrgResult> {
  const { data, error } = await client
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "organization_not_found" };
  const current = ((data as { settings: Record<string, unknown> | null }).settings ?? {}) as Record<
    string,
    unknown
  >;
  return updateOwnOrganization(orgId, { settings: { ...current, ...partial } }, client);
}
