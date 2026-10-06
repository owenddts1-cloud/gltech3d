/**
 * Contrato comum dos transportes de e-mail.
 *
 * Viviam dentro de `resend.ts`. Foram extraídos quando o SMTP entrou: dois
 * transportes com a mesma assinatura é o que permite trocar um pelo outro sem
 * tocar nos 13 arquivos que enviam e-mail.
 */

export interface SendArgs {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Só o Resend usa; o SMTP ignora em silêncio. */
  tags?: { name: string; value: string }[];
}

export type SendErrorCode = "not_configured" | "send_failed" | "rate_limited";

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: SendErrorCode;
  details?: string;
}

export interface BatchSendResult {
  successCount: number;
  results: { email: string; success: boolean; error?: string }[];
}

/** Qual caminho está realmente valendo. Para log e para a tela de diagnóstico. */
export type EmailTransport = "smtp" | "resend" | "none";

/** Normaliza o destinatário para o formato que os logs e resultados usam. */
export function recipientLabel(to: string | string[]): string {
  return Array.isArray(to) ? to.join(",") : to;
}
