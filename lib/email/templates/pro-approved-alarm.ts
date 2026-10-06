/**
 * Alarme ao dono: um pedido do Calc3D PRO foi decidido pelo link de 1 clique do
 * e-mail (sem login). É a contrapartida de segurança daquele atalho — se o
 * e-mail vazou ou alguém encaminhou a mensagem, o dono descobre na hora e tem o
 * link para desfazer no painel de Assinantes.
 */
import { escapeHtml } from "@/lib/email/escape";

export interface ProApprovedAlarmOptions {
  action: "approve" | "reject";
  buyerName: string;
  buyerEmail: string;
  decidedAt: Date;
  /** Org que recebeu o PRO (só na aprovação). */
  orgName?: string | null;
  /** /admin/assinantes/<orgId> na aprovação; /admin/pro-signups/<id> na recusa. */
  undoUrl: string;
  ip?: string | null;
}

export function buildProApprovedAlarmEmail(opts: ProApprovedAlarmOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const hhmm = opts.decidedAt.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = opts.decidedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const who = opts.buyerName.trim() || opts.buyerEmail;
  const verb = opts.action === "approve" ? "aprovado" : "recusado";
  const subject = `Pedido de ${who} ${verb} pelo link do e-mail`;

  const headline = `Pedido de ${who} ${verb} pelo link do e-mail às ${hhmm} (${date}, horário de Brasília).`;
  const undoLabel =
    opts.action === "approve" ? "Não foi você? Remova o plano aqui" : "Não foi você? Abra o pedido aqui";
  const details = [
    `Comprador: ${opts.buyerName} <${opts.buyerEmail}>`,
    opts.orgName ? `Organização: ${opts.orgName}` : null,
    opts.ip ? `IP de quem clicou: ${opts.ip}` : null,
  ].filter((l): l is string => l !== null);

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f5f5f4;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1c1917">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:18px;line-height:1.4;margin:0 0 12px;color:#0c0a09">${escapeHtml(headline)}</h1>
    <ul style="margin:0 0 16px;padding-left:18px;font-size:14px;color:#57534e">
      ${details.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}
    </ul>
    <p style="margin:24px 0">
      <a href="${escapeHtml(opts.undoUrl)}"
         style="display:inline-block;background:#9f1239;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold">
        ${escapeHtml(undoLabel)}
      </a>
    </p>
    <p style="margin:0;font-size:12px;color:#a8a29e">
      Este aviso sai a cada uso dos botões de 1 clique. Para desligá-los, remova
      PRO_APPROVAL_TOKEN_SECRET do ambiente.
    </p>
  </div>
</body>
</html>`;

  const text = [headline, "", ...details, "", `${undoLabel}: ${opts.undoUrl}`].join("\n");
  return { subject, html, text };
}
