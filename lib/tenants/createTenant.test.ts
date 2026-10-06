/**
 * Este teste existe porque `createTenant` esteve QUEBRADO em producao sem que
 * ninguem notasse: gravava `status:'onboarding'`, valor que
 * `organizations_status_check` nao admite (23514), e `legal_name: null` numa
 * coluna NOT NULL (23502). Os dois unicos caminhos de criacao de tenant — o
 * console de platform admin e a aprovacao de pedido PRO — falhavam, e so nao
 * apareceu porque nenhum tenant tinha sido criado por ali ainda.
 *
 * As asserçoes abaixo sao o contrato com o schema. Elas falhariam na versao
 * antiga do arquivo.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createTenant } from "./createTenant";

type InsertedRow = Record<string, unknown>;

/**
 * Client falso que captura a linha enviada ao INSERT. So implementa a cadeia que
 * `createTenant` usa: from().insert().select().single().
 */
function fakeClient(result: { data?: unknown; error?: { code?: string; message: string } }) {
  const captured: { row?: InsertedRow } = {};
  const client = {
    from() {
      return {
        insert(row: InsertedRow) {
          captured.row = row;
          return {
            select() {
              return {
                single: async () => ({
                  data: result.data ?? { id: "org-1", slug: row.slug, display_name: row.display_name },
                  error: result.error ?? null,
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

const BASE = {
  display_name: "Oficina do Gui",
  slug: "oficina-do-gui",
  plan: "standard" as const,
  createdBy: "user-1",
};

describe("createTenant — contrato com o schema", () => {
  it("grava status 'active', nunca 'onboarding'", async () => {
    const { client, captured } = fakeClient({});
    await createTenant(client, BASE);
    // 'onboarding' nao esta no CHECK; progresso de onboarding e onboarded_at.
    expect(captured.row?.status).toBe("active");
  });

  it("nunca envia legal_name nulo ou vazio (coluna NOT NULL)", async () => {
    const { client, captured } = fakeClient({});
    await createTenant(client, BASE);
    expect(captured.row?.legal_name).toBe("Oficina do Gui");
  });

  it("usa a razao social quando ela vem informada", async () => {
    const { client, captured } = fakeClient({});
    await createTenant(client, { ...BASE, legal_name: "Gui Tecnologia LTDA" });
    expect(captured.row?.legal_name).toBe("Gui Tecnologia LTDA");
  });

  it("cai para o nome fantasia quando a razao social vem so com espacos", async () => {
    const { client, captured } = fakeClient({});
    await createTenant(client, { ...BASE, legal_name: "   " });
    expect(captured.row?.legal_name).toBe("Oficina do Gui");
  });

  it("deixa onboarded_at nulo por padrao", async () => {
    const { client, captured } = fakeClient({});
    await createTenant(client, BASE);
    expect(captured.row?.onboarded_at).toBeNull();
  });

  it("marca onboarded_at quando markOnboarded e verdadeiro", async () => {
    const { client, captured } = fakeClient({});
    await createTenant(client, { ...BASE, markOnboarded: true });
    expect(typeof captured.row?.onboarded_at).toBe("string");
    expect(Number.isNaN(Date.parse(captured.row?.onboarded_at as string))).toBe(false);
  });

  it("escreve o plano SÓ na coluna — o settings.plan legado não é mais gravado", async () => {
    const { client, captured } = fakeClient({});
    await createTenant(client, { ...BASE, plan: "pro" });
    expect(captured.row?.plan).toBe("pro");
    expect(captured.row?.settings).toBeUndefined();
  });

  it("aceita createdBy nulo (aprovação pelo link do e-mail, sem usuário)", async () => {
    const { client, captured } = fakeClient({});
    await createTenant(client, { ...BASE, createdBy: null });
    expect(captured.row?.created_by).toBeNull();
  });

  it("repassa trial_ends_at e plan_expires_at, com null como padrao", async () => {
    const { client: c1, captured: cap1 } = fakeClient({});
    await createTenant(c1, BASE);
    expect(cap1.row?.trial_ends_at).toBeNull();
    expect(cap1.row?.plan_expires_at).toBeNull();

    const trial = "2026-10-12T00:00:00.000Z";
    const { client: c2, captured: cap2 } = fakeClient({});
    await createTenant(c2, { ...BASE, trialEndsAt: trial });
    expect(cap2.row?.trial_ends_at).toBe(trial);
  });

  it("traduz 23505 em slug_conflict, e nao em erro generico", async () => {
    const { client } = fakeClient({ data: null, error: { code: "23505", message: "dup" } });
    const res = await createTenant(client, BASE);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("slug_conflict");
  });

  it("qualquer outro erro vira 'internal' preservando a mensagem", async () => {
    const { client } = fakeClient({ data: null, error: { code: "23502", message: "legal_name nulo" } });
    const res = await createTenant(client, BASE);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("internal");
      expect(res.message).toContain("legal_name");
    }
  });
});
