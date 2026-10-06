/**
 * Decides whether a service-role key is a real, usable credential.
 *
 * Supabase ships two formats:
 *  - legacy JWT (`eyJ...`, ~200+ chars)
 *  - new secret keys (`sb_secret_...`, ~41 chars)
 *
 * The old check (`length > 50`) silently rejected the new format, which pushed
 * every caller into its degraded path: audit rows written with the user client
 * (RLS-rejected when there is no session), recovery-code login always failing,
 * team listing without e-mails. Do NOT reintroduce a length heuristic.
 */
export function isUsableServiceRoleKey(key: string | undefined | null): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.toUpperCase().startsWith("PLACEHOLDER")) return false;
  return true;
}
