import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  approveProSignup,
  rejectProSignup,
  slugCandidates,
  isAccountNewerThanRequest,
  type ApproveDeps,
} from "./approve";
import { proPlanWith } from "@/lib/pricing/pro-plans";

// ---------------------------------------------------------------------------
// Minimal fake of the supabase-js query builder. Every terminal call resolves
// through `handler`, which sees the table, the operation and the filters.
// ---------------------------------------------------------------------------

type Op = "select" | "update" | "insert";

interface Call {
  table: string;
  op: Op;
  payload?: Record<string, unknown>;
  filters: Array<[string, string, unknown]>;
}

type Result = { data: unknown; error: { message: string; code?: string } | null };
type Handler = (call: Call) => Result;

function fakeAdmin(handler: Handler) {
  const calls: Call[] = [];
  function builder(table: string): Record<string, unknown> {
    const call: Call = { table, op: "select", filters: [] };
    let opSet = false;
    const resolve = () => {
      calls.push(call);
      return Promise.resolve(handler(call));
    };
    const b: Record<string, unknown> = {
      select: () => {
        if (!opSet) call.op = "select";
        return b;
      },
      update: (payload: Record<string, unknown>) => {
        call.op = "update";
        call.payload = payload;
        opSet = true;
        return b;
      },
      insert: (payload: Record<string, unknown>) => {
        call.op = "insert";
        call.payload = payload;
        opSet = true;
        return b;
      },
      eq: (col: string, val: unknown) => {
        call.filters.push(["eq", col, val]);
        return b;
      },
      is: (col: string, val: unknown) => {
        call.filters.push(["is", col, val]);
        return b;
      },
      maybeSingle: resolve,
      single: resolve,
      then: (onOk: (r: Result) => unknown, onErr?: (e: unknown) => unknown) =>
        resolve().then(onOk, onErr),
    };
    return b;
  }
  const client = { from: (t: string) => builder(t) } as unknown as SupabaseClient;
  return { client, calls };
}

const SIGNUP_ID = "9f3e1b2c-1111-4000-8000-000000000001";
const ORG_A = "9f3e1b2c-aaaa-4000-8000-000000000001";
const ORG_B = "9f3e1b2c-bbbb-4000-8000-000000000002";
const USER = "9f3e1b2c-cccc-4000-8000-000000000003";

const PENDING_ROW = {
  id: SIGNUP_ID,
  status: "pending",
  buyer_name: "Maria Silva",
  buyer_email: "Maria@Example.com",
  buyer_phone: "31999990000",
  company_name: "Maria Impressões",
  organization_id: null as string | null,
  amount_cents: 19_700,
  created_at: "2026-10-05T12:00:00.000Z",
};

function deps(over: Partial<ApproveDeps> = {}): Partial<ApproveDeps> {
  return {
    findUserIdByEmail: vi.fn(async () => null),
    // Default: the account predates the request (the trial → paid case).
    userCreatedAt: vi.fn(async () => "2026-09-01T12:00:00.000Z"),
    grantProAccess: vi.fn(async () => ({ ok: true as const, planExpiresAt: "2027-10-06T12:00:00.000Z" })),
    createTenant: vi.fn(async (_c, input) => ({
      ok: true as const,
      org: { id: ORG_A, slug: input.slug, display_name: input.display_name },
    })),
    sendEmail: vi.fn(async () => ({ ok: true as const, id: "mail" })),
    audit: vi.fn(async () => undefined),
    signInviteToken: vi.fn(() => "tok"),
    now: () => new Date("2026-10-06T12:00:00.000Z"),
    proPlan: async () => proPlanWith({ amountCents: 8900, periodDays: 365 }),
    ...over,
  };
}

/** Handler for the common flow: row lookup + successful claim + org name. */
function happyHandler(row: typeof PENDING_ROW, extra?: (call: Call) => Result | null): Handler {
  return (call) => {
    const custom = extra?.(call);
    if (custom) return custom;
    if (call.table === "pro_signup_requests" && call.op === "select") return { data: row, error: null };
    if (call.table === "pro_signup_requests" && call.op === "update") return { data: { id: row.id }, error: null };
    if (call.table === "organizations") return { data: { display_name: "Org A" }, error: null };
    if (call.table === "user_organizations" && call.op === "select") return { data: [], error: null };
    return { data: null, error: null };
  };
}

