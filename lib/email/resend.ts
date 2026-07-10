/**
 * Resend wrapper. Usado por: convites de team, magic links, notificações operacionais.
 *
 * Comportamento defensivo: quando RESEND_API_KEY não está configurada, faz log
 * do payload no console em DEV (nunca em prod) e retorna { ok: false, error: 'not_configured' }
 * — o caller decide se isso é fatal ou não. Convites NÃO devem falhar silenciosamente
 * em prod; em dev, o log permite que o flow continue sem credenciais reais.
 */
import { Resend } from "resend";

interface SendArgs {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

interface SendResult {
  ok: boolean;
  id?: string;
  error?: "not_configured" | "send_failed" | "rate_limited";
  details?: string;
}

let _client: Resend | null = null;

function getClient(): Resend | null {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key || key.length < 10) return null;
  _client = new Resend(key);
  return _client;
}

function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL || "GLTECH CRM <noreply@deskcomm.app>";
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const client = getClient();

  if (!client) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[email] RESEND_API_KEY não configurada — email não enviado. Payload:",
        {
          to: args.to,
          subject: args.subject,
          preview: args.text?.slice(0, 200) ?? args.html.slice(0, 200),
        },
      );
      return { ok: false, error: "not_configured" };
    }
    return { ok: false, error: "not_configured" };
  }

  try {
    const { data, error } = await client.emails.send({
      from: fromAddress(),
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo: args.replyTo,
      tags: args.tags,
    });

    if (error) {
      const isRateLimit = String(error.name || "").toLowerCase().includes("rate");
      return {
        ok: false,
        error: isRateLimit ? "rate_limited" : "send_failed",
        details: error.message,
      };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    return {
      ok: false,
      error: "send_failed",
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

export function isEmailConfigured(): boolean {
  return getClient() !== null;
}

interface BatchSendResult {
  successCount: number;
  results: { email: string; success: boolean; error?: string }[];
}

export async function sendBatchEmails(batch: SendArgs[]): Promise<BatchSendResult> {
  const client = getClient();
  const from = fromAddress();

  if (!client) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[email] RESEND_API_KEY não configurada — batch de e-mails não enviado. Qtd:",
        batch.length,
      );
    }
    return {
      successCount: 0,
      results: batch.map((b) => ({
        email: Array.isArray(b.to) ? b.to.join(",") : b.to,
        success: false,
        error: "not_configured",
      })),
    };
  }

  // O Resend permite no máximo 100 e-mails por lote na API de batch.
  const CHUNK_SIZE = 100;
  const chunks: SendArgs[][] = [];
  for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
    chunks.push(batch.slice(i, i + CHUNK_SIZE));
  }

  let successCount = 0;
  const results: { email: string; success: boolean; error?: string }[] = [];

  for (const chunk of chunks) {
    try {
      const payload = chunk.map((item) => ({
        from: from,
        to: item.to,
        subject: item.subject,
        html: item.html,
        text: item.text,
        replyTo: item.replyTo,
        tags: item.tags,
      }));

      const { data, error } = await client.batch.send(payload);

      if (error) {
        console.error("[email] Erro no envio em lote do Resend:", error);
        for (const item of chunk) {
          const emailStr = Array.isArray(item.to) ? item.to.join(",") : item.to;
          results.push({
            email: emailStr,
            success: false,
            error: error.message,
          });
        }
      } else if (data?.data) {
        data.data.forEach((res, index) => {
          const item = chunk[index];
          if (!item) return;
          const emailStr = Array.isArray(item.to) ? item.to.join(",") : item.to;
          if (res.id) {
            successCount++;
            results.push({ email: emailStr, success: true });
          } else {
            results.push({ email: emailStr, success: false, error: "send_failed" });
          }
        });
      } else {
        // Fallback se a estrutura de retorno for diferente mas sem erros explícitos
        for (const item of chunk) {
          const emailStr = Array.isArray(item.to) ? item.to.join(",") : item.to;
          results.push({ email: emailStr, success: true });
        }
        successCount += chunk.length;
      }
    } catch (err) {
      console.error("[email] Exceção ao enviar lote do Resend:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      for (const item of chunk) {
        const emailStr = Array.isArray(item.to) ? item.to.join(",") : item.to;
        results.push({ email: emailStr, success: false, error: errMsg });
      }
    }
  }

  return { successCount, results };
}
