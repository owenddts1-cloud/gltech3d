/**
 * Isolamento entre tenants nas RPCs SECURITY DEFINER e na listagem de buckets
 * (migration 0083).
 *
 * SECURITY DEFINER ignora RLS. Antes da 0083, um usuário logado de B conseguia
 * gravar na fila `event_log` de A via `emit_event`, e as funções de IA aceitavam
 * ids de qualquer org. Este teste cria dois tenants REAIS e prova, do lado do
 * cliente de B, que nada disso funciona mais.
 *
 * Roda só contra um Supabase de teste (local ou descartável), NUNCA produção:
 *
 *   SUPABASE_TEST_URL=http://localhost:54321 \
 *   SUPABASE_TEST_ANON_KEY=... \
 *   SUPABASE_TEST_SERVICE_ROLE_KEY=... \
 *   npx vitest run tests/unit/tenant-isolation-rpc.test.ts
 *
 * A prova sem Supabase (Postgres puro com o baseline) está em
 * `scripts/verify-baseline.sh`, bloco "0083".
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_TEST_URL;
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const CONFIGURED = Boolean(URL && ANON_KEY && SERVICE_KEY);

const stamp = Date.now();
const PASSWORD = `Isol-${stamp}-ok`;

interface Tenant {
  userId: string;
  orgId: string;
  email: string;
}

describe.skipIf(!CONFIGURED)("isolamento entre tenants — RPCs e buckets (0083)", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let clientB: SupabaseClient;
  const tenants: Tenant[] = [];

  async function makeTenant(label: string): Promise<Tenant> {
    const email = `isolamento+${label}-${stamp}@teste.local`;
    const { data: u, error: uErr } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (uErr || !u.user) throw new Error(`createUser ${label}: ${uErr?.message}`);
    const { data: org, error: oErr } = await admin
      .from("organizations")
      .insert({ slug: `isol-${label}-${stamp}`, legal_name: label, display_name: label })
      .select("id")
      .single();
    if (oErr || !org) throw new Error(`org ${label}: ${oErr?.message}`);
    const { error: mErr } = await admin
      .from("user_organizations")
      .insert({ user_id: u.user.id, organization_id: org.id, role: "admin" });
    if (mErr) throw new Error(`membership ${label}: ${mErr.message}`);
    const t = { userId: u.user.id, orgId: org.id as string, email };
    tenants.push(t);
    return t;
  }

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE_KEY!, { auth: { persistSession: false } });
    anon = createClient(URL!, ANON_KEY!, { auth: { persistSession: false } });
    await makeTenant("a");
    const b = await makeTenant("b");
    clientB = createClient(URL!, ANON_KEY!, { auth: { persistSession: false } });
    const { error } = await clientB.auth.signInWithPassword({ email: b.email, password: PASSWORD });
    if (error) throw new Error(`login B: ${error.message}`);
  });

  afterAll(async () => {
    for (const t of tenants) {
      await admin.from("organizations").delete().eq("id", t.orgId);
      await admin.auth.admin.deleteUser(t.userId);
    }
  });

  it("B grava evento na PRÓPRIA org (o guard não quebrou o caso legítimo)", async () => {
    const b = tenants[1]!;
    const { error } = await clientB.rpc("emit_event", {
      p_event_type: "isolation.own",
      p_entity_kind: "test",
      p_entity_id: null,
      p_payload: {},
      p_metadata: {},
      p_organization_id: b.orgId,
    });
    expect(error).toBeNull();
  });

  it("B NÃO grava na fila de eventos de A via emit_event", async () => {
    const a = tenants[0]!;
    const { error } = await clientB.rpc("emit_event", {
      p_event_type: "isolation.cross",
      p_entity_kind: "test",
      p_entity_id: null,
      p_payload: {},
      p_metadata: {},
      p_organization_id: a.orgId,
    });
    expect(error?.code).toBe("42501");
    const { count } = await admin
      .from("event_log")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", a.orgId)
      .eq("event_type", "isolation.cross");
    expect(count).toBe(0);
  });

  it("B NÃO grava na fila de A via fn_log_event", async () => {
    const a = tenants[0]!;
    const { error } = await clientB.rpc("fn_log_event", {
      p_organization_id: a.orgId,
      p_event_type: "lead.created",
      p_payload: {},
    });
    expect(error?.code).toBe("42501");
  });

  it.each([
    ["fn_publish_ai_agent_version", { p_org_id: "00000000-0000-0000-0000-000000000000", p_agent_id: "00000000-0000-0000-0000-000000000000", p_version_id: "00000000-0000-0000-0000-000000000000" }],
    ["activate_kb_version", { p_agent_id: "00000000-0000-0000-0000-000000000000", p_version_id: "00000000-0000-0000-0000-000000000000" }],
  ] as const)("usuário logado não executa %s (só service role)", async (fn, args) => {
    const { error } = await clientB.rpc(fn, args);
    // 42501 = permission denied for function
    expect(error?.code).toBe("42501");
  });

  it("anônimo não executa fn_publish_ai_agent_version", async () => {
    const { error } = await anon.rpc("fn_publish_ai_agent_version", {
      p_org_id: "00000000-0000-0000-0000-000000000000",
      p_agent_id: "00000000-0000-0000-0000-000000000000",
      p_version_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error?.code).toBe("42501");
  });

  it("anônimo não lista as pastas do bucket landing-media (ids das orgs)", async () => {
    const { data } = await anon.storage.from("landing-media").list("", { limit: 100 });
    expect(data ?? []).toEqual([]);
  });

  it("anônimo não lista o bucket avatars (ids dos usuários)", async () => {
    const { data } = await anon.storage.from("avatars").list("", { limit: 100 });
    expect(data ?? []).toEqual([]);
  });

  it("admin de tenant NÃO altera a própria org pelo cliente do usuário (por isso o app usa updateOwnOrganization)", async () => {
    const b = tenants[1]!;
    const { data, error } = await clientB
      .from("organizations")
      .update({ display_name: "tentativa" })
      .eq("id", b.orgId)
      .select("id");
    // RLS não dá erro: casa zero linhas. Era exatamente o "salvo" que não salvava.
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});
