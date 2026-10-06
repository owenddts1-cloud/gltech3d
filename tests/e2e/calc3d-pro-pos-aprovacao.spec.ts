/**
 * Jornada do Calc3D PRO — PARTE B: depois da aprovação manual no painel.
 *
 *   E2E_JOURNEY=1 npx playwright test tests/e2e/calc3d-pro-pos-aprovacao.spec.ts
 *
 * Pré-requisito: Parte A rodada e o pedido aprovado à mão em /admin/pro-signups.
 */
import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  JOURNEY_ENABLED,
  OUT_DIR,
  adminClient,
  loadState,
  login,
  snap,
} from "./_jornada/helpers";

test.skip(!JOURNEY_ENABLED, "Escreve no banco de produção: rode com E2E_JOURNEY=1");

test("Parte B — liberação virou UPGRADE e o plano pago exige MFA", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  page.setDefaultNavigationTimeout(120_000);

  const ident = loadState();
  const admin = adminClient();
  const resumo: string[] = [];
  const marca = (ok: boolean, texto: string) => resumo.push(`${ok ? "OK    " : "FALHOU"}  ${texto}`);

  await test.step("1. Banco depois da aprovação", async () => {
    const { data: pedidos } = await admin
      .from("pro_signup_requests")
      .select("status, organization_id")
      .eq("buyer_email", ident.email);
    const pedido = pedidos?.[0];
    expect(pedido, "pedido existe").toBeTruthy();
    expect(pedido!.status, "aprove o pedido em /admin/pro-signups antes da Parte B").toBe("approved");
    marca(true, "pedido aprovado");
    marca(pedido!.organization_id === ident.organizationId, "aprovação apontou para a org do trial");

    const { data: org } = await admin
      .from("organizations")
      .select("plan, plan_expires_at, trial_ends_at")
      .eq("id", ident.organizationId!)
      .single();
    marca(org?.plan === "pro", `plano virou pro (está: ${org?.plan})`);
    const dias = org?.plan_expires_at
      ? Math.round((Date.parse(org.plan_expires_at as string) - Date.now()) / 86_400_000)
      : null;
    marca(dias !== null && dias >= 364 && dias <= 366, `vale por ~365 dias (calculado: ${dias})`);
    marca(!!org?.trial_ends_at, "trial_ends_at preservado como histórico");

    // A prova de que não houve org duplicada: o usuário continua em UMA só.
    const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = users?.users.find((u) => u.email?.toLowerCase() === ident.email.toLowerCase());
    const { data: mem } = await admin
      .from("user_organizations")
      .select("organization_id")
      .eq("user_id", user!.id)
      .is("revoked_at", null);
    marca(mem?.length === 1, `uma única organização para o cliente (achadas: ${mem?.length})`);
  });

  await test.step("2. Login do cliente com plano pago", async () => {
    await login(page, ident.email, ident.password);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(1_500);
    // Plano pago => TOTP obrigatório. O overlay de configuração deve aparecer.
    const pedeMfa = await page
      .getByText(/autenticador|verificação em duas etapas|TOTP|MFA/i)
      .first()
      .isVisible()
      .catch(() => false);
    marca(pedeMfa, "com plano pago, o login pede configuração de MFA");
    await snap(page, "pos-aprovacao-login");
  });

  const relatorio = [`Conta de teste: ${ident.email}`, "", "=== PÓS-APROVAÇÃO ===", ...resumo].join("\n");
  writeFileSync(path.join(OUT_DIR, "relatorio-parte-b.txt"), relatorio);
  console.info("\n" + relatorio + "\n");
});