const base = {
  requestId: "req-1",
  signupId: SIGNUP_ID,
  reviewerUserId: null,
  chosenOrgId: null,
  ip: "1.2.3.4",
} as const;

describe("approveProSignup — decisões antes de escrever", () => {
  it("not_found quando o pedido não existe", async () => {
    const { client, calls } = fakeAdmin(() => ({ data: null, error: null }));
    const res = await approveProSignup({ ...base, admin: client, via: "email_link", deps: deps() });
    expect(res).toMatchObject({ outcome: "error", error: "not_found" });
    expect(calls.filter((c) => c.op !== "select")).toHaveLength(0);
  });

  it("not_pending quando já foi decidido — nada é escrito", async () => {
    const d = deps();
    const { client, calls } = fakeAdmin(
      happyHandler({ ...PENDING_ROW, status: "approved", organization_id: ORG_A }),
    );
    const res = await approveProSignup({ ...base, admin: client, via: "email_link", deps: d });
    expect(res).toMatchObject({
      outcome: "error",
      error: "not_pending",
      currentStatus: "approved",
      organizationId: ORG_A,
    });
    expect(calls.filter((c) => c.op === "update")).toHaveLength(0);
    expect(d.grantProAccess).not.toHaveBeenCalled();
  });

  it("amount_mismatch quando o valor do token não bate", async () => {
    const d = deps();
    const { client, calls } = fakeAdmin(happyHandler(PENDING_ROW));
    const res = await approveProSignup({
      ...base,
      admin: client,
      via: "email_link",
      expectedAmountCents: 1,
      deps: d,
    });
    expect(res).toMatchObject({ outcome: "error", error: "amount_mismatch" });
    expect(calls.filter((c) => c.op === "update")).toHaveLength(0);
  });

  it("ambiguous quando o e-mail tem duas orgs — não adivinha nem escreve", async () => {
    const d = deps({ findUserIdByEmail: vi.fn(async () => USER) });
    const { client, calls } = fakeAdmin(
      happyHandler(PENDING_ROW, (call) =>
        call.table === "user_organizations" && call.op === "select"
          ? {
              data: [
                { organization_id: ORG_A, organizations: { display_name: "A" } },
                { organization_id: ORG_B, organizations: { display_name: "B" } },
              ],
              error: null,
            }
          : null,
      ),
    );
    const res = await approveProSignup({ ...base, admin: client, via: "email_link", deps: d });
    expect(res.outcome).toBe("ambiguous");
    if (res.outcome === "ambiguous") expect(res.candidates).toHaveLength(2);
    expect(calls.filter((c) => c.op === "update")).toHaveLength(0);
  });

  it("painel sem nome/slug no caminho CREATE → missing_tenant_fields", async () => {
    const { client, calls } = fakeAdmin(happyHandler(PENDING_ROW));
    const res = await approveProSignup({ ...base, admin: client, via: "panel", deps: deps() });
    expect(res).toMatchObject({ outcome: "error", error: "missing_tenant_fields" });
    expect(calls.filter((c) => c.op === "update")).toHaveLength(0);
  });
});

