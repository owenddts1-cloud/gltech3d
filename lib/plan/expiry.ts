/**
 * Expiry arithmetic shared by `server.ts` (grantProAccess) and `admin.ts` (the
 * owner panel). Lives in its own module so `admin.ts` stays pure — `server.ts`
 * imports `next/navigation` and the auth layer.
 */

/**
 * Data de expiracao que uma concessao produziria, sem tocar o banco.
 *
 * E aqui que mora a regra de "renovacao soma": `Math.max(atual, agora)` faz a
 * renovacao somar ao que ainda resta, em vez de resetar.
 */
export function nextExpiry(
  currentExpiresAt: string | null,
  days: number,
  now: Date = new Date(),
): string {
  const parsed = currentExpiresAt ? Date.parse(currentExpiresAt) : NaN;
  const base = Number.isFinite(parsed) ? Math.max(parsed, now.getTime()) : now.getTime();
  return new Date(base + days * 86_400_000).toISOString();
}
