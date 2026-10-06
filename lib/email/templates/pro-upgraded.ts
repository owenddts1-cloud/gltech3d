/**
 * Confirmação ao comprador que JÁ TINHA conta (veio do trial, ou renovou).
 *
 * Deliberadamente diferente de `pro-activation.ts`: aquele manda "crie sua
 * senha", o que para quem já tem senha é confuso — e, pior, transformaria o
 * console de admin num vetor de redefinição de senha de terceiros.
 */
import { escapeHtml } from "@/lib/email/escape";

export interface ProUpgradedOptions {
  buyerName: string;
  orgName: string;
  /** null = unlimited plan (no expiry). */
  planExpiresAt: Date | null;
  appUrl: string;
}

export function buildProUpgradedEmail(opts: ProUpgradedOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const first = opts.buyerName.trim().split(/\s+/)[0] || "";
  const ate = opts.planExpiresAt
    ? opts.planExpiresAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : null;
  const subject = "Calc3D PRO liberado";

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f5f5f4;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1c1917">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:20px;line-height:1.3;margin:0 0 8px;color:#0c0a09">
      ${first ? `${escapeHtml(first)}, seu` : "Seu"} Calc3D PRO está liberado
    </h1>
    <p style="margin:0 0 16px;font-size:14px;color:#57534e">
      Confirmamos seu Pix. Os módulos de <strong>${escapeHtml(opts.orgName)}</strong> já estão
      destravados — é só entrar com a senha que você já usa.
    </p>
    <p style="margin:24px 0">
      <a href="${escapeHtml(opts.appUrl)}"
         style="display:inline-block;background:#8E6D4D;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold">
        Abrir o CRM
      </a>
    </p>
    <p style="margin:0 0 16px;font-size:13px;color:#78716c">
      ${ate ? `Seu acesso vale até <strong>${escapeHtml(ate)}</strong>.` : "Seu acesso não tem data de vencimento."}
    </p>
    <p style="margin:0;font-size:12px;color:#a8a29e">
      No próximo login vamos pedir a configuração de um aplicativo autenticador (código de 6
      dígitos). É obrigatório em contas pagas e leva um minuto.
    </p>
  </div>
</body>
</html>`;

  const text = [
    `${first ? `${first}, seu` : "Seu"} Calc3D PRO está liberado.`,
    "",
    `Os módulos de ${opts.orgName} já estão destravados — entre com a senha que você já usa:`,
    opts.appUrl,
    "",
    ate ? `Seu acesso vale até ${ate}.` : "Seu acesso não tem data de vencimento.",
    "",
    "No próximo login vamos pedir a configuração de um aplicativo autenticador (código de 6 dígitos).",
  ].join("\n");

  return { subject, html, text };
}
