/**
 * Internal notification email — sent to the GLTech3D directorate whenever a new
 * landing lead / quote request / newsletter signup comes in.
 * Includes technical sheet layout and 1-click direct WhatsApp button.
 */
import { escapeHtml } from "@/lib/email/escape";

export interface LeadNotifyOptions {
  type: "lead" | "newsletter";
  name?: string | null;
  email: string;
  phone?: string | null;
  projectType?: string | null;
  message?: string | null;
  attachmentUrl?: string | null;
  createdAt: Date;
}

export function buildLeadNotifyEmail(opts: LeadNotifyOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const isNewsletter = opts.type === "newsletter";
  const when = opts.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const projectLabel = opts.projectType?.trim() || "Impressão 3D sob demanda";
  const nameLabel = opts.name?.trim() || "Cliente Interessado";

  const subject = isNewsletter
    ? `[Nova Inscrição Newsletter] ${opts.email}`
    : `[Novo Lead Orçamento] ${nameLabel} — ${projectLabel}`;

  // Formatar link direto do WhatsApp (55 + DDD + dígitos)
  const phoneDigits = (opts.phone ?? "").replace(/\D/g, "");
  const waNumber = phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`;
  const waUrl = phoneDigits.length >= 10
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`Olá ${nameLabel}, recebemos sua solicitação de orçamento na GLTech3D sobre ${projectLabel}!`)}`
    : null;

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 14px;font-size:12px;color:#8E8276;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #2B2521;white-space:nowrap;width:140px">${label}</td>
      <td style="padding:10px 14px;font-size:14px;color:#FAF9F6;border-bottom:1px solid #2B2521"><strong>${escapeHtml(value)}</strong></td>
    </tr>`;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#12100E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#FAF9F6">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#12100E;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#1C1815;border:1px solid #332B25;border-radius:20px;overflow:hidden">
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#A6815C,#E0C4A0,#A6815C)"></td>
          </tr>
          <tr>
            <td style="padding:28px 32px 16px">
              <span style="font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:#A6815C">
                GLTECH3D CRM · Notificação da Diretoria
              </span>
              <h1 style="margin:8px 0 4px;font-size:22px;font-weight:900;color:#FAF9F6">
                ${isNewsletter ? "Nova Inscrição na Newsletter" : "Ficha Técnica: Novo Lead de Orçamento"}
              </h1>
              <p style="margin:0;font-size:13px;color:#9E948A">
                Registrado em ${when}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 24px">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#151210;border:1px solid #2B2521;border-radius:12px;overflow:hidden;margin-top:12px">
                ${opts.name ? row("Nome do Cliente", opts.name) : ""}
                ${row("E-mail", opts.email)}
                ${opts.phone ? row("Telefone / WhatsApp", opts.phone) : ""}
                ${opts.projectType ? row("Tipo de Projeto", opts.projectType) : ""}
                ${opts.message ? row("Mensagem / Detalhes", opts.message) : ""}
                ${opts.attachmentUrl ? row("Anexo / Arquivo 3D", opts.attachmentUrl) : ""}
                ${row("Origem", isNewsletter ? "Newsletter" : "Formulário de Orçamento da Home")}
              </table>

              ${waUrl ? `
                <div style="margin:24px 0 8px;text-align:center">
                  <a href="${waUrl}"
                     style="display:inline-block;background-color:#25D366;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:9999px;font-size:13px;font-weight:800;letter-spacing:0.02em;box-shadow:0 6px 20px rgba(37,211,102,0.25)">
                    💬 Chamar no WhatsApp em 1 Clique
                  </a>
                </div>
              ` : ""}

              <p style="margin:20px 0 0;font-size:12px;color:#6E665E;text-align:center">
                Dica: você também pode responder diretamente a esta mensagem para enviar um e-mail ao cliente.
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
    isNewsletter ? "NOVA INSCRIÇÃO NA NEWSLETTER" : "NOVO LEAD DE ORÇAMENTO — GLTECH3D",
    "=========================================",
    "",
    opts.name ? `Cliente: ${opts.name}` : null,
    `E-mail: ${opts.email}`,
    opts.phone ? `Telefone: ${opts.phone}` : null,
    waUrl ? `WhatsApp Direto: ${waUrl}` : null,
    opts.projectType ? `Tipo de Projeto: ${opts.projectType}` : null,
    opts.message ? `Mensagem: ${opts.message}` : null,
    opts.attachmentUrl ? `Anexo: ${opts.attachmentUrl}` : null,
    `Origem: ${isNewsletter ? "Newsletter" : "Formulário de Orçamento da Home"}`,
    `Recebido em: ${when}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
