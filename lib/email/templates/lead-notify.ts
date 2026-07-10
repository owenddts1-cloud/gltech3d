/**
 * Internal notification email — sent to the GLTech3D directorate whenever a new
 * landing lead / newsletter signup comes in. Plain inline-styled HTML (email
 * client compat), no external assets. Mirrors `lib/email/templates/invite.ts`.
 */
export interface LeadNotifyOptions {
  type: "lead" | "newsletter";
  name?: string | null;
  email: string;
  phone?: string | null;
  createdAt: Date;
}

export function buildLeadNotifyEmail(opts: LeadNotifyOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const isNewsletter = opts.type === "newsletter";
  const when = opts.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const kind = isNewsletter ? "Nova inscrição na newsletter" : "Novo contato pelo site";
  const subject = `${kind}: ${opts.name?.trim() || opts.email}`;

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:6px 12px;font-size:13px;color:#78716c;white-space:nowrap">${label}</td>
      <td style="padding:6px 12px;font-size:14px;color:#1c1917"><strong>${escapeHtml(value)}</strong></td>
    </tr>`;

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f5f5f4;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1c1917">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:20px;line-height:1.3;margin:0 0 8px;color:#0c0a09">${kind}</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#57534e">Recebido em ${when} (GLTECH CRM).</p>
    <table style="border-collapse:collapse;background:#ffffff;border:1px solid #e7e5e4;border-radius:8px;width:100%">
      ${opts.name ? row("Nome", opts.name) : ""}
      ${row("E-mail", opts.email)}
      ${opts.phone ? row("Telefone", opts.phone) : ""}
      ${row("Origem", isNewsletter ? "Newsletter" : "Formulário de contato")}
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#78716c">Responda direto neste e-mail para falar com o contato.</p>
  </div>
</body>
</html>`;

  const text = [
    kind,
    "",
    opts.name ? `Nome: ${opts.name}` : null,
    `E-mail: ${opts.email}`,
    opts.phone ? `Telefone: ${opts.phone}` : null,
    `Origem: ${isNewsletter ? "Newsletter" : "Formulário de contato"}`,
    `Recebido em: ${when}`,
  ]
    .filter(Boolean)
    .join("\n");

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
