/**
 * Transporte SMTP (Gmail por padrão, mas genérico).
 *
 * POR QUE EXISTE: o Resend só entrega a terceiros com domínio verificado, e
 * este projeto não tem domínio próprio — `gltech3d.com.br` não está registrado e
 * `gltech3d.vercel.app` é subdomínio da Vercel, que não aceita registros DNS.
 * Sem SMTP, o cliente nunca receberia o link de ativação nem a redefinição de
 * senha.
 *
 * As variáveis são genéricas de propósito: as mesmas servem Zoho, Brevo,
 * Mailgun ou o SMTP do provedor no dia em que os ~500/dia do Gmail apertarem.
 */
import nodemailer, { type Transporter } from "nodemailer";
import { recipientLabel, type BatchSendResult, type SendArgs, type SendResult } from "./types";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

function readConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD?.trim();
  // Sem senha não há transporte: um SMTP_HOST solto é configuração pela metade,
  // e tratá-la como válida faria todo envio falhar em runtime em vez de o
  // despachante cair para o Resend.
  if (!host || !user || !password) return null;

  const port = Number(process.env.SMTP_PORT) || 465;
  return {
    host,
    port,
    user,
    password,
    from: process.env.SMTP_FROM?.trim() || user,
  };
}

export function isSmtpConfigured(): boolean {
  return readConfig() !== null;
}

let _transporter: Transporter | null = null;

function resetTransporter(): void {
  _transporter?.close();
  _transporter = null;
}

function getTransporter(cfg: SmtpConfig): Transporter {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    // 465 é SMTPS (TLS desde o handshake). A 587 com STARTTLS também funciona,
    // mas falha mais em ambiente serverless.
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.password },
    // Reusa a conexão: abrir TLS a cada e-mail dentro de uma função serverless é
    // caro e, em rajada, o servidor começa a recusar.
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    // Sem isto o padrão do nodemailer espera até 2 minutos por um servidor que
    // não responde — tempo em que a função serverless já teria sido cortada.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return _transporter;
}

/** O Gmail recusa com estas marcas quando o limite diário estoura. */
function isQuotaError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("limit") ||
    m.includes("quota") ||
    m.includes("rate") ||
    m.includes("too many") ||
    m.includes("4.7.0")
  );
}

/**
 * Falhas de REDE, não de credencial nem de conteúdo.
 *
 * Observado na configuração real: `smtp-relay.brevo.com` resolve para vários
 * servidores, e um deles não respondeu (`connect ETIMEDOUT`). A tentativa
 * seguinte caiu em outro e entregou. Sem nova tentativa, o cliente perderia o
 * link de ativação por um soluço de rede.
 */
const TRANSIENT_CODES = new Set(["ETIMEDOUT", "ECONNREFUSED", "ECONNRESET", "ESOCKET", "ECONNECTION", "EDNS"]);

export function isTransientSmtpError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" && TRANSIENT_CODES.has(code);
}

/** Uma nova tentativa só para falha de rede. Erro de autenticação não melhora repetindo. */
const MAX_ATTEMPTS = 2;

export async function sendViaSmtp(args: SendArgs): Promise<SendResult> {
  const cfg = readConfig();
  if (!cfg) return { ok: false, error: "not_configured" };

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const info = await getTransporter(cfg).sendMail({
        from: cfg.from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
        replyTo: args.replyTo,
      });
      return { ok: true, id: info.messageId };
    } catch (err) {
      lastErr = err;
      if (!isTransientSmtpError(err) || attempt === MAX_ATTEMPTS) break;
      // O pool pode ter guardado a conexão morta; recriar força nova resolução
      // de DNS e, com sorte, outro servidor do pool.
      resetTransporter();
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const details = lastErr instanceof Error ? lastErr.message : String(lastErr);
  // Distinguir cota de falha genérica importa: "rate_limited" diz ao operador
  // para esperar; "send_failed" o manda procurar bug que não existe.
  return {
    ok: false,
    error: isQuotaError(details) ? "rate_limited" : "send_failed",
    details,
  };
}

/**
 * SMTP não tem API de lote — é laço sequencial com pausa.
 *
 * A pausa não é zelo excessivo: o Gmail estrangula rajada e passa a recusar.
 * O consumidor real (newsletter do Instagram) tem volume baixo.
 */
export async function batchViaSmtp(batch: SendArgs[]): Promise<BatchSendResult> {
  const cfg = readConfig();
  if (!cfg) {
    return {
      successCount: 0,
      results: batch.map((b) => ({
        email: recipientLabel(b.to),
        success: false,
        error: "not_configured",
      })),
    };
  }

  const results: BatchSendResult["results"] = [];
  let successCount = 0;

  for (const item of batch) {
    const res = await sendViaSmtp(item);
    const email = recipientLabel(item.to);
    if (res.ok) {
      successCount++;
      results.push({ email, success: true });
    } else {
      results.push({ email, success: false, error: res.details ?? res.error });
      // Estourou a cota: parar e marcar o resto, em vez de queimar tentativas
      // que já se sabe que vão falhar.
      if (res.error === "rate_limited") {
        const restantes = batch.slice(results.length);
        for (const r of restantes) {
          results.push({ email: recipientLabel(r.to), success: false, error: "rate_limited" });
        }
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  return { successCount, results };
}
