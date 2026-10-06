import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { writePlanColumns } from "./write";

interface Captured {
  table?: string;
  row?: Record<string, unknown>;
  eq?: [string, unknown];
  select?: string;
}

function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const captured: Captured = {};
  const chain = {
    update(row: Record<string, unknown>) {
      captured.row = row;
      return chain;
    },
    eq(col: string, val: unknown) {
      captured.eq = [col, val];
      return chain;
    },
    select(cols: string) {
      captured.select = cols;
      return Promise.resolve(result);
    },
  };
  const client = {
    from(table: string) {
      captured.table = table;
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, captured };
}

describe("writePlanColumns", () => {
  it("grava só as colunas do plano, filtra pela org e pede o id de volta", async () => {
    const { client, captured } = fakeClient({ data: [{ id: "org-1" }], error: null });
    const res = await writePlanColumns(client, "org-1", {
      plan: "pro",
      plan_expires_at: "2027-01-01T00:00:00.000Z",
    });
    expect(res).toEqual({ ok: true });
    expect(captured.table).toBe("organizations");
    expect(captured.row).toEqual({ plan: "pro", plan_expires_at: "2027-01-01T00:00:00.000Z" });
    expect(captured.eq).toEqual(["id", "org-1"]);
    expect(captured.select).toBe("id");
  });

  it("inclui trial_ends_at quando o patch traz", async () => {
    const { client, captured } = fakeClient({ data: [{ id: "org-1" }], error: null });
    await writePlanColumns(client, "org-1", {
      plan: "standard",
      plan_expires_at: null,
      trial_ends_at: "2026-10-06T12:00:00.000Z",
    });
    expect(captured.row?.trial_ends_at).toBe("2026-10-06T12:00:00.000Z");
  });

  it("zero linhas é erro, não sucesso silencioso", async () => {
    const { client } = fakeClient({ data: [], error: null });
    const res = await writePlanColumns(client, "org-x", { plan: "pro", plan_expires_at: null });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("not_found");
  });

  it("erro do banco é propagado", async () => {
    const { client } = fakeClient({ data: null, error: { message: "boom" } });
    const res = await writePlanColumns(client, "org-1", { plan: "pro", plan_expires_at: null });
    expect(res).toEqual({ ok: false, code: "db_error", message: "boom" });
  });
});
