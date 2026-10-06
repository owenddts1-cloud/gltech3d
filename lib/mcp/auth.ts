/**
 * Bearer-token auth para o MCP server.
 *
 * Reutiliza `api_tokens` (EPIC-01 / Spec 01 §api-tokens). Plain bearer
 * (`dsk_<prefix>_<secret>`) e hashado SHA256 e batido contra `token_hash`.
 * Nunca logamos plaintext (Sentry beforeSend strip ja cobre `authorization`).
 *
 * Atributos extras (actor_type, agent_run_id, role) ficam em `scopes`
 * como tokens convencionais, sem migration:
 *   `role:manager`     -> role override (default `agent`)
 *   `actor:ai_agent`   -> marca actor_type (default `user`)
 *   `agent_run:<uuid>` -> vincula tool_call ao run (Spec 10)
 *   `mcp:read`         -> habilita read tools desta wave
 *   `mcp:write`        -> habilita write tools (S-13.04)
 */
import type { Actor } from "@/lib/api/handlers/types";
import {
  ApiTokenError,
  extractBearer,
  parseTokenScopes,
  validateApiToken,
} from "@/lib/auth/api-token";
import type { Role } from "@/lib/auth/types";
import { ROLE_RANK } from "@/lib/auth/types";

export { extractBearer };

export interface McpAuthResult {
  organizationId: string;
  role: Role;
  actor: Actor;
  apiTokenId: string;
  scopes: string[];
}

export class McpAuthError extends Error {
  constructor(
    public readonly mcpCode: number,
    public readonly httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = "McpAuthError";
  }
}

const VALID_ROLES = new Set<Role>(["viewer", "agent", "manager", "admin"]);

function scopesRole(scopes: string[]): Role {
  for (const s of scopes) {
    if (s.startsWith("role:")) {
      const r = s.slice("role:".length) as Role;
      if (VALID_ROLES.has(r)) return r;
    }
  }
  return "agent";
}

function deriveActor(scopes: string[], tokenId: string): Actor {
  const isAiAgent = scopes.includes("actor:ai_agent");
  const role = scopesRole(scopes);
  if (isAiAgent) {
    const runScope = scopes.find((s) => s.startsWith("agent_run:"));
    const runId = runScope ? runScope.slice("agent_run:".length) : tokenId;
    return { type: "ai_agent", id: runId, role, api_token_id: tokenId };
  }
  return { type: "user", id: tokenId, role };
}

/**
 * Validates `Authorization: Bearer dsk_...` for the MCP server. Token lookup,
 * revocation/expiry checks and `last_used_at` live in the shared
 * `validateApiToken` (lib/auth/api-token.ts); this maps its errors to MCP
 * JSON-RPC codes and derives role/actor from the scopes.
 */
export async function validateBearerToken(
  authHeader: string | null,
): Promise<McpAuthResult> {
  const plaintext = extractBearer(authHeader);
  if (!plaintext) {
    throw new McpAuthError(-32001, 401, "Missing or malformed Authorization header.");
  }

  let token;
  try {
    token = await validateApiToken(plaintext);
  } catch (err) {
    if (err instanceof ApiTokenError) {
      throw new McpAuthError(
        err.code === "token_lookup_failed" ? -32603 : -32001,
        err.httpStatus,
        err.message,
      );
    }
    throw err;
  }

  const scopes = parseTokenScopes(token.scopes);
  const role = scopesRole(scopes);
  const actor = deriveActor(scopes, token.tokenId);

  return {
    organizationId: token.organizationId,
    role,
    actor,
    apiTokenId: token.tokenId,
    scopes,
  };
}

export function ensureRole(actual: Role, minimum: Role): void {
  if (ROLE_RANK[actual] < ROLE_RANK[minimum]) {
    throw new McpAuthError(
      -32002,
      403,
      `Role '${actual}' insufficient (required: '${minimum}').`,
    );
  }
}

export function ensureScope(scopes: string[], required: string): void {
  if (!scopes.includes(required)) {
    throw new McpAuthError(-32002, 403, `Token missing required scope '${required}'.`);
  }
}
