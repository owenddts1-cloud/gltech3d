/**
 * Shared validator for org API tokens (`api_tokens`).
 *
 * Token format: `dsk_<8-hex-prefix>_<base64url-secret>` (issued once by
 * POST /api/v1/settings/api-tokens). Only `sha256(plaintext)` is stored, so a
 * lookup is "hash the presented token, find the row by `token_hash`".
 *
 * The organization a token acts on comes FROM THE TOKEN ROW — never from the
 * request (query/body). Callers that use the admin client downstream must use
 * `organizationId` from this result as their tenant filter.
 *
 * Consumers: MCP server (`lib/mcp/auth.ts`), printer webhook. Never log the
 * plaintext token.
 */
import { createHash } from "node:crypto";

import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export type ApiTokenErrorCode =
  | "missing_token"
  | "invalid_token_format"
  | "token_not_recognized"
  | "token_revoked"
  | "token_expired"
  | "token_missing_scope"
  | "token_lookup_failed";

export class ApiTokenError extends Error {
  constructor(
    public readonly code: ApiTokenErrorCode,
    public readonly httpStatus: 401 | 403 | 500,
    message: string,
  ) {
    super(message);
    this.name = "ApiTokenError";
  }
}

export interface ValidatedApiToken {
  tokenId: string;
  organizationId: string;
  scopes: string[];
}

export interface ValidateApiTokenOptions {
  /** When set, the token must carry this exact scope (403 otherwise). */
  requiredScope?: string;
}

export const API_TOKEN_PREFIX = "dsk_";

/** Scope that authorizes POST /api/v1/webhooks/printers. */
export const PRINTER_WEBHOOK_SCOPE = "printer:webhook";

export function parseTokenScopes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === "string");
}

/** `Authorization: Bearer <token>` → token, or null when absent/malformed. */
export function extractBearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!m) return null;
  return m[1]!.trim();
}

/** True when the string has the shape of one of our API tokens. */
export function looksLikeApiToken(raw: string | null | undefined): raw is string {
  return typeof raw === "string" && raw.startsWith(API_TOKEN_PREFIX);
}

/**
 * Validates a plaintext API token. Throws `ApiTokenError` on any failure;
 * on success stamps `last_used_at` (best-effort, non-blocking).
 */
export async function validateApiToken(
  raw: string | null | undefined,
  opts: ValidateApiTokenOptions = {},
): Promise<ValidatedApiToken> {
  const plaintext = raw?.trim() ?? "";
  if (!plaintext) {
    throw new ApiTokenError("missing_token", 401, "Missing API token.");
  }
  if (!looksLikeApiToken(plaintext)) {
    throw new ApiTokenError("invalid_token_format", 401, "Invalid token format.");
  }

  const tokenHash = createHash("sha256").update(plaintext).digest();
  const hashLiteral = `\\x${tokenHash.toString("hex")}`;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_tokens")
    .select("id, organization_id, scopes, revoked_at, expires_at")
    .eq("token_hash", hashLiteral)
    .maybeSingle();

  if (error) {
    throw new ApiTokenError("token_lookup_failed", 500, `Token lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new ApiTokenError("token_not_recognized", 401, "Token not recognized.");
  }
  const row = data as {
    id: string;
    organization_id: string;
    scopes: unknown;
    revoked_at: string | null;
    expires_at: string | null;
  };
  if (row.revoked_at) {
    throw new ApiTokenError("token_revoked", 401, "Token revoked.");
  }
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    throw new ApiTokenError("token_expired", 401, "Token expired.");
  }

  const scopes = parseTokenScopes(row.scopes);
  if (opts.requiredScope && !scopes.includes(opts.requiredScope)) {
    throw new ApiTokenError(
      "token_missing_scope",
      403,
      `Token missing required scope '${opts.requiredScope}'.`,
    );
  }

  admin
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id)
    .then(({ error: updErr }) => {
      if (updErr) {
        logger.warn("[api-token] last_used_at update failed", {
          token_id: row.id,
          error: updErr.message,
        });
      }
    });

  return { tokenId: row.id, organizationId: row.organization_id, scopes };
}
