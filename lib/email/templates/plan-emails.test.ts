import { describe, it, expect } from "vitest";

import { buildProSignupNotifyEmail } from "./pro-signup-notify";
import { buildPlanChangedEmail } from "./plan-changed";
import { buildProApprovedAlarmEmail } from "./pro-approved-alarm";

const BASE_NOTIFY = {
  requestId: "req-1",
  planLabel: "Calc3D PRO — Anual",
  amountFormatted: "R$ 197,00",
  buyerName: "Maria <script>",
  buyerEmail: "maria@example.com",
  hasReceipt: true,
  declaredPaidAt: new Date("2026-10-06T12:00:00.000Z"),
  reviewUrl: "https://x.test/admin/pro-signups/req-1",
};

describe("pro-signup-notify", () => {
  it("sem segredo: só o link do painel, sem botões de 1 clique", () => {
    const mail = buildProSignupNotifyEmail(BASE_NOTIFY);
    expect(mail.html).toContain("Abrir o pedido e liberar");
    expect(mail.html).not.toContain("Aprovar e liberar");
    expect(mail.html).not.toContain("<script>");
  });

  it("com segredo: botões Aprovar/Recusar + link do painel", () => {
    const mail = buildProSignupNotifyEmail({
      ...BASE_NOTIFY,
      approveUrl: "https://x.test/aprovar/a.b",
      rejectUrl: "https://x.test/aprovar/c.d",
    });
    expect(mail.html).toContain("Aprovar e liberar");
    expect(mail.html).toContain("https://x.test/aprovar/a.b");
    expect(mail.html).toContain("Recusar");
    expect(mail.html).toContain("Abrir no painel");
    expect(mail.text).toContain("https://x.test/aprovar/c.d");
  });
});

describe("plan-changed", () => {
  it("escapa o nome da org e informa o vencimento", () => {
    const mail = buildPlanChangedEmail({
      kind: "extend",
      orgName: "Acme & <b>Co</b>",
      planLabel: "Calc3D PRO",
      expiresAt: new Date("2027-01-10T15:00:00.000Z"),
      hasProAccess: true,
      appUrl: "https://x.test/app/dashboard",
    });
    expect(mail.html).toContain("Acme &amp; &lt;b&gt;Co&lt;/b&gt;");
    expect(mail.text).toContain("10/01/2027");
  });

  it("revoke não promete validade", () => {
    const mail = buildPlanChangedEmail({
      kind: "revoke",
      orgName: "Acme",
      planLabel: "Gratuito",
      expiresAt: null,
      hasProAccess: false,
      appUrl: "https://x.test/app/dashboard",
    });
    expect(mail.subject).toContain("encerrado");
    expect(mail.text).not.toContain("vale até");
  });
});

describe("pro-approved-alarm", () => {
  it("diz quando foi (horário de Brasília) e traz o link para desfazer", () => {
    const mail = buildProApprovedAlarmEmail({
      action: "approve",
      buyerName: "Maria",
      buyerEmail: "maria@example.com",
      decidedAt: new Date("2026-10-06T15:30:00.000Z"),
      orgName: "Acme",
      undoUrl: "https://x.test/admin/assinantes/org-1",
      ip: "1.2.3.4",
    });
    expect(mail.subject).toBe("Pedido de Maria aprovado pelo link do e-mail");
    expect(mail.text).toContain("12:30");
    expect(mail.text).toContain("Não foi você? Remova o plano aqui: https://x.test/admin/assinantes/org-1");
  });
});
