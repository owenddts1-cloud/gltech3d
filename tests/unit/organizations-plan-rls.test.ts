/**
 * O que impede um cliente de se dar PRO sozinho.
 *
 * A coluna `plan` mora em `organizations`, cuja única policy de escrita é
 * `orgs_write_platform_admin`. A migration 0082 **não** criou policy nova
 * justamente por isso — e essa ausência é uma propriedade de segurança, não um
 * esquecimento. Alguém "consertando" isso no futuro abriria auto-promoção de
 * plano via PostgREST com a anon key, que é pública por desenho.
 *
 * ATENÇÃO AO MODO DE FALHA: um UPDATE que não casa policy **não devolve erro** —
 * ele afeta zero linhas e o PostgREST responde sucesso. Por isso o teste afirma
 * o VALOR depois da tentativa, nunca só a ausência de erro.
 *
 * Roda só com as três variáveis apontando para um banco com a 0082 aplicada:
 *
 *   SUPABASE_TEST_URL=... SUPABASE_TEST_ANON_KEY=... \
 *   SUPABASE_TEST_SERVICE_ROLE_KEY=... npm run test:unit
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_TEST_URL;
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const CONFIGURED = Boolean(URL && ANON_KEY && SERVICE_KEY);

const STAMP = Date.now();
const SLUG = `plan-rls-probe-${STAMP}`;

describe.skipIf(!CONFIGURED)("organizations.plan — RLS", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let orgId: string;

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE_KEY!, { auth: { persistSession: false } });
    anon = createClient(URL!, ANON_KEY!, { auth: { persistSession: false } });

    const { data, error } = await admin
      .from("organizations")
      .insert({
        display_name: "Plan RLS Probe",
        legal_name: "Plan RLS Probe",
        slug: SLUG,
        status: "active",
        plan: "standard",
      })
      .select("id")
      .single();
    if (error) throw new Error(`falha ao semear a org: ${error.message}`);
    orgId = data.id as string;
  });

  afterAll(async () => {
    if (admin && orgId) await admin.from("organizations").delete().eq("id", orgId);
  });

  it("as três colunas existem e nascem com o padrão certo", async () => {
    const { data } = await admin
      .from("organizations")
      .select("plan, trial_ends_at, plan_expires_at")
      .eq("id", orgId)
      .single();
    expect(data?.plan).toBe("standard");
    expect(data?.trial_ends_at).toBeNull();
    expect(data?.plan_expires_at).toBeNull();
  });

  it("anon NÃO consegue se promover a pro — o valor não muda", async () => {
    await anon.from("organizations").update({ plan: "pro" }).eq("id", orgId);
    // O UPDATE pode responder sucesso afetando zero linhas. O que prova a
    // proteção é o valor, não o código de retorno.
    const { data } = await admin.from("organizations").select("plan").eq("id", orgId).single();
    expect(data?.plan).toBe("standard");
  });

  it("anon NÃO consegue estender o próprio vencimento", async () => {
    const futuro = new Date(Date.now() + 3650 * 86_400_000).toISOString();
    await anon.from("organizations").update({ plan_expires_at: futuro }).eq("id", orgId);
    const { data } = await admin
      .from("organizations")
      .select("plan_expires_at")
      .eq("id", orgId)
      .single();
    expect(data?.plan_expires_at).toBeNull();
  });

  it("anon não lê organizações", async () => {
    const { data } = await anon.from("organizations").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("o CHECK recusa plano fora do vocabulário", async () => {
    const { error } = await admin.from("organizations").update({ plan: "gold" }).eq("id", orgId);
    expect(error?.code).toBe("23514");
  });

  it.each(["standard", "pro", "enterprise"])("o CHECK aceita '%s'", async (plan) => {
    const { error } = await admin.from("organizations").update({ plan }).eq("id", orgId);
    expect(error).toBeNull();
  });
});
