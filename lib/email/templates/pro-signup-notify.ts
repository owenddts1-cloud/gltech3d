/**
 * Notificação ao dono: alguém declarou ter pago o Pix do Calc3D PRO e pede a
 * liberação do CRM. HTML inline, sem asset externo, no padrão de `lead-notify`.
 *
 * Dois modos:
 *  - Sem `PRO_APPROVAL_TOKEN_SECRET`: um botão só, para a tela de aprovação em
 *    /admin (sessão de platform admin com MFA).
 *  - Com o segredo (`approveUrl`/`rejectUrl` presentes): botões grandes
 *    "Aprovar e liberar" e "Recusar", em 1 clique e sem login — decisão do dono.
 *    O link abre /aprovar/<token>, que só mostra o resumo e um botão
 *    "Confirmar…"; a decisão sai no clique. Abrir não decide nada porque
 *    scanners de e-mail (Safe Links, Proofpoint, Mimecast) abrem links num
 *    navegador headless que executa JavaScript.
 *    O token é HMAC com segredo próprio, preso ao propósito, à ação, ao pedido e
 *    ao valor, vale 48h, só muda pedido `pending` e todo uso gera e-mail de
 *    alarme ao dono. Ver lib/pro-signup/email-action-token.ts.
 */
import { escapeHtml } from "@/lib/email/escape";

export interface ProSignupNotifyOptions {
  requestId: string;
  planLabel: string;
  amountFormatted: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string | null;
  companyName?: string | null;
  pixTxid?: string | null;
  hasReceipt: boolean;
  declaredPaidAt: Date;
  reviewUrl: string;
  /** Links de 1 clique. Ausentes quando o segredo não está configurado. */
  approveUrl?: string | null;
  rejectUrl?: string | null;
}

export function buildProSignupNotifyEmail(opts: ProSignupNotifyOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const when = opts.declaredPaidAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const subject = `Calc3D PRO — liberar acesso para ${opts.buyerName.trim() || opts.buyerEmail}`;

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:6px 12px;font-size:13px;color:#78716c;white-space:nowrap">${label}</td>
      <td style="padding:6px 12px;font-size:14px;color:#1c1917"><strong>${escapeHtml(value)}</strong></td>
    </tr>`;

  const oneClick = !!(opts.approveUrl && opts.rejectUrl);

  const panelOnlyHtml = `
    <p style="margin:24px 0 0">
      <a href="${escapeHtml(opts.reviewUrl)}"
         style="display:inline-block;background:#8E6D4D;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold">
        Abrir o pedido e liberar
      </a>
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#78716c">
      O link pede login de administrador da plataforma. A liberação em si é feita dentro do painel —
      abrir este e-mail não aprova nada sozinho.
    </p>`;

  const oneClickHtml = `
    <table role="presentation" style="border-collapse:collapse;width:100%;margin:24px 0 0">
      <tr>
        <td style="padding:0 6px 0 0;width:60%">
          <a href="${escapeHtml(opts.approveUrl ?? "")}"
             style="display:block;text-align:center;background:#8E6D4D;color:#ffffff;text-decoration:none;padding:16px 12px;border-radius:8px;font-size:16px;font-weight:bold">
            Aprovar e liberar
          </a>
        </td>
        <td style="padding:0 0 0 6px;width:40%">
          <a href="${escapeHtml(opts.rejectUrl ?? "")}"
             style="display:block;text-align:center;background:#ffffff;color:#9f1239;border:2px solid #9f1239;text-decoration:none;padding:14px 12px;border-radius:8px;font-size:16px;font-weight:bold">
            Recusar
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#78716c">
      Confira o Pix antes de clicar. Os botões funcionam sem login, valem 48 horas e só
      decidem pedidos ainda pendentes. Você recebe um e-mail de aviso a cada uso.
    </p>
    <p style="margin:12px 0 0;font-size:13px">
      <a href="${escapeHtml(opts.reviewUrl)}" style="color:#8E6D4D">Abrir no painel</a>
    </p>`;

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f5f5f4;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1c1917">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:20px;line-height:1.3;margin:0 0 8px;color:#0c0a09">Pedido de liberação do Calc3D PRO</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#57534e">
      Pagamento declarado pelo comprador em ${escapeHtml(when)}. Confira o Pix na sua conta antes de aprovar.
    </p>
    <table style="border-collapse:collapse;background:#ffffff;border:1px solid #e7e5e4;border-radius:8px;width:100%">
      ${row("Plano", `${opts.planLabel} — ${opts.amountFormatted}`)}
      ${row("Nome", opts.buyerName)}
      ${row("E-mail", opts.buyerEmail)}
      ${opts.buyerPhone ? row("WhatsApp", opts.buyerPhone) : ""}
      ${opts.companyName ? row("Empresa", opts.companyName) : ""}
      ${opts.pixTxid ? row("Código do Pix", opts.pixTxid) : ""}
      ${row("Comprovante anexado", opts.hasReceipt ? "Sim" : "Não")}
    </table>
${oneClick ? oneClickHtml : panelOnlyHtml}
    <p style="margin:12px 0 0;font-size:12px;color:#a8a29e">Pedido ${escapeHtml(opts.requestId)}</p>
  </div>
</body>
</html>`;

  const text = [
    "Pedido de liberação do Calc3D PRO",
    "",
    `Plano: ${opts.planLabel} — ${opts.amountFormatted}`,
    `Nome: ${opts.buyerName}`,
    `E-mail: ${opts.buyerEmail}`,
    opts.buyerPhone ? `WhatsApp: ${opts.buyerPhone}` : null,
    opts.companyName ? `Empresa: ${opts.companyName}` : null,
    opts.pixTxid ? `Código do Pix: ${opts.pixTxid}` : null,
    `Comprovante anexado: ${opts.hasReceipt ? "Sim" : "Não"}`,
    `Pagamento declarado em: ${when}`,
    "",
    oneClick ? `Aprovar e liberar (sem login, vale 48h): ${opts.approveUrl}` : null,
    oneClick ? `Recusar: ${opts.rejectUrl}` : null,
    `Abrir o pedido no painel: ${opts.reviewUrl}`,
    `Pedido ${opts.requestId}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