describe("approveProSignup — efeito único", () => {
  it("perdeu o claim (outro clique ganhou) → not_pending e o plano NÃO é concedido", async () => {
    const d = deps();
    const { client } = fakeAdmin(
      happyHandler({ ...PENDING_ROW, organization_id: ORG_A }, (call) =>
        call.table === "pro_signup_requests" && call.op === "update"
          ? { data: null, error: null }
          : null,
      ),
    );
    const res = await approveProSignup({ ...base, admin: client, via: "email_link", deps: d });
    expect(res).toMatchObject({ outcome: "error", error: "not_pending" });
    expect(d.grantProAccess).not.toHaveBeenCalled();
    expect(d.createTenant).not.toHaveBeenCalled();
  });

  it("UPGRADE pelo e-mail: concede uma vez, audita via=email_link sem ator", async () => {
    const d = deps();
    const { client, calls } = fakeAdmin(happyHandler({ ...PENDING_ROW, organization_id: ORG_A }));
    const res = await approveProSignup({ ...base, admin: client, via: "email_link", deps: d });

    expect(res).toMatchObject({
      outcome: "approved",
      mode: "upgrade",
      organizationId: ORG_A,
      organizationName: "Org A",
    });
    expect(d.grantProAccess).toHaveBeenCalledTimes(1);

    const claim = calls.find((c) => c.table === "pro_signup_requests" && c.op === "update");
    expect(claim?.payload).toMatchObject({
      status: "approved",
      reviewed_by: null,
      organization_id: ORG_A,
      invited_user_email: "maria@example.com",
    });
    expect(claim?.filters).toContainEqual(["eq", "status", "pending"]);

    expect(d.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "pro_signup.approved",
        actorUserId: null,
        actingAsPlatformAdmin: false,
        ip: "1.2.3.4",
        metadata: expect.objectContaining({ mode: "upgrade", via: "email_link" }),
      }),
    );
  });

  it("o período concedido vem do plano VIVO (platform_settings), não da constante", async () => {
    const d = deps({ proPlan: async () => proPlanWith({ amountCents: 8900, periodDays: 180 }) });
    const { client } = fakeAdmin(happyHandler({ ...PENDING_ROW, organization_id: ORG_A }));
    await approveProSignup({ ...base, admin: client, via: "email_link", deps: d });
    expect(d.grantProAccess).toHaveBeenCalledWith(client, ORG_A, 180);
  });

  it("falha ao conceder depois do claim → devolve o pedido para pending", async () => {
    const d = deps({
      grantProAccess: vi.fn(async () => ({ ok: false as const, message: "db down" })),
    });
    const { client, calls } = fakeAdmin(happyHandler({ ...PENDING_ROW, organization_id: ORG_A }));
    const res = await approveProSignup({ ...base, admin: client, via: "panel", deps: d });

    expect(res).toMatchObject({ outcome: "error", error: "internal" });
    const updates = calls.filter((c) => c.table === "pro_signup_requests" && c.op === "update");
    expect(updates).toHaveLength(2);
    expect(updates[1]?.payload).toMatchObject({ status: "pending", reviewed_by: null });
    expect(d.audit).not.toHaveBeenCalled();
  });
});

describe("approveProSignup — conta criada DEPOIS do pedido público (sequestro de PRO)", () => {
  const ATTACKER_ORG = "99999999-9999-4999-8999-999999999999";
  const oneOrg = (call: Call): Result | null =>
    call.table === "user_organizations" && call.op === "select"
      ? { data: [{ organization_id: ATTACKER_ORG, organizations: { display_name: "Org do atacante" } }], error: null }
      : null;

  it("pelo e-mail: recusa (ambiguous, decida pelo painel) e não escreve nada", async () => {
    const d = deps({
      findUserIdByEmail: vi.fn(async () => USER),
      userCreatedAt: vi.fn(async () => "2026-10-05T13:00:00.000Z"),
    });
    const { client, calls } = fakeAdmin(happyHandler(PENDING_ROW, oneOrg));
    const res = await approveProSignup({ ...base, admin: client, via: "email_link", deps: d });
    expect(res).toMatchObject({ outcome: "ambiguous", reason: "account_newer_than_request" });
    expect(calls.filter((c) => c.op !== "select")).toHaveLength(0);
    expect(d.grantProAccess).not.toHaveBeenCalled();
  });

  it("pelo e-mail: ignora qualquer chosenOrgId", async () => {
    const d = deps({
      findUserIdByEmail: vi.fn(async () => USER),
      userCreatedAt: vi.fn(async () => "2026-10-05T13:00:00.000Z"),
    });
    const { client } = fakeAdmin(happyHandler(PENDING_ROW, oneOrg));
    const res = await approveProSignup({
      ...base,
      chosenOrgId: ATTACKER_ORG,
      admin: client,
      via: "email_link",
      deps: d,
    });
    expect(res.outcome).toBe("ambiguous");
  });

  it("pelo painel: sem escolha explícita também para; com escolha, libera a org escolhida", async () => {
    const d = deps({
      findUserIdByEmail: vi.fn(async () => USER),
      userCreatedAt: vi.fn(async () => "2026-10-05T13:00:00.000Z"),
    });
    const { client } = fakeAdmin(happyHandler(PENDING_ROW, oneOrg));
    const stop = await approveProSignup({ ...base, admin: client, via: "panel", deps: d });
    expect(stop).toMatchObject({ outcome: "ambiguous", reason: "account_newer_than_request" });

    const go = await approveProSignup({ ...base, chosenOrgId: ATTACKER_ORG, admin: client, via: "panel", deps: d });
    expect(go).toMatchObject({ outcome: "approved", mode: "upgrade", organizationId: ATTACKER_ORG });
  });

  it("data da conta ilegível = trata como suspeita (fail-closed)", async () => {
    const d = deps({ findUserIdByEmail: vi.fn(async () => USER), userCreatedAt: vi.fn(async () => null) });
    const { client } = fakeAdmin(happyHandler(PENDING_ROW, oneOrg));
    const res = await approveProSignup({ ...base, admin: client, via: "email_link", deps: d });
    expect(res.outcome).toBe("ambiguous");
  });

  it("pedido feito de DENTRO do CRM (com org) não consulta a data da conta", async () => {
    const d = deps({ findUserIdByEmail: vi.fn(async () => USER), userCreatedAt: vi.fn(async () => null) });
    const { client } = fakeAdmin(happyHandler({ ...PENDING_ROW, organization_id: ORG_A }));
    const res = await approveProSignup({ ...base, admin: client, via: "email_link", deps: d });
    expect(res).toMatchObject({ outcome: "approved", mode: "upgrade", organizationId: ORG_A });
    expect(d.userCreatedAt).not.toHaveBeenCalled();
  });

  it("isAccountNewerThanRequest", () => {
    expect(isAccountNewerThanRequest("2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")).toBe(false);
    expect(isAccountNewerThanRequest("2026-03-01T00:00:00Z", "2026-02-01T00:00:00Z")).toBe(true);
    expect(isAccountNewerThanRequest(null, "2026-02-01T00:00:00Z")).toBe(true);
    expect(isAccountNewerThanRequest("2026-01-01T00:00:00Z", null)).toBe(true);
  });
});

