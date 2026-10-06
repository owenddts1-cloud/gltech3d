/**
 * Aviso ao dono: alguém começou um trial do Calc3D PRO.
 *
 * Não vai para o cliente — é o sinal de que o funil está vivo. Sem isto o
 * cadastro é silencioso e só se descobre que houve interesse indo ao banco.
 */
import { escapeHtml } from "@/lib/email/escape";

export interface TrialStartedOptions {
  displayName: string;
  email: string;
  trialEndsAt: Date;
  trialDays: number;
}

export function buildTrialStartedEmail(opts: TrialStartedOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const ate = opts.trialEndsAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const subject = `Novo trial no Calc3D PRO: ${opts.displayName}`;

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f5f5f4;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1c1917">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:20px;line-height:1.3;margin:0 0 8px;color:#0c0a09">Novo trial começou</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#57534e">
      <strong>${escapeHtml(opts.displayName)}</strong> criou uma conta e tem ${opts.trialDays} dias de PRO.
    </p>
    <table style="border-collapse:collapse;background:#ffffff;border:1px solid #e7e5e4;border-radius:8px;width:100%">
      <tr>
        <td style="padding:6px 12px;font-size:13px;color:#78716c;white-space:nowrap">E-mail</td>
        <td style="padding:6px 12px;font-size:14px;color:#1c1917"><strong>${escapeHtml(opts.email)}</strong></td>
      </tr>
      <tr>
        <td style="padding:6px 12px;font-size:13px;color:#78716c;white-space:nowrap">Trial até</td>
        <td style="padding:6px 12px;font-size:14px;color:#1c1917"><strong>${escapeHtml(ate)}</strong></td>
      </tr>
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#78716c">
      Responda direto neste e-mail para falar com a pessoa.
    </p>
  </div>
</body>
</html>`;

  const text = [
    "Novo trial começou",
    "",
    `Operação: ${opts.displayName}`,
    `E-mail: ${opts.email}`,
    `Trial até: ${ate}`,
  ].join("\n");

  return { subject, html, text };
}
