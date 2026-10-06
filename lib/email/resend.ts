/**
 * TRANSPORTE Resend. Não chame daqui — use `lib/email/send.ts`, que escolhe
 * entre este e o SMTP.
 *
 * LIMITAÇÃO QUE DEFINE O USO: sem domínio verificado, o Resend entrega apenas
 * no e-mail dono da conta. Serve para as notificações ao operador; não serve
 * para falar com o cliente. É por isso que o SMTP existe e tem prioridade.
 */
import { Resend } from "resend";
import { recipientLabel, type BatchSendResult, type SendArgs, type SendResult } from "./types";

let _client: Resend | null = null;

function getClient(): Resend | null {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key || key.length < 10) return null;
  _client = new Resend(key);
  return _client;
}

function fromAddress(): string {
  // Fallback = remetente compartilhado do Resend, que já vem verificado e não
  // exige domínio próprio. Em modo de teste (sem domínio verificado) ele só
  // entrega para o e-mail dono da conta Resend — o que basta para as
  // notificações de lead chegarem à diretoria. Para enviar aos leads também,
  // verifique um domínio no Resend e defina RESEND_FROM_EMAIL com ele.
  return process.env.RESEND_FROM_EMAIL || "GLTech3D <onboarding@resend.dev>";
}

export async function sendViaResend(args: SendArgs): Promise<SendResult> {
  const client = getClient();

  if (!client) return { ok: false, error: "not_configured" };

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

export function isResendConfigured(): boolean {
  return getClient() !== null;
}

export async function batchViaResend(batch: SendArgs[]): Promise<BatchSendResult> {
  const client = getClient();
  const from = fromAddress();

  if (!client) {
    return {
      successCount: 0,
      results: batch.map((b) => ({
        email: recipientLabel(b.to),
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
          const emailStr = recipientLabel(item.to);
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
          const emailStr = recipientLabel(item.to);
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
          const emailStr = recipientLabel(item.to);
          results.push({ email: emailStr, success: true });
        }
        successCount += chunk.length;
      }
    } catch (err) {
      console.error("[email] Exceção ao enviar lote do Resend:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      for (const item of chunk) {
        const emailStr = recipientLabel(item.to);
        results.push({ email: emailStr, success: false, error: errMsg });
      }
    }
  }

  return { successCount, results };
}