describe("approveProSignup — CREATE pelo e-mail", () => {
  it("deriva nome/slug do pedido e tenta sufixo quando o slug já existe", async () => {
    const createTenant = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, code: "slug_conflict", message: "dup" })
      .mockImplementationOnce(async (_c: unknown, input: { slug: string; display_name: string }) => ({
        ok: true,
        org: { id: ORG_A, slug: input.slug, display_name: input.display_name },
      }));
    const d = deps({ createTenant });
    const { client, calls } = fakeAdmin(happyHandler(PENDING_ROW));
    const res = await approveProSignup({ ...base, admin: client, via: "email_link", deps: d });

    expect(res.outcome).toBe("approved");
    if (res.outcome === "approved" && res.mode === "create") {
      expect(res.organization.display_name).toBe("Maria Impressões");
      expect(res.organization.slug).toMatch(/^maria-impressoes-[0-9a-f]{4}$/);
      expect(res.activationUrl).toContain("/ativar/tok");
    }
    expect(createTenant).toHaveBeenCalledTimes(2);
    expect(createTenant.mock.calls[0]?.[1]).toMatchObject({
      slug: "maria-impressoes",
      createdBy: null,
      plan: "pro",
    });
    // O pedido fica vinculado ao tenant novo — a ativação confere isso.
    const link = calls.filter((c) => c.table === "pro_signup_requests" && c.op === "update").at(-1);
    expect(link?.payload).toEqual({ organization_id: ORG_A });
  });
});

describe("slugCandidates", () => {
  it("nome sem letras úteis cai em 'cliente'", () => {
    expect(slugCandidates("!!", () => "abcd")[0]).toBe("cliente");
  });
  it("sufixos respeitam o limite de 40 caracteres", () => {
    const list = slugCandidates("x".repeat(80), () => "abcd");
    for (const s of list) expect(s.length).toBeLessThanOrEqual(40);
  });
});

