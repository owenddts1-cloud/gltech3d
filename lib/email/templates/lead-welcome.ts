import { STORE_WHATSAPP_FALLBACK, storeWhatsappUrl } from "@/lib/landing/whatsapp-number";
import { escapeHtml } from "@/lib/email/escape";

export interface LeadWelcomeOptions {
  name?: string | null;
  /** WhatsApp link for quick reply CTA (e.g. storeWhatsappUrl(getStoreWhatsapp())). */
  whatsappUrl?: string;
  projectType?: string | null;
}

export function buildLeadWelcomeEmail(opts: LeadWelcomeOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const firstName = (opts.name ?? "").trim().split(/\s+/)[0] || "";
  const hiHtml = firstName ? `Olá, ${escapeHtml(firstName)}!` : "Olá!";
  const hiText = firstName ? `Olá, ${firstName}!` : "Olá!";
  const wa = opts.whatsappUrl ?? storeWhatsappUrl(STORE_WHATSAPP_FALLBACK);
  const subject = "Recebemos sua solicitação de orçamento — GLTech3D";

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#12100E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#FAF9F6">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#12100E;padding:36px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#1E1A17;border:1px solid #38302B;border-radius:24px;overflow:hidden">
          <!-- Top Gradient -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#A6815C,#E0C4A0,#A6815C)"></td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="padding:32px 36px 16px;text-align:center">
              <span style="font-size:20px;font-weight:900;letter-spacing:0.05em;color:#FAF9F6">
                GLTECH<span style="color:#A6815C">3D</span>
              </span>
              <p style="margin:4px 0 0;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#A6815C">
                Impressão 3D de Alta Precisão & Engenharia
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:10px 36px 36px">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#FAF9F6">
                ${hiHtml}
              </h1>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#C4BCB3">
                Recebemos com sucesso sua solicitação de orçamento para <strong>${escapeHtml(opts.projectType || "seu projeto 3D")}</strong>.
              </p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#C4BCB3">
                Nossa equipe de engenharia e fatiamento técnico já está analisando suas informações para calcular o material ideal, parâmetros de resistência e melhor custo-benefício.
              </p>

              <div style="background-color:#161311;border:1px solid #2B2521;border-radius:12px;padding:16px;margin:24px 0">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#A6815C">
                  ⏱️ Tempo Estimado de Resposta:
                </p>
                <p style="margin:0;font-size:12px;line-height:1.5;color:#9E948A">
                  Respondemos orçamentos em <strong>até 2 horas úteis</strong> pelo WhatsApp ou e-mail com a ficha técnica e valores detalhados.
                </p>
              </div>

              <div style="text-align:center;margin:30px 0 16px">
                <a href="${wa}"
                   style="display:inline-block;background-color:#A6815C;color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:9999px;font-size:14px;font-weight:800;letter-spacing:0.02em;box-shadow:0 8px 24px rgba(166,129,92,0.3)">
                  Acompanhar ou Tirar Dúvidas pelo WhatsApp
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 36px;background-color:#151210;border-top:1px solid #2B2521;text-align:center">
              <p style="margin:0;font-size:11px;color:#6E665E">
                GLTech3D · Impressão 3D e Manufatura Aditiva · Belo Horizonte & Brasil<br>
                Instagram: @gltech3d · WhatsApp Oficial
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
    hiText,
    "",
    "Recebemos com sucesso sua solicitação de orçamento na GLTech3D.",
    "",
    "Nossa equipe de engenharia já está calculando os parâmetros técnicos de impressão para enviar sua proposta personalizada em até 2 horas úteis.",
    "",
    `Deseja agilizar o atendimento? Fale direto no WhatsApp: ${wa}`,
    "",
    "GLTech3D · Impressão 3D de Alta Precisão · @gltech3d",
  ].join("\n");

  return { subject, html, text };
}
