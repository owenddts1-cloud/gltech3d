/**
 * Ponto único de envio de e-mail. Todo consumidor importa daqui.
 *
 * Escolhe o transporte em tempo de chamada:
 *
 *   SMTP configurado   -> SMTP
 *   Resend configurado -> Resend
 *   nenhum             -> not_configured (log em dev)
 *
 * POR QUE O SMTP VEM PRIMEIRO: é o único que entrega a terceiros neste projeto.
 * O Resend exige domínio verificado para isso, e aqui não há domínio próprio —
 * `gltech3d.com.br` não está registrado e `gltech3d.vercel.app` não aceita
 * registros DNS. Com os dois configurados, o Resend fica de reserva.
 *
 * A assinatura é idêntica à que `resend.ts` expunha antes, de propósito: os 13
 * consumidores só trocaram o caminho do import.
 */
import { batchViaResend, isResendConfigured, sendViaResend } from "./resend";
import { batchViaSmtp, isSmtpConfigured, sendViaSmtp } from "./smtp";
import {
  recipientLabel,
  type BatchSendResult,
  type EmailTransport,
  type SendArgs,
  type SendResult,
} from "./types";

export type { SendArgs, SendResult, BatchSendResult, EmailTransport };

/**
 * Qual caminho está valendo agora.
 *
 * Exportado para o log e para a tela de diagnóstico dizerem por onde o e-mail
 * saiu — sem isso, depurar "o e-mail não chegou" vira adivinhação entre dois
 * provedores.
 */
export function activeTransport(): EmailTransport {
  if (isSmtpConfigured()) return "smtp";
  if (isResendConfigured()) return "resend";
  return "none";
}

export function isEmailConfigured(): boolean {
  return activeTransport() !== "none";
}

/** Em dev, mostra o que teria sido enviado. Em prod, silêncio — o caller decide. */
function warnNotConfigured(context: string, detail: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `[email] nenhum transporte configurado (SMTP_* ou RESEND_API_KEY) — ${context} não enviado.`,
      detail,
    );
  }
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  switch (activeTransport()) {
    case "smtp":
      return sendViaSmtp(args);
    case "resend":
      return sendViaResend(args);
    case "none":
      warnNotConfigured("e-mail", {
        to: recipientLabel(args.to),
        subject: args.subject,
        preview: args.text?.slice(0, 200) ?? args.html.slice(0, 200),
      });
      return { ok: false, error: "not_configured" };
  }
}

export async function sendBatchEmails(batch: SendArgs[]): Promise<BatchSendResult> {
  switch (activeTransport()) {
    case "smtp":
      return batchViaSmtp(batch);
    case "resend":
      return batchViaResend(batch);
    case "none":
      warnNotConfigured("lote de e-mails", { quantidade: batch.length });
      return {
        successCount: 0,
        results: batch.map((b) => ({
          email: recipientLabel(b.to),
          success: false,
          error: "not_configured",
        })),
      };
  }
}
