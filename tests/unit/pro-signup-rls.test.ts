/**
 * Isolamento REAL de `pro_signup_requests`, contra um Supabase de verdade.
 *
 * A tabela guarda nome, e-mail, telefone e comprovante de pagamento de terceiros,
 * e o INSERT público acontece com service role (que bypassa RLS). O que protege
 * a leitura é exclusivamente a policy — logo ela precisa ser provada, não
 * presumida. `pro-signup-migration-drift.test.ts` é guarda de texto; este aqui é
 * a prova.
 *
 * Usa `@supabase/supabase-js` em vez de um driver Postgres de propósito: o vetor
 * real é alguém chamando a PostgREST com a anon key, que é pública por desenho.
 * Testar por aí exercita exatamente o caminho que um atacante usaria — e não
 * exige dependência nova no projeto.
 *
 * Roda só quando as três variáveis abaixo apontam para um banco com a 0081
 * aplicada (o `supabase start` local serve):
 *
 *   SUPABASE_TEST_URL=http://localhost:54321 \
 *   SUPABASE_TEST_ANON_KEY=... \
 *   SUPABASE_TEST_SERVICE_ROLE_KEY=... \
 *   npm run test:unit
 *
 * Sem elas o bloco é pulado — e o pulo aparece no relatório do Vitest, que é o
 * ponto: ninguém pode confundir "não rodou" com "passou".
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_TEST_URL;
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const CONFIGURED = Boolean(URL && ANON_KEY && SERVICE_KEY);

const STAMP = Date.now();
const SEED_EMAIL = `rls-probe-${STAMP}@example.com`;
const MEMBER_EMAIL = `rls-member-${STAMP}@example.com`;
const MEMBER_PASSWORD = `probe-${STAMP}-Aa1!`;

describe.skipIf(!CONFIGURED)("pro_signup_requests — RLS", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  /** Usuário comum, autenticado e SEM ser platform admin. */
  let member: SupabaseClient;
  let seededId: string;
  let memberUserId: string | null = null;

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE_KEY!, { auth: { persistSession: false } });
    anon = createClient(URL!, ANON_KEY!, { auth: { persistSession: false } });

    const { data, error } = await admin
      .from("pro_signup_requests")
      .insert({
        status: "pending",
        plan: "pro",
        buyer_name: "RLS Probe",
        buyer_email: SEED_EMAIL,
        buyer_phone: "+5531999999999",
        amount_cents: 19900,
        declared_paid_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`falha ao semear o pedido: ${error.message}`);
    seededId = data.id as string;

    const { data: created, error: userErr } = await admin.auth.admin.createUser({
      email: MEMBER_EMAIL,
      password: MEMBER_PASSWORD,
      email_confirm: true,
    });
    if (userErr) throw new Error(`falha ao criar o usuário de teste: ${userErr.message}`);
    memberUserId = created.user?.id ?? null;

    member = createClient(URL!, ANON_KEY!, { auth: { persistSession: false } });
    const { error: signInErr } = await member.auth.signInWithPassword({
      email: MEMBER_EMAIL,
      password: MEMBER_PASSWORD,
    });
    if (signInErr) throw new Error(`falha ao autenticar o usuário de teste: ${signInErr.message}`);
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("pro_signup_requests").delete().eq("buyer_email", SEED_EMAIL);
    if (memberUserId) await admin.auth.admin.deleteUser(memberUserId);
  });

  it("o service role enxerga a linha semeada (prova que ela existe)", async () => {
    const { data, error } = await admin
      .from("pro_signup_requests")
      .select("id")
      .eq("id", seededId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(seededId);
  });

  it("anon não lê nenhuma linha", async () => {
    const { data, error } = await anon.from("pro_signup_requests").select("id");
    // RLS não devolve erro: devolve conjunto vazio. É por isso que este teste
    // precisa afirmar o COMPRIMENTO, e não só a ausência de erro.
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("anon não lê nem pedindo a linha pelo id", async () => {
    const { data } = await anon.from("pro_signup_requests").select("id").eq("id", seededId);
    expect(data ?? []).toHaveLength(0);
  });

  it("usuário autenticado comum não lê nenhuma linha", async () => {
    const { data, error } = await member.from("pro_signup_requests").select("id");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("anon não consegue inserir — o intake público só passa pela rota", async () => {
    const { error } = await anon.from("pro_signup_requests").insert({
      status: "pending",
      plan: "pro",
      buyer_name: "Invasor",
      buyer_email: `invasor-${STAMP}@example.com`,
      amount_cents: 1,
      declared_paid_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("usuário autenticado não consegue aprovar um pedido por fora do painel", async () => {
    const { error } = await member
      .from("pro_signup_requests")
      .update({ status: "approved" })
      .eq("id", seededId);

    // Pode voltar erro ou simplesmente não casar linha nenhuma. O que não pode é
    // o pedido ter mudado.
    const { data: after } = await admin
      .from("pro_signup_requests")
      .select("status")
      .eq("id", seededId)
      .single();
    expect(after?.status).toBe("pending");
    expect(error === null || error.code !== undefined).toBe(true);
  });

  it("o comprovante não é legível por anon", async () => {
    const { data, error } = await anon.storage.from("pro-receipts").list();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("o índice único parcial impede dois pedidos pendentes do mesmo e-mail", async () => {
    const { error } = await admin.from("pro_signup_requests").insert({
      status: "pending",
      plan: "pro",
      buyer_name: "Duplicado",
      buyer_email: SEED_EMAIL,
      amount_cents: 19900,
      declared_paid_at: new Date().toISOString(),
    });
    expect(error?.code).toBe("23505");
  });
});
