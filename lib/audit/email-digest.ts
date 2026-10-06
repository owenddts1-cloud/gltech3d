import { createHash } from "node:crypto";

/**
 * Correlaciona entradas de auditoria do mesmo e-mail sem guardar o endereço em
 * claro no log.
 *
 * SHA-256 de verdade. O console de admin tinha um campo chamado
 * `owner_email_hash` que era apenas o hex do texto puro — trivialmente
 * reversível, ou seja, PII em claro com nome de hash.
 */
export function emailDigest(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
}
