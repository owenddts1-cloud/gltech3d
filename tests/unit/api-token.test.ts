/**
 * Shared API-token validator (MCP + printer webhook): hash lookup, revocation,
 * expiry and scope gate. The org must come from the token row.
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
  id: string;
  organization_id: string;
  scopes: unknown;
  revoked_at: string | null;
  expires_at: string | null;
}

let row: Row | null = null;
let lookupError: { message: string } | null = null;
const eqCalls: Array<[string, unknown]> = [];
const updates: Array<Record<string, unknown>> = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: (col: string, val: unknown) => {
          eqCalls.push([col, val]);
          return { maybeSingle: async () => ({ data: row, error: lookupError }) };
        },
      }),
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
  }),
}));

import {
  ApiTokenError,
  PRINTER_WEBHOOK_SCOPE,
  extractBearer,
  validateApiToken,
} from "@/lib/auth/api-token";

const ORG = "11111111-1111-4111-8111-111111111111";
const TOKEN = "dsk_ab12cd34_secretsecretsecret";

async function expectCode(p: Promise<unknown>, code: string, status: number) {
  await expect(p).rejects.toBeInstanceOf(ApiTokenError);
  await p.catch((err: ApiTokenError) => {
    expect(err.code).toBe(code);
    expect(err.httpStatus).toBe(status);
  });
}

beforeEach(() => {
  row = {
    id: "tok-1",
    organization_id: ORG,
    scopes: [PRINTER_WEBHOOK_SCOPE],
    revoked_at: null,
    expires_at: null,
  };
  lookupError = null;
  eqCalls.length = 0;
  updates.length = 0;
});

describe("validateApiToken", () => {
  it("looks the token up by its sha256 and returns the org from the row", async () => {
    const res = await validateApiToken(TOKEN, { requiredScope: PRINTER_WEBHOOK_SCOPE });
    expect(res).toEqual({ tokenId: "tok-1", organizationId: ORG, scopes: [PRINTER_WEBHOOK_SCOPE] });
    const expectedHash = `\\x${createHash("sha256").update(TOKEN).digest("hex")}`;
    expect(eqCalls).toContainEqual(["token_hash", expectedHash]);
    expect(updates[0]).toHaveProperty("last_used_at");
  });

  it("rejects a missing or malformed token without hitting the DB", async () => {
    await expectCode(validateApiToken(""), "missing_token", 401);
    await expectCode(validateApiToken(null), "missing_token", 401);
    await expectCode(validateApiToken("some-global-secret"), "invalid_token_format", 401);
    expect(eqCalls).toHaveLength(0);
  });

  it("rejects unknown, revoked and expired tokens", async () => {
    row = null;
    await expectCode(validateApiToken(TOKEN), "token_not_recognized", 401);

    row = { id: "t", organization_id: ORG, scopes: [], revoked_at: "2026-01-01T00:00:00Z", expires_at: null };
    await expectCode(validateApiToken(TOKEN), "token_revoked", 401);

    row = { id: "t", organization_id: ORG, scopes: [], revoked_at: null, expires_at: "2000-01-01T00:00:00Z" };
    await expectCode(validateApiToken(TOKEN), "token_expired", 401);
  });

  it("enforces the required scope", async () => {
    row = { id: "t", organization_id: ORG, scopes: ["mcp:read"], revoked_at: null, expires_at: null };
    await expectCode(
      validateApiToken(TOKEN, { requiredScope: PRINTER_WEBHOOK_SCOPE }),
      "token_missing_scope",
      403,
    );
    // No scope requested (MCP path): accepted; tools gate scopes later.
    await expect(validateApiToken(TOKEN)).resolves.toMatchObject({ scopes: ["mcp:read"] });
  });

  it("treats non-array scopes as no scopes", async () => {
    row = { id: "t", organization_id: ORG, scopes: "printer:webhook", revoked_at: null, expires_at: null };
    await expectCode(
      validateApiToken(TOKEN, { requiredScope: PRINTER_WEBHOOK_SCOPE }),
      "token_missing_scope",
      403,
    );
  });

  it("surfaces lookup failures as 500", async () => {
    lookupError = { message: "db down" };
    await expectCode(validateApiToken(TOKEN), "token_lookup_failed", 500);
  });
});

describe("extractBearer", () => {
  it("parses the Authorization header", () => {
    expect(extractBearer(`Bearer ${TOKEN}`)).toBe(TOKEN);
    expect(extractBearer(`bearer   ${TOKEN}  `)).toBe(TOKEN);
    expect(extractBearer(TOKEN)).toBeNull();
    expect(extractBearer(null)).toBeNull();
  });
});
