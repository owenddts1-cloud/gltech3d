/**
 * E-mail de ativação ao comprador, enviado quando o pedido do Calc3D PRO é
 * aprovado. O link abre a página onde ele define a própria senha — nunca
 * mandamos senha temporária: ela ficaria em texto puro numa caixa de entrada
 * para sempre, e não existe tela de troca de senha que force rotação.
 */
import { escapeHtml } from "@/lib/email/escape";

export interface ProActivationOptions {
  buyerName: string;
  orgName: string;
  activationUrl: string;
  expiresAt: Date;
}

export function buildProActivationEmail(opts: ProActivationOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const first = opts.buyerName.trim().split(/\s+/)[0] || "";
  const expires = opts.expiresAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const subject = "Seu Calc3D PRO está liberado — crie sua senha";

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f5f5f4;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1c1917">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:20px;line-height:1.3;margin:0 0 8px;color:#0c0a09">
      ${first ? `${escapeHtml(first)}, seu` : "Seu"} Calc3D PRO está liberado
    </h1>
    <p style="margin:0 0 16px;font-size:14px;color:#57534e">
      Confirmamos seu Pix e criamos o espaço <strong>${escapeHtml(opts.orgName)}</strong>.
      Falta só definir sua senha para entrar.
    </p>
    <p style="margin:24px 0">
      <a href="${escapeHtml(opts.activationUrl)}"
         style="display:inline-block;background:#8E6D4D;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold">
        Criar minha senha e entrar
      </a>
    </p>
    <p style="margin:0 0 16px;font-size:13px;color:#78716c">
      O link vale até ${escapeHtml(expires)}. Depois disso, peça um novo pelo WhatsApp.
    </p>
    <p style="margin:0;font-size:12px;color:#a8a29e;word-break:break-all">
      Se o botão não funcionar, copie e cole: ${escapeHtml(opts.activationUrl)}
    </p>
  </div>
</body>
</html>`;

  const text = [
    `${first ? `${first}, seu` : "Seu"} Calc3D PRO está liberado.`,
    "",
    `Criamos o espaço ${opts.orgName}. Defina sua senha para entrar:`,
    opts.activationUrl,
    "",
    `O link vale até ${expires}.`,
  ].join("\n");

  return { subject, html, text };
}
