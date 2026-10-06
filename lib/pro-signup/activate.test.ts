import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { activateProAccount } from "./activate";

const SIGNUP = "9f3e1b2c-1111-4000-8000-000000000001";
const ORG = "9f3e1b2c-aaaa-4000-8000-000000000001";

interface Opts {
  signup?: { id: string; status: string; organization_id: string | null } | null;
  createError?: { message: string; code?: string } | null;
  memberError?: { message: string } | null;
}

function fakeAdmin(opts: Opts = {}) {
  const createUser = vi.fn(async () =>
    opts.createError
      ? { data: { user: null }, error: opts.createError }
      : { data: { user: { id: "new-user" } }, error: null },
  );
  const updateUserById = vi.fn(async () => ({ data: {}, error: null }));
  const deleteUser = vi.fn(async () => ({ data: {}, error: null }));
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];

  const signupRow =
    opts.signup === undefined ? { id: SIGNUP, status: "approved", organization_id: ORG } : opts.signup;

  const client = {
    auth: { admin: { createUser, updateUserById, deleteUser } },
    from(table: string) {
      const b = {
        select: () => b,
        eq: () => b,
        is: () => Promise.resolve({ error: null }),
        update: () => b,
        maybeSingle: () => Promise.resolve({ data: signupRow, error: null }),
        insert: (row: Record<string, unknown>) => {
          inserts.push({ table, row });
          return Promise.resolve({ error: opts.memberError ?? null });
        },
      };
      return b;
    },
  } as unknown as SupabaseClient;

  return { client, createUser, updateUserById, deleteUser, inserts };
}

const base = { signupId: SIGNUP, organizationId: ORG, email: "Maria@Example.com", password: "senha-forte-123" };

describe("activateProAccount", () => {
  it("conta nova: cria com a senha e vira admin da org", async () => {
    const f = fakeAdmin();
    const res = await activateProAccount({ ...base, admin: f.client });
    expect(res).toEqual({ ok: true, userId: "new-user", email: "maria@example.com" });
    expect(f.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "maria@example.com", password: "senha-forte-123" }),
    );
    expect(f.inserts).toEqual([
      {
        table: "user_organizations",
        row: expect.objectContaining({ user_id: "new-user", organization_id: ORG, role: "admin" }),
      },
    ]);
  });

  it("conta JÁ EXISTENTE: recusa e nunca troca a senha (sem tomada de conta)", async () => {
    const f = fakeAdmin({
      createError: { message: "A user with this email address has already been registered", code: "email_exists" },
    });
    const res = await activateProAccount({ ...base, admin: f.client });
    expect(res).toEqual({ ok: false, error: "account_exists" });
    expect(f.updateUserById).not.toHaveBeenCalled();
    expect(f.inserts).toHaveLength(0);
  });

  it("uso único: a segunda ativação com o mesmo link cai em account_exists", async () => {
    const first = fakeAdmin();
    expect((await activateProAccount({ ...base, admin: first.client })).ok).toBe(true);
    const second = fakeAdmin({ createError: { message: "User already registered" } });
    expect(await activateProAccount({ ...base, admin: second.client })).toEqual({
      ok: false,
      error: "account_exists",
    });
    expect(second.updateUserById).not.toHaveBeenCalled();
  });

  it("pedido não aprovado ou de outra org: not_approved, nada é criado", async () => {
    const pending = fakeAdmin({ signup: { id: SIGNUP, status: "pending", organization_id: ORG } });
    expect(await activateProAccount({ ...base, admin: pending.client })).toEqual({
      ok: false,
      error: "not_approved",
    });
    expect(pending.createUser).not.toHaveBeenCalled();

    const otherOrg = fakeAdmin({ signup: { id: SIGNUP, status: "approved", organization_id: "x" } });
    expect((await activateProAccount({ ...base, admin: otherOrg.client })).ok).toBe(false);
    expect(otherOrg.createUser).not.toHaveBeenCalled();
  });

  it("falha ao criar o vínculo desfaz a conta para o link poder ser usado de novo", async () => {
    const f = fakeAdmin({ memberError: { message: "boom" } });
    const res = await activateProAccount({ ...base, admin: f.client });
    expect(res).toEqual({ ok: false, error: "internal_error" });
    expect(f.deleteUser).toHaveBeenCalledWith("new-user");
  });
});