describe("rejectProSignup", () => {
  it("not_pending quando o update condicional não pega linha", async () => {
    const audit = vi.fn(async () => undefined);
    const { client } = fakeAdmin(() => ({ data: null, error: null }));
    const res = await rejectProSignup({
      admin: client,
      requestId: "r",
      signupId: SIGNUP_ID,
      reviewerUserId: null,
      reviewNote: "recusado pelo link do e-mail",
      via: "email_link",
      ip: null,
      deps: { audit },
    });
    expect(res).toMatchObject({ outcome: "error", error: "not_pending" });
    expect(audit).not.toHaveBeenCalled();
  });

  it("rejeita só pedido pending e audita a via", async () => {
    const audit = vi.fn(async () => undefined);
    const { client, calls } = fakeAdmin(() => ({ data: { id: SIGNUP_ID }, error: null }));
    const res = await rejectProSignup({
      admin: client,
      requestId: "r",
      signupId: SIGNUP_ID,
      reviewerUserId: null,
      reviewNote: "recusado pelo link do e-mail",
      via: "email_link",
      ip: "1.1.1.1",
      deps: { audit },
    });
    expect(res).toEqual({ outcome: "rejected", signupId: SIGNUP_ID });
    expect(calls[0]?.filters).toContainEqual(["eq", "status", "pending"]);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: null, metadata: { has_note: true, via: "email_link" } }),
    );
  });
});

// ---------------------------------------------------------------------------
// Membership: approval never promotes, never reactivates.
// ---------------------------------------------------------------------------

/** user_organizations: the single-row lookup (filtered by org) vs the list. */
function membershipHandler(single: { id: string; revoked_at: string | null } | null): (call: Call) => Result | null {
  return (call) => {
    if (call.table !== "user_organizations" || call.op !== "select") return null;
    const byOrg = call.filters.some(([, col]) => col === "organization_id");
    return byOrg ? { data: single, error: null } : { data: [], error: null };
  };
}

describe("approveProSignup — membership do comprador", () => {
  it("membro ATIVO (ex.: viewer): papel não é tocado — nenhuma escrita em user_organizations", async () => {
    const d = deps({ findUserIdByEmail: vi.fn(async () => USER) });
    const { client, calls } = fakeAdmin(
      happyHandler({ ...PENDING_ROW, organization_id: ORG_A }, membershipHandler({ id: "m1", revoked_at: null })),
    );
    const res = await approveProSignup({ ...base, admin: client, via: "email_link", deps: d });

    expect(res).toMatchObject({ outcome: "approved", mode: "upgrade", membership: "active_kept" });
    expect(calls.filter((c) => c.table === "user_organizations" && c.op !== "select")).toHaveLength(0);
  });

  it("membership REVOGADA: plano liberado, acesso NÃO reativado e avisado", async () => {
    const d = deps({ findUserIdByEmail: vi.fn(async () => USER) });
    const { client, calls } = fakeAdmin(
      happyHandler(
        { ...PENDING_ROW, organization_id: ORG_A },
        membershipHandler({ id: "m1", revoked_at: "2026-09-01T00:00:00.000Z" }),
      ),
    );
    const res = await approveProSignup({ ...base, admin: client, via: "panel", deps: d, tenant: {} });

    expect(res).toMatchObject({ outcome: "approved", membership: "revoked_not_reactivated" });
    expect(d.grantProAccess).toHaveBeenCalledTimes(1);
    expect(calls.filter((c) => c.table === "user_organizations" && c.op !== "select")).toHaveLength(0);
    expect(d.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ buyer_membership: "revoked_not_reactivated" }),
      }),
    );
  });
});

describe("approveProSignup — CREATE com conta existente", () => {
  it("sem link de ativação: vira admin da org NOVA e entra com a senha atual", async () => {
    const d = deps({ findUserIdByEmail: vi.fn(async () => USER) });
    const { client, calls } = fakeAdmin(happyHandler(PENDING_ROW));
    const res = await approveProSignup({ ...base, admin: client, via: "email_link", deps: d });

    expect(res).toMatchObject({
      outcome: "approved",
      mode: "create",
      existingAccount: true,
      activationUrl: null,
      activationExpiresAt: null,
    });
    expect(d.signInviteToken).not.toHaveBeenCalled();
    const inserts = calls.filter((c) => c.table === "user_organizations" && c.op === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.payload).toMatchObject({ user_id: USER, organization_id: ORG_A, role: "admin" });
  });

  it("conta nova continua recebendo link de ativação", async () => {
    const d = deps();
    const { client } = fakeAdmin(happyHandler(PENDING_ROW));
    const res = await approveProSignup({ ...base, admin: client, via: "email_link", deps: d });
    expect(res).toMatchObject({ mode: "create", existingAccount: false });
    if (res.outcome === "approved" && res.mode === "create") {
      expect(res.activationUrl).toContain("/ativar/tok");
    }
  });
});
