/**
 * Contract for writes to the caller's own organization.
 *
 * Regression being guarded: the tenant settings form and the energy tariff
 * wrote through the user client, RLS matched zero rows, no error came back and
 * the UI said "saved". Zero rows must now be an explicit failure.
 */
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("tests must inject a client");
  },
}));

import { assertPatchAllowed, mergeOwnOrgSettings, updateOwnOrganization } from "./update-own-org";

interface Captured {
  patch?: Record<string, unknown>;
  eq?: [string, unknown];
}

function fakeClient(opts: {
  updatedRows?: { id: string }[] | null;
  updateError?: { message: string } | null;
  settings?: Record<string, unknown> | null;
}) {
  const captured: Captured = {};
  const client = {
    from() {
      return {
        update(patch: Record<string, unknown>) {
          captured.patch = patch;
          return {
            eq(col: string, val: unknown) {
              captured.eq = [col, val];
              return {
                select: async () => ({
                  data: opts.updatedRows === undefined ? [{ id: String(val) }] : opts.updatedRows,
                  error: opts.updateError ?? null,
                }),
              };
            },
          };
        },
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: opts.settings === null ? null : { settings: opts.settings ?? {} },
                  error: null,
                }),
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, captured };
}

describe("updateOwnOrganization", () => {
  it("filters by the given org id and succeeds when a row was updated", async () => {
    const { client, captured } = fakeClient({});
    const res = await updateOwnOrganization("org-1", { display_name: "Oficina" }, client);
    expect(res).toEqual({ ok: true });
    expect(captured.eq).toEqual(["id", "org-1"]);
    expect(captured.patch).toEqual({ display_name: "Oficina" });
  });

  it("treats zero affected rows as failure, never as silent success", async () => {
    const { client } = fakeClient({ updatedRows: [] });
    const res = await updateOwnOrganization("org-1", { display_name: "x" }, client);
    expect(res).toEqual({ ok: false, error: "organization_not_updated" });
  });

  it("propagates database errors", async () => {
    const { client } = fakeClient({ updateError: { message: "boom" } });
    expect(await updateOwnOrganization("org-1", { display_name: "x" }, client)).toEqual({
      ok: false,
      error: "boom",
    });
  });

  it.each(["plan", "trial_ends_at", "plan_expires_at", "status", "slug", "id"])(
    "refuses to write the protected column %s",
    async (col) => {
      const { client, captured } = fakeClient({});
      const res = await updateOwnOrganization("org-1", { [col]: "pro" }, client);
      expect(res).toEqual({ ok: false, error: `forbidden_column:${col}` });
      expect(captured.patch).toBeUndefined();
    },
  );

  it("assertPatchAllowed returns null for ordinary columns", () => {
    expect(assertPatchAllowed({ display_name: "a", settings: {} })).toBeNull();
  });
});

describe("mergeOwnOrgSettings", () => {
  it("keeps the other settings keys when changing one", async () => {
    const { client, captured } = fakeClient({ settings: { documents: { footer: "x" }, k_energy: 0.85 } });
    const res = await mergeOwnOrgSettings("org-1", { k_energy: 1.02 }, client);
    expect(res).toEqual({ ok: true });
    expect(captured.patch).toEqual({ settings: { documents: { footer: "x" }, k_energy: 1.02 } });
  });

  it("fails when the organization does not exist", async () => {
    const { client } = fakeClient({ settings: null });
    expect(await mergeOwnOrgSettings("org-x", { k_energy: 1 }, client)).toEqual({
      ok: false,
      error: "organization_not_found",
    });
  });
});
