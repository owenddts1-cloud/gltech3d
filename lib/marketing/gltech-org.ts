/**
 * Resolves the GLTech3D organization id for unauthenticated landing inserts.
 *
 * The public lead form has no tenant context, but every `contacts` row needs an
 * `organization_id`. We resolve it from a trusted source (env override, else a
 * slug lookup on `organizations`), never from the request body — per the
 * service-role/admin-client doctrine. Cached at module scope after first hit.
 */
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

let _cachedOrgId: string | null = null;

export async function resolveGltechOrgId(admin: AdminClient): Promise<string | null> {
  if (_cachedOrgId) return _cachedOrgId;

  const envId = process.env.GLTECH_ORG_ID?.trim();
  if (envId) {
    _cachedOrgId = envId;
    return _cachedOrgId;
  }

  const slug = process.env.GLTECH_ORG_SLUG?.trim() || "gltech3d";
  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data?.id) return null;
  _cachedOrgId = data.id as string;
  return _cachedOrgId;
}
