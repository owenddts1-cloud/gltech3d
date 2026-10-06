/**
 * Aviso ao cliente (admins da org) quando o dono da plataforma muda o plano no
 * painel de Assinantes: definiu plano/vencimento, estendeu, ou removeu.
 *
 * Mesmo padrão dos outros templates: HTML inline, sem asset externo, texto
 * puro de reserva, `escapeHtml` em tudo que vem do banco. Não inclui o motivo
 * digitado pelo operador — ele é nota interna de auditoria, não mensagem ao
 * cliente.
 */
import { escapeHtml } from "@/lib/email/escape";

export type PlanChangeKind = "set" | "extend" | "revoke";

export interface PlanChangedOptions {
  kind: PlanChangeKind;
  orgName: string;
  /** Rótulo do plano depois da mudança (ex.: "Calc3D PRO", "Enterprise", "Gratuito"). */
  planLabel: string;
  /** Vencimento depois da mudança. `null` = sem vencimento (ou plano gratuito). */
  expiresAt: Date | null;
  hasProAccess: boolean;
  appUrl: string;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function buildPlanChangedEmail(opts: PlanChangedOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const validity = !opts.hasProAccess
    ? null
    : opts.expiresAt
      ? `Seu acesso vale até ${fmtDate(opts.expiresAt)}.`
      : "Seu acesso não tem data de vencimento.";

  const { subject, headline, body } =
    opts.kind === "revoke"
      ? {
          subject: "Seu plano Calc3D PRO foi encerrado",
          headline: "Plano encerrado",
          body: `O plano pago de ${opts.orgName} foi encerrado. Seus dados continuam guardados; os módulos PRO ficam bloqueados até uma nova contratação.`,
        }
      : opts.kind === "extend"
        ? {
            subject: "Seu plano Calc3D PRO foi estendido",
            headline: "Plano estendido",
            body: `O plano ${opts.planLabel} de ${opts.orgName} foi estendido.`,
          }
        : {
            subject: "Seu plano foi atualizado",
            headline: "Plano atualizado",
            body: `O plano de ${opts.orgName} agora é ${opts.planLabel}.`,
          };

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f5f5f4;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1c1917">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:20px;line-height:1.3;margin:0 0 8px;color:#0c0a09">${escapeHtml(headline)}</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#57534e">${escapeHtml(body)}</p>
    ${validity ? `<p style="margin:0 0 16px;font-size:14px;color:#1c1917"><strong>${escapeHtml(validity)}</strong></p>` : ""}
    <p style="margin:24px 0">
      <a href="${escapeHtml(opts.appUrl)}"
         style="display:inline-block;background:#8E6D4D;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold">
        Abrir o CRM
      </a>
    </p>
    <p style="margin:0;font-size:12px;color:#a8a29e">
      Dúvidas? Responda este e-mail ou fale com a GLTech3D no WhatsApp.
    </p>
  </div>
</body>
</html>`;

  const text = [headline, "", body, validity, "", `Abrir o CRM: ${opts.appUrl}`]
    .filter((l): l is string => l !== null)
    .join("\n");

  return { subject, html, text };
}
