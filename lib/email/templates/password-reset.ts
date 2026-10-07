import { escapeHtml } from "@/lib/email/escape";

export interface PasswordResetOptions {
  resetUrl: string;
  expiresAt: Date;
}

export function buildPasswordResetEmail(opts: PasswordResetOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const expira = opts.expiresAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const subject = "Redefinição de Senha — GLTech3D";

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#12100E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#FAF9F6">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#12100E;min-height:100vh;padding:40px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px;background-color:#1E1A17;border:1px solid #38302B;border-radius:24px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.5)">
          <!-- Top Accent Bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#A6815C,#E0C4A0,#A6815C)"></td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="padding:36px 36px 20px;text-align:center">
              <span style="display:inline-block;font-size:22px;font-weight:900;letter-spacing:0.05em;color:#FAF9F6">
                GLTECH<span style="color:#A6815C">3D</span>
              </span>
              <p style="margin:6px 0 0;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#A6815C">
                Manufatura Aditiva & Tecnologia
              </p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding:10px 36px 36px">
              <h1 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#FAF9F6;text-align:center">
                Redefinição de Senha
              </h1>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#C4BCB3;text-align:center">
                Recebemos uma solicitação para redefinir a senha de acesso à sua conta na GLTech3D. Se foi você, clique no botão seguro abaixo para criar sua nova credencial:
              </p>
              
              <div style="text-align:center;margin:32px 0">
                <a href="${escapeHtml(opts.resetUrl)}"
                   style="display:inline-block;background-color:#A6815C;color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:9999px;font-size:14px;font-weight:800;letter-spacing:0.02em;box-shadow:0 8px 24px rgba(166,129,92,0.3);border:1px solid rgba(255,255,255,0.15)">
                  Redefinir Minha Senha
                </a>
              </div>

              <div style="background-color:#171412;border:1px solid #2B2521;border-radius:12px;padding:16px;margin:24px 0 0">
                <p style="margin:0 0 8px;font-size:12px;color:#A6815C;font-weight:700">
                  ⚠️ Informações de Segurança:
                </p>
                <p style="margin:0;font-size:12px;line-height:1.5;color:#9E948A">
                  • Este link é de uso único e expira em <strong>1 hora</strong> (às ${escapeHtml(expira)}).<br>
                  • Se você não solicitou esta alteração, ignore este e-mail. Sua senha permanecerá inalterada.
                </p>
              </div>

              <p style="margin:24px 0 0;font-size:11px;line-height:1.5;color:#6E665E;word-break:break-all;text-align:center">
                Se o botão não responder, copie e cole o link a seguir no seu navegador:<br>
                <a href="${escapeHtml(opts.resetUrl)}" style="color:#A6815C;text-decoration:none">${escapeHtml(opts.resetUrl)}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 36px;background-color:#151210;border-top:1px solid #2B2521;text-align:center">
              <p style="margin:0;font-size:11px;color:#6E665E">
                © ${new Date().getFullYear()} GLTech3D · Todos os direitos reservados.<br>
                Segurança, Alta Precisão e Engenharia em Impressão 3D.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    "GLTech3D — Redefinição de Senha",
    "=====================================",
    "",
    "Recebemos uma solicitação para redefinir a senha da sua conta.",
    "",
    "Para criar uma nova senha com segurança, acesse o link abaixo:",
    opts.resetUrl,
    "",
    `Este link expira em 1 hora (às ${expira}) e só pode ser utilizado uma única vez.`,
    "",
    "Se você não solicitou esta alteração, ignore esta mensagem com segurança.",
    "",
    "© GLTech3D — Manufatura Aditiva & Engenharia",
  ].join("\n");

  return { subject, html, text };
}
