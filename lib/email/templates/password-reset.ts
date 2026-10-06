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
  const subject = "Redefinir sua senha — GLTech3D";

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f5f5f4;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1c1917">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:20px;line-height:1.3;margin:0 0 8px;color:#0c0a09">Redefinir sua senha</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#57534e">
      Alguém pediu a redefinição da senha desta conta. Se não foi você, ignore este e-mail —
      nada muda sem clicar no botão abaixo.
    </p>
    <p style="margin:24px 0">
      <a href="${escapeHtml(opts.resetUrl)}"
         style="display:inline-block;background:#8E6D4D;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold">
        Criar uma senha nova
      </a>
    </p>
    <p style="margin:0 0 16px;font-size:13px;color:#78716c">
      O link vale até ${escapeHtml(expira)} e só pode ser usado uma vez.
    </p>
    <p style="margin:0;font-size:12px;color:#a8a29e;word-break:break-all">
      Se o botão não funcionar, copie e cole: ${escapeHtml(opts.resetUrl)}
    </p>
  </div>
</body>
</html>`;

  const text = [
    "Redefinir sua senha",
    "",
    "Alguém pediu a redefinição da senha desta conta. Se não foi você, ignore este e-mail.",
    "",
    opts.resetUrl,
    "",
    `O link vale até ${expira}.`,
  ].join("\n");

  return { subject, html, text };
}
