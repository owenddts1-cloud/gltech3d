import { escapeHtml } from "@/lib/email/escape";

export interface NewsletterCampaignProduct {
  name: string;
  price: string;
  imageUrl?: string;
  url: string;
}

export interface NewsletterCampaignMaterial {
  name: string;
  description: string;
  colorName?: string;
  colorHex?: string;
  badge?: string;
}

export interface NewsletterCampaignOptions {
  subject: string;
  previewText?: string;
  recipientEmail: string;
  products: NewsletterCampaignProduct[];
  materialOfTheWeek?: NewsletterCampaignMaterial;
  customCtaUrl?: string;
  unsubscribeUrl?: string;
}

export function buildNewsletterCampaignEmail(opts: NewsletterCampaignOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = opts.subject;
  const preview = opts.previewText || "Confira os destaques da semana, peças recém-saídas da oficina e nosso filamento em foco.";
  const ctaUrl = opts.customCtaUrl || "https://gltech3d.vercel.app/orcamento";
  const unsubUrl = opts.unsubscribeUrl || `https://gltech3d.vercel.app/api/newsletter/unsubscribe?email=${encodeURIComponent(opts.recipientEmail)}`;

  const productsHtml = opts.products
    .map(
      (p) => `
      <td width="33%" style="padding:8px;vertical-align:top">
        <div style="background-color:#161311;border:1px solid #2B2521;border-radius:14px;padding:14px;text-align:center">
          ${
            p.imageUrl
              ? `<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" style="width:100%;height:120px;object-fit:cover;border-radius:10px;margin-bottom:10px;display:block" />`
              : `<div style="width:100%;height:100px;background-color:#241E1A;border-radius:10px;margin-bottom:10px;display:flex;align-items:center;justify-content:center;color:#A6815C;font-size:11px;font-weight:700">MODELO 3D</div>`
          }
          <h4 style="margin:0 0 6px;font-size:13px;font-weight:800;color:#FAF9F6;line-height:1.3;min-height:34px">
            ${escapeHtml(p.name)}
          </h4>
          <p style="margin:0 0 10px;font-size:13px;font-weight:900;color:#A6815C;font-family:monospace">
            ${escapeHtml(p.price)}
          </p>
          <a href="${escapeHtml(p.url)}"
             style="display:inline-block;padding:7px 14px;background-color:#2B2521;color:#FAF9F6;text-decoration:none;border-radius:8px;font-size:11px;font-weight:700;border:1px solid #38302B">
            Ver Peça →
          </a>
        </div>
      </td>
    `,
    )
    .join("");

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#12100E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#FAF9F6">
  <!-- Preheader preview text -->
  <div style="display:none;font-size:1px;color:#12100E;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden">
    ${escapeHtml(preview)}
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#12100E;padding:32px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:620px;background-color:#1E1A17;border:1px solid #38302B;border-radius:24px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.5)">
          
          <!-- Accent Line -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#A6815C,#E0C4A0,#A6815C)"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid #2B2521">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size:20px;font-weight:900;letter-spacing:0.05em;color:#FAF9F6">
                      GLTECH<span style="color:#A6815C">3D</span>
                    </span>
                    <p style="margin:2px 0 0;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#A6815C">
                      Tecnologia & Impressão 3D
                    </p>
                  </td>
                  <td align="right">
                    <a href="https://gltech3d.vercel.app" style="color:#C4BCB3;text-decoration:none;font-size:12px;font-weight:600;margin-left:14px">Início</a>
                    <a href="https://gltech3d.vercel.app/produtos" style="color:#C4BCB3;text-decoration:none;font-size:12px;font-weight:600;margin-left:14px">Produtos</a>
                    <a href="https://gltech3d.vercel.app/filamentos" style="color:#C4BCB3;text-decoration:none;font-size:12px;font-weight:600;margin-left:14px">Filamentos</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bloco 1: Destaques Recentes -->
          <tr>
            <td style="padding:28px 24px 16px">
              <span style="font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#A6815C;display:block;margin-bottom:4px">
                O que mais sai da oficina
              </span>
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:900;color:#FAF9F6">
                🔥 Destaques da Semana
              </h2>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  ${productsHtml}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bloco 2: Material da Semana -->
          ${
            opts.materialOfTheWeek
              ? `
          <tr>
            <td style="padding:16px 24px">
              <div style="background-color:#151210;border:1px solid #2B2521;border-radius:18px;padding:22px">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <span style="display:inline-block;padding:4px 10px;border-radius:9999px;background-color:#A6815C/20;border:1px solid #A6815C/40;color:#E0C4A0;font-size:10px;font-weight:800;text-transform:uppercase;margin-bottom:8px">
                        ${escapeHtml(opts.materialOfTheWeek.badge || "Material da Semana")}
                      </span>
                      <h3 style="margin:0 0 6px;font-size:17px;font-weight:900;color:#FAF9F6">
                        🧪 ${escapeHtml(opts.materialOfTheWeek.name)}
                      </h3>
                      <p style="margin:0;font-size:13px;line-height:1.5;color:#C4BCB3">
                        ${escapeHtml(opts.materialOfTheWeek.description)}
                      </p>
                    </td>
                    ${
                      opts.materialOfTheWeek.colorHex
                        ? `
                    <td width="50" align="center" style="padding-left:16px">
                      <div style="width:40px;height:40px;border-radius:50%;background-color:${escapeHtml(opts.materialOfTheWeek.colorHex)};border:2px solid #FAF9F6;box-shadow:0 4px 12px rgba(0,0,0,0.4)"></div>
                    </td>
                    `
                        : ""
                    }
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          `
              : ""
          }

          <!-- Bloco 3: Chamada para Ação (Projetos Personalizados / STL) -->
          <tr>
            <td style="padding:16px 24px 28px">
              <div style="background:linear-gradient(135deg,#2B221B,#1C1815);border:1px solid #44372D;border-radius:18px;padding:24px;text-align:center">
                <h3 style="margin:0 0 8px;font-size:18px;font-weight:900;color:#FAF9F6">
                  💡 Tem um projeto personalizado?
                </h3>
                <p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:#C4BCB3;max-width:440px;display:inline-block">
                  Envie seu arquivo STL para orçamento. Nossa equipe faz a checagem técnica de espessura e fatiamento sem custo.
                </p>
                <div>
                  <a href="${escapeHtml(ctaUrl)}"
                     style="display:inline-block;padding:12px 28px;background-color:#A6815C;color:#FFFFFF;text-decoration:none;border-radius:9999px;font-size:13px;font-weight:800;letter-spacing:0.02em;box-shadow:0 8px 24px rgba(166,129,92,0.3)">
                    Enviar Arquivo STL para Orçamento →
                  </a>
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background-color:#151210;border-top:1px solid #2B2521;text-align:center">
              <p style="margin:0 0 10px;font-size:12px;color:#9E948A">
                <strong>Atendimento Oficial GLTech3D:</strong><br>
                WhatsApp: <a href="https://wa.me/5531999284834" style="color:#25D366;text-decoration:none;font-weight:700">(31) 99928-4834</a> · 
                Instagram: <a href="https://instagram.com/gltech3d" style="color:#A6815C;text-decoration:none">@gltech3d</a>
              </p>
              <p style="margin:0 0 12px;font-size:11px;color:#6E665E">
                Também estamos presentes na Shopee e Mercado Livre com envio para todo o Brasil.
              </p>
              <p style="margin:0;font-size:10px;color:#554E48">
                Você recebeu esta mensagem porque se inscreveu na comunidade GLTech3D.<br>
                Para cancelar sua inscrição, <a href="${escapeHtml(unsubUrl)}" style="color:#8E8276;text-decoration:underline">clique aqui para descadastrar</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const productsText = opts.products
    .map((p) => `- ${p.name} (${p.price}): ${p.url}`)
    .join("\n");

  const materialText = opts.materialOfTheWeek
    ? [
        `\nMATERIAL DA SEMANA: ${opts.materialOfTheWeek.name}`,
        opts.materialOfTheWeek.description,
      ].join("\n")
    : "";

  const text = [
    `GLTECH3D — ${subject}`,
    "=========================================",
    preview,
    "",
    "DESTAQUES DA SEMANA:",
    productsText,
    materialText,
    "",
    "TEM UM PROJETO PERSONALIZADO?",
    "Envie seu arquivo STL para orçamento técnico sem custo:",
    ctaUrl,
    "",
    "CONTATOS OFICIAIS:",
    "WhatsApp: (31) 99928-4834",
    "Instagram: @gltech3d",
    "",
    "Deseja cancelar sua inscrição?",
    unsubUrl,
  ].join("\n");

  return { subject, html, text };
}
