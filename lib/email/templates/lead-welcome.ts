/**
 * Welcome email sent to a new landing lead — a brief, professional GLTech3D
 * presentation + warm welcome. Plain inline-styled HTML, no external assets.
 * Mirrors `lib/email/templates/invite.ts`.
 */
export interface LeadWelcomeOptions {
  name?: string | null;
  /** WhatsApp link for a quick reply CTA (e.g. https://wa.me/5531999284834). */
  whatsappUrl?: string;
}

export function buildLeadWelcomeEmail(opts: LeadWelcomeOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const firstName = (opts.name ?? "").trim().split(/\s+/)[0] || "";
  const hi = firstName ? `Olá, ${escapeHtml(firstName)}!` : "Olá!";
  const wa = opts.whatsappUrl ?? "https://wa.me/5531999284834";
  const subject = "Bem-vindo à GLTech3D 🚀";

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f9f7f2;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#2d241e">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="display:inline-block;width:40px;height:40px;background:#a6815c;border-radius:10px;text-align:center;line-height:40px;color:#fff;font-weight:700;font-size:18px">G</div>
    <h1 style="font-size:22px;line-height:1.3;margin:16px 0 8px;color:#2d241e">${hi}</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f342c">
      Que bom ter você por aqui. Somos a <strong>GLTech3D</strong> — transformamos
      arquivos 3D em peças reais com impressão sob demanda e acabamento premium,
      feitas aqui no Brasil.
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f342c">
      Recebemos seu contato e nossa equipe já vai falar com você. Do action figure ao
      item de decoração, da prototipagem à produção em série — a gente tira sua ideia do papel.
    </p>
    <p style="margin:24px 0">
      <a href="${wa}" style="display:inline-block;padding:12px 24px;background:#a6815c;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600">
        Falar no WhatsApp
      </a>
    </p>
    <p style="margin:24px 0 0;font-size:13px;color:#6b5e55">
      GLTech3D · Impressão 3D feita no Brasil · @gltech3d
    </p>
  </div>
</body>
</html>`;

  const text = [
    hi,
    "",
    "Que bom ter você por aqui. Somos a GLTech3D — transformamos arquivos 3D em peças reais com impressão sob demanda e acabamento premium, feitas no Brasil.",
    "",
    "Recebemos seu contato e nossa equipe já vai falar com você.",
    "",
    `Fale no WhatsApp: ${wa}`,
    "",
    "GLTech3D · Impressão 3D feita no Brasil · @gltech3d",
  ].join("\n");

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
