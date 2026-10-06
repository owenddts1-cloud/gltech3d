/**
 * Jornada do Calc3D PRO — PARTE A: da landing até o pedido de pagamento.
 *
 *   E2E_JOURNEY=1 npx playwright test tests/e2e/calc3d-pro-jornada.spec.ts
 *
 * RODE CONTRA BUILD DE PRODUÇÃO, não contra `next dev`: no Windows o dev server
 * "perdeu" rotas no meio da jornada (404 sem notFound() no código e o loop
 * "missing required error components"). Antes do teste:
 *   npx next build && npx next start -p 3001
 * O playwright.config reaproveita o servidor que já está na porta 3001.
 *
 * ESCREVE NO BANCO DE PRODUÇÃO (o .env.local aponta para ele). Sem
 * `E2E_JOURNEY=1` o teste é pulado, para o CI e o `npm run test:e2e` nunca
 * criarem conta de verdade. Limpe depois com `scripts/limpar-conta-teste.mjs`.
 *
 * A aprovação do pagamento é feita À MÃO, no painel, entre esta parte e a
 * Parte B — é o caminho real, com MFA de administrador.
 */
import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  JOURNEY_ENABLED,
  OUT_DIR,
  adminClient,
  newIdentity,
  saveState,
  snap,
  collectErrors,
  hasErrorScreen,
  anonClient,
  fecharGuia,
} from "./_jornada/helpers";

/**
 * Rotas da navegação do CRM (components/shell/nav-crm.ts) mais as telas de
 * configuração que o cliente usa. Lista explícita em vez de importar `CRM_NAV`:
 * aquele módulo arrasta componentes React de ícone para o processo do teste.
 */
const MODULOS: ReadonlyArray<[string, string]> = [
  ["Dashboard", "/app/dashboard"],
  ["Projetos", "/app/projects"],
  ["Ordens de Serviço", "/app/service-orders"],
  ["Organização", "/app/settings/tenant"],
  ["Impressoras & Filamentos", "/app/printers"],
  ["Modelagem", "/app/models"],
  ["Fatiar", "/app/models/fatiar"],
  ["Calculadora 3D", "/app/calculator"],
  ["Calendário", "/app/calendar"],
  ["Vendas — visão geral", "/app/sales"],
  ["Vendas — Shopee", "/app/sales/shopee"],
  ["Vendas — Mercado Livre", "/app/sales/mercado-livre"],
  ["Vendas — Facebook", "/app/sales/facebook"],
  ["Produtos", "/app/products"],
  ["Cadastro de produto", "/app/sales/new-product"],
  ["Financeiro — Controle", "/app/control"],
  ["Relatórios", "/app/reports"],
  ["Inbox", "/app/inbox"],
  ["Conexões", "/app/connections"],
  ["Contatos", "/app/contacts"],
  ["Equipe", "/app/team"],
  ["LGPD", "/app/lgpd/requests"],
  ["Agentes IA", "/app/ai/agents"],
  ["Inventário", "/app/inventory"],
  ["Fornecedores", "/app/suppliers"],
  ["Assistente IA", "/app/assistant"],
  ["Automações (n8n)", "/automations"],
  ["Criação de Conteúdo", "/content-studio"],
  ["Landing Edit", "/app/landing-edit"],
  ["Configurações", "/app/settings"],
  ["Segurança", "/app/settings/security"],
  ["Plano e cobrança", "/app/settings/billing"],
];

interface Linha {
  modulo: string;
  rota: string;
  status: number | null;
  urlFinal: string;
  erroNaTela: boolean;
  errosConsole: number;
  guia: boolean;
  ok: boolean;
  obs?: string;
}

test.describe.configure({ mode: "serial" });
test.skip(!JOURNEY_ENABLED, "Escreve no banco de produção: rode com E2E_JOURNEY=1");

test("Parte A — landing, cadastro, trial, CRM, trial vencido, pedido de pagamento", async ({
  page,
}) => {
  // A jornada inteira leva alguns minutos mesmo contra o build de produção.
  test.setTimeout(20 * 60_000);
  page.setDefaultNavigationTimeout(120_000);
  page.setDefaultTimeout(30_000);

  const ident = newIdentity();
  const errors = collectErrors(page);
  const admin = adminClient();
  const resumo: string[] = [];
  const marca = (ok: boolean, texto: string) =>
    resumo.push(`${ok ? "OK    " : "FALHOU"}  ${texto}`);

  console.info(`\nConta de teste: ${ident.email}\n`);
  const tabela: Linha[] = [];
  /** Um passo que falha vira FALHOU no relatório sem abortar a jornada. */
  const tenta = async (texto: string, fn: () => Promise<boolean>) => {
    const ok = await fn().catch((e: unknown) => {
      resumo.push(`        ${texto}: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
      return false;
    });
    marca(ok, texto);
  };

  try {
    // ---------------------------------------------------------------- 1. landing
    await test.step("1. Landing /calc3d-pro", async () => {
      const res = await page.goto("/calc3d-pro");
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await snap(page, "landing-hero");

      // A calculadora reage: mudar o peso muda o preço sugerido.
      const calc = page.locator("#calculadora");
      await calc.scrollIntoViewIfNeeded();
      const painel = calc.locator("text=Preço sugerido").locator("..");
      const antes = await painel.innerText();
      const peso = calc.locator('input[type="number"]').first();
      await peso.fill("250");
      await page.waitForTimeout(300);
      const depois = await painel.innerText();
      marca(antes !== depois, "calculadora pública recalcula ao mudar o peso");
      await snap(page, "landing-calculadora");

      // Pagamento: QR, copia e cola e chave.
      const pagamento = page.locator("#comprar");
      await pagamento.scrollIntoViewIfNeeded();
      const temQr = await pagamento
        .locator('img[alt*="QR Code"]')
        .isVisible()
        .catch(() => false);
      const temCopiaECola = await pagamento
        .getByText(/Pix copia e cola/i)
        .first()
        .isVisible()
        .catch(() => false);
      const temChave = await pagamento
        .getByText("eb2082ad-a521-4ff7-9670-7760988d3126")
        .first()
        .isVisible()
        .catch(() => false);
      const temRecebedor = await pagamento
        .getByText(/Recebedor:/)
        .first()
        .isVisible()
        .catch(() => false);
      marca(temQr, "QR Code do Pix aparece na landing");
      marca(temCopiaECola, "copia e cola aparece na landing");
      marca(temChave, "chave Pix aparece na landing");
      marca(temRecebedor, "nome do recebedor aparece na landing");
      await snap(page, "landing-pagamento");
    });

    // -------------------------------------------------------------- 2. cadastro
    await test.step("2. Cadastro com trial", async () => {
      await page.goto("/criar-conta");
      await page.locator('input[name="display_name"]').fill(ident.displayName);
      await page.locator('input[name="email"]').fill(ident.email);
      await page.locator('input[name="password"]').fill(ident.password);
      await page.locator('input[type="checkbox"]').check();
      // A rota descarta envios em menos de 1,2 s como robô (e responde 201 falso).
      await page.waitForTimeout(1_600);
      await snap(page, "cadastro-preenchido");
      await page.getByRole("button", { name: /dias grátis/i }).click();

      await page.waitForURL(/\/app\/dashboard/, { timeout: 120_000 });
      await page.waitForLoadState("networkidle").catch(() => undefined);
      marca(true, "cadastro leva direto ao /app/dashboard");

      const mfa = await page
        .getByText(/autenticador|verificação em duas etapas|TOTP/i)
        .first()
        .isVisible()
        .catch(() => false);
      marca(!mfa, "trial NÃO exige MFA no primeiro acesso");
      const selo = await page
        .getByText("TRIAL · 7 dias")
        .isVisible()
        .catch(() => false);
      marca(selo, "selo da sidebar mostra TRIAL · 7 dias");
      const cadeados = await page.locator('[data-locked="true"]').count();
      marca(cadeados === 0, `nenhum cadeado durante o trial (achados: ${cadeados})`);
      await snap(page, "trial-dashboard");

      // Organização criada para este usuário.
      const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const user = users?.users.find((u) => u.email?.toLowerCase() === ident.email.toLowerCase());
      expect(user, "usuário criado no Auth").toBeTruthy();
      const { data: mem } = await admin
        .from("user_organizations")
        .select("organization_id, role, organizations(plan, trial_ends_at, onboarded_at)")
        .eq("user_id", user!.id)
        .is("revoked_at", null);
      expect(mem?.length, "exatamente uma organização").toBe(1);
      ident.organizationId = mem![0]!.organization_id as string;
      const org = mem![0]!.organizations as unknown as {
        plan: string;
        trial_ends_at: string;
        onboarded_at: string;
      };
      marca(mem![0]!.role === "admin", "membership com papel admin");
      marca(org.plan === "standard" && !!org.trial_ends_at, "org nasce standard + trial_ends_at");
      marca(!!org.onboarded_at, "org nasce com onboarding concluído (sem wizard)");
      saveState(ident);
    });

    // ------------------------------------------------------------- 2b. guias
    await test.step("2b. Guias de cada tela", async () => {
      // Primeira entrada no CRM: o guia de boas-vindas abre sozinho.
      const boasVindas = page.getByRole("dialog").filter({ hasText: "Boas-vindas ao CRM" });
      const abriu = await boasVindas
        .waitFor({ timeout: 8_000 })
        .then(() => true)
        .catch(() => false);
      marca(abriu, "guia de boas-vindas abre sozinho na primeira entrada");
      await snap(page, "guia-boas-vindas");
      await fecharGuia(page, 1_000);

      // Primeira visita a Projetos: o guia da tela abre sozinho.
      await page.goto("/app/projects");
      const guiaProjetos = page.getByRole("dialog").filter({ hasText: "Projetos" });
      const abriuProjetos = await guiaProjetos
        .waitFor({ timeout: 8_000 })
        .then(() => true)
        .catch(() => false);
      marca(abriuProjetos, "guia de Projetos abre sozinho na primeira visita");
      await snap(page, "guia-projetos");
      await fecharGuia(page, 1_000);

      // Já visto: recarregar não reabre.
      await page.reload();
      const reabriu = await fecharGuia(page, 2_500);
      marca(!reabriu, "guia já visto NÃO reabre ao recarregar");

      // Botão da barra superior reabre.
      await page.getByRole("button", { name: /Guia desta tela/ }).click();
      const peloBotao = await guiaProjetos
        .waitFor({ timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      marca(peloBotao, "botão 'Guia desta tela' reabre o guia");
      await fecharGuia(page, 1_000);
    });

    // ------------------------------------------------------ 3. varredura do CRM
    await test.step("3. Varredura de todos os módulos (trial ativo)", async () => {
      for (const [modulo, rota] of MODULOS) {
        const antes = errors.length;
        let status: number | null = null;
        let obs: string | undefined;
        try {
          const res = await page.goto(rota);
          status = res?.status() ?? null;
          await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
        } catch (e) {
          obs = e instanceof Error ? e.message.split("\n")[0] : String(e);
        }
        const guia = await fecharGuia(page);
        const urlFinal = new URL(page.url()).pathname;
        const erroNaTela = await hasErrorScreen(page);
        const errosConsole = errors.length - antes;
        // Com trial ativo, nada pode redirecionar para a cobrança.
        const desviou =
          urlFinal.startsWith("/app/settings/billing") && rota !== "/app/settings/billing";
        if (desviou) obs = "redirecionou para cobrança durante o trial";
        const ok =
          status !== null &&
          status < 400 &&
          !erroNaTela &&
          !desviou &&
          !obs?.startsWith("page.goto");
        tabela.push({ modulo, rota, status, urlFinal, erroNaTela, errosConsole, guia, ok, obs });
        await snap(page, `modulo-${rota.replace(/\//g, "_").replace(/^_/, "")}`);
      }
      const falhas = tabela.filter((l) => !l.ok).length;
      marca(
        falhas === 0,
        `varredura do CRM: ${tabela.length - falhas}/${tabela.length} módulos abriram sem erro`,
      );
    });

    // -------------------------------------------- 4. calculadora autenticada
    await test.step("4. Calculadora dentro do CRM", async () => {
      await page.goto("/app/calculator");
      await fecharGuia(page, 1_000);
      await page.locator("#pesoPeca").waitFor();
      const corpo = page.locator("main");
      const antes = await corpo.innerText();
      await page.locator("#pesoPeca").fill("300");
      await page.locator("#tempoImpressao").fill("9");
      await page.waitForTimeout(400);
      const depois = await corpo.innerText();
      marca(antes !== depois, "calculadora do CRM recalcula ao mudar peso e tempo");
      await snap(page, "crm-calculadora");
    });

    // ------------------------------------------ 4b. cadastros que ficam salvos
    const carimbo = String(Date.now()).slice(-6);
    const nomes = {
      org: `Oficina Salva ${carimbo}`,
      projeto: `Projeto E2E ${carimbo}`,
      fornecedor: `Fornecedor E2E ${carimbo}`,
      ativo: `Ativo E2E ${carimbo}`,
      contato: `Contato E2E ${carimbo}`,
    };
    await test.step("4b. Cadastrar em cada módulo e conferir que ficou salvo", async () => {
      const orgId = ident.organizationId!;

      await tenta(
        "Organização: nome salvo de verdade no banco (antes salvava 0 linhas)",
        async () => {
          await page.goto("/app/settings/tenant");
          await fecharGuia(page, 1_500);
          await page.locator("#display_name").fill(nomes.org);
          await page.getByRole("button", { name: /^Salvar$/ }).click();
          await page.waitForTimeout(2_500);
          const { data } = await admin
            .from("organizations")
            .select("display_name")
            .eq("id", orgId)
            .single();
          return data?.display_name === nomes.org;
        },
      );

      await tenta("Projetos: cria e continua na lista depois de recarregar", async () => {
        await page.goto("/app/projects");
        await fecharGuia(page, 1_000);
        await page.getByRole("button", { name: /Novo Projeto Técnico/ }).click();
        await page.getByPlaceholder("Ex: Foguete TVC Estágio 1").fill(nomes.projeto);
        await page.getByRole("button", { name: /^Criar projeto$/ }).click();
        await page.waitForTimeout(2_000);
        await page.reload();
        await fecharGuia(page, 1_000);
        return page.getByText(nomes.projeto).first().isVisible();
      });

      await tenta("Fornecedores: cria e continua na lista depois de recarregar", async () => {
        await page.goto("/app/suppliers");
        await fecharGuia(page, 1_000);
        await page
          .getByRole("button", { name: /Novo Fornecedor/ })
          .first()
          .click();
        await page.getByPlaceholder("Ex: eSun Distribuidora").fill(nomes.fornecedor);
        await page.getByRole("button", { name: /^Cadastrar$/ }).click();
        await page.waitForTimeout(2_000);
        await page.reload();
        await fecharGuia(page, 1_000);
        return page.getByText(nomes.fornecedor).first().isVisible();
      });

      await tenta("Inventário: cria e continua na lista depois de recarregar", async () => {
        await page.goto("/app/inventory");
        await fecharGuia(page, 1_000);
        await page
          .getByRole("button", { name: /Novo ativo/ })
          .first()
          .click();
        await page.locator("#inv-name").fill(nomes.ativo);
        await page.getByRole("button", { name: /^Cadastrar$/ }).click();
        await page.waitForTimeout(2_000);
        await page.reload();
        await fecharGuia(page, 1_000);
        return page.getByText(nomes.ativo).first().isVisible();
      });

      await tenta("Contatos: cria pela API do CRM e aparece na lista", async () => {
        const res = await page.request.post("/api/v1/contacts", {
          data: { display_name: nomes.contato },
        });
        if (res.status() !== 201 && res.status() !== 200)
          throw new Error(`POST /api/v1/contacts -> ${res.status()}`);
        await page.goto("/app/contacts");
        await fecharGuia(page, 1_000);
        await page.waitForLoadState("networkidle").catch(() => undefined);
        return page.getByText(nomes.contato).first().isVisible();
      });
      await snap(page, "cadastros-contatos");

      await tenta(
        "Projetos: editar um projeto e a alteração continua depois de recarregar",
        async () => {
          await page.goto("/app/projects");
          await fecharGuia(page, 1_000);
          await page.getByRole("button", { name: `Editar projeto ${nomes.projeto}` }).click();
          const campo = page.getByPlaceholder("Ex: Foguete TVC Estágio 1");
          await campo.fill(`${nomes.projeto} editado`);
          await page.getByRole("button", { name: /^Salvar alterações$/ }).click();
          await page.waitForTimeout(2_000);
          await page.reload();
          await fecharGuia(page, 1_000);
          return page.getByText(`${nomes.projeto} editado`).first().isVisible();
        },
      );

      await tenta("Contatos: contato sem histórico é excluído pela tela", async () => {
        const { data: c } = await admin
          .from("contacts")
          .select("id")
          .eq("organization_id", orgId)
          .eq("display_name", nomes.contato)
          .single();
        if (!c) throw new Error("contato não encontrado no banco");
        await page.goto(`/app/contacts/${c.id as string}`);
        await fecharGuia(page, 1_000);
        await page
          .getByRole("button", { name: /^Excluir contato$/ })
          .first()
          .click();
        await page
          .getByRole("alertdialog")
          .getByRole("button", { name: /^Excluir contato$/ })
          .click();
        await page.waitForURL(/\/app\/contacts$/, { timeout: 20_000 });
        const { data: ainda } = await admin
          .from("contacts")
          .select("id")
          .eq("id", c.id as string);
        return (ainda ?? []).length === 0;
      });

      await tenta(
        "Contatos: contato com O.S. ligada é bloqueado (409) em vez de apagar histórico",
        async () => {
          const res = await page.request.post("/api/v1/contacts", {
            data: { display_name: `${nomes.contato} com OS` },
          });
          const body = (await res.json()) as { data?: { contact?: { id?: string } } };
          const contactId = body.data?.contact?.id;
          if (!contactId) throw new Error(`POST contato -> ${res.status()}`);
          const { error: osErr } = await admin.from("service_orders").insert({
            organization_id: orgId,
            title: "OS de teste",
            contact_id: contactId,
            contact_name: `${nomes.contato} com OS`,
            status: "aprovado",
            total_cents: 1000,
            qty: 1,
          });
          if (osErr) throw new Error(`OS de teste: ${osErr.message}`);
          const del = await page.request.delete(`/api/v1/contacts/${contactId}`);
          const delBody = (await del.json().catch(() => ({}))) as { error?: { code?: string } };
          const { data: ainda } = await admin.from("contacts").select("id").eq("id", contactId);
          return (
            del.status() === 409 &&
            delBody.error?.code === "contact_has_history" &&
            (ainda ?? []).length === 1
          );
        },
      );
    });

    // -------------------------------------- 4c. isolamento entre dois clientes
    await test.step("4c. Um segundo cliente não enxerga nada do primeiro", async () => {
      const orgA = ident.organizationId!;
      const emailB = ident.email.replace("+teste-", "+teste-b-");
      const senhaB = `${ident.password}-b`;
      await tenta("segundo cliente (outra organização) criado", async () => {
        const { data: u, error } = await admin.auth.admin.createUser({
          email: emailB,
          password: senhaB,
          email_confirm: true,
        });
        if (error || !u.user) throw new Error(error?.message ?? "sem usuário");
        const { data: org, error: oErr } = await admin
          .from("organizations")
          .insert({
            slug: `isolamento-${carimbo}`,
            legal_name: "Isolamento",
            display_name: "Isolamento",
          })
          .select("id")
          .single();
        if (oErr || !org) throw new Error(oErr?.message ?? "sem org");
        const { error: mErr } = await admin
          .from("user_organizations")
          .insert({ user_id: u.user.id, organization_id: org.id, role: "admin" });
        if (mErr) throw new Error(mErr.message);
        return true;
      });

      const b = anonClient();
      const { error: loginErr } = await b.auth.signInWithPassword({
        email: emailB,
        password: senhaB,
      });
      marca(!loginErr, "segundo cliente entra com a própria senha");
      for (const [tabelaDb, coluna] of [
        ["projects", "name"],
        ["suppliers", "name"],
        ["inventory_assets", "name"],
        ["contacts", "display_name"],
      ] as const) {
        const { data, error } = await b
          .from(tabelaDb)
          .select(`id, ${coluna}`)
          .eq("organization_id", orgA);
        marca(
          !error && (data ?? []).length === 0,
          `${tabelaDb}: o segundo cliente vê 0 registros do primeiro`,
        );
      }
      const { data: orgs } = await b.from("organizations").select("id").eq("id", orgA);
      marca(
        (orgs ?? []).length === 0,
        "organizations: o segundo cliente não lê a organização do primeiro",
      );
      const { data: ev, error: evErr } = await b.rpc("emit_event", {
        p_event_type: "isolation.cross",
        p_entity_kind: "test",
        p_entity_id: null,
        p_payload: {},
        p_metadata: {},
        p_organization_id: orgA,
      });
      marca(
        !!evErr && !ev,
        `emit_event na fila do primeiro é recusado (exige a migration 0083${evErr ? `: ${evErr.code}` : " — ACEITOU"})`,
      );
    });

    // ----------------------------------------------------- 5. trial vencido
    await test.step("5. Trial vencido", async () => {
      const ontem = new Date(Date.now() - 86_400_000).toISOString();
      const { error } = await admin
        .from("organizations")
        .update({ trial_ends_at: ontem })
        .eq("id", ident.organizationId!);
      expect(error).toBeNull();

      await page.goto("/app/dashboard");
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const faixa = await page
        .getByText(/acesso PRO pausou/i)
        .isVisible()
        .catch(() => false);
      marca(faixa, "faixa vermelha de trial vencido aparece");
      const selo = await page
        .getByText("GRÁTIS")
        .first()
        .isVisible()
        .catch(() => false);
      marca(selo, "selo da sidebar muda para GRÁTIS");
      const cadeados = await page.locator('[data-locked="true"]').count();
      marca(cadeados > 0, `cadeados aparecem na sidebar (achados: ${cadeados})`);
      await snap(page, "vencido-dashboard");

      await page.goto("/app/sales");
      await page.waitForURL(/\/app\/settings\/billing/, { timeout: 60_000 }).catch(() => undefined);
      const foiParaCobranca = new URL(page.url()).pathname === "/app/settings/billing";
      marca(foiParaCobranca, "/app/sales redireciona para a cobrança");
      const disseVendas = await page
        .getByText(/Você tentou abrir/)
        .isVisible()
        .catch(() => false);
      marca(disseVendas, "a cobrança diz qual módulo foi bloqueado");
      await snap(page, "vencido-redirect-vendas");

      await tenta("com o trial vencido, a API recusa gravação (403 plan_required)", async () => {
        const res = await page.request.post("/api/v1/contacts", {
          data: { display_name: "Não deveria gravar" },
        });
        const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
        return res.status() === 403 && body.error?.code === "plan_required";
      });

      for (const rota of ["/app/dashboard", "/app/calculator", "/app/settings"]) {
        await page.goto(rota);
        const livre = new URL(page.url()).pathname === rota && !(await hasErrorScreen(page));
        marca(livre, `${rota} continua livre com o trial vencido`);
      }
    });

    // ------------------------------------------------- 6. pedido de pagamento
    await test.step("6. Pedido de pagamento dentro do CRM", async () => {
      await page.goto("/app/settings/billing");
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await fecharGuia(page, 1_000);
      const temQr = await page
        .locator('img[alt*="QR Code"]')
        .isVisible()
        .catch(() => false);
      const temCopiaECola = await page
        .getByText(/Pix copia e cola/i)
        .first()
        .isVisible()
        .catch(() => false);
      marca(temQr, "QR Code aparece na cobrança do CRM");
      marca(temCopiaECola, "copia e cola aparece na cobrança do CRM");
      await snap(page, "cobranca-antes");

      await page.locator("#buyer_name").fill("Cliente de Teste");
      await page.locator("#buyer_phone").fill("(31) 99928-4834");
      await page.locator("#pix_txid").fill("E2E-TESTE");
      await page.getByRole("button", { name: /já paguei/i }).click();
      const confirmou = await page
        .getByText(/Pedido registrado/i)
        .first()
        .waitFor({ timeout: 30_000 })
        .then(() => true)
        .catch(() => false);
      marca(confirmou, "confirmação aparece depois de enviar o pedido");
      await snap(page, "cobranca-enviado");

      const { data: pedidos } = await admin
        .from("pro_signup_requests")
        .select("id, status, organization_id, amount_cents")
        .eq("buyer_email", ident.email);
      const pedido = pedidos?.[0];
      marca(pedidos?.length === 1, "exatamente um pedido gravado");
      marca(
        pedido?.organization_id === ident.organizationId,
        "pedido já vem amarrado à org do trial (vai ser UPGRADE)",
      );
      marca(
        pedido?.amount_cents === 8900,
        `valor do pedido é R$ 89,00 (gravado: ${pedido?.amount_cents})`,
      );
      marca(pedido?.status === "pending", "pedido pendente, aguardando aprovação");
    });
  } finally {
    // ------------------------------------------------------------- relatório
    const linhasTabela = tabela.map(
      (l) =>
        `${l.ok ? "OK    " : "FALHOU"}  ${l.modulo.padEnd(26)} ${String(l.status ?? "-").padEnd(4)} ${
          l.urlFinal === l.rota ? "" : `-> ${l.urlFinal} `
        }${l.guia ? "[guia abriu] " : "[sem guia] "}${l.erroNaTela ? "[tela de erro] " : ""}${l.errosConsole ? `[${l.errosConsole} erro(s) de console] ` : ""}${l.obs ?? ""}`,
    );
    const relatorio = [
      `Conta de teste: ${ident.email}`,
      `Organização:    ${ident.organizationId}`,
      "",
      "=== JORNADA ===",
      ...resumo,
      "",
      "=== MÓDULOS (trial ativo) ===",
      ...linhasTabela,
      "",
      `Erros de console no total: ${errors.length}`,
      ...errors.slice(0, 40).map((e) => `  - ${e.slice(0, 220)}`),
    ].join("\n");

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(path.join(OUT_DIR, "relatorio.txt"), relatorio);
    console.info("\n" + relatorio + "\n");
  }
});
