/**
 * POST /api/v1/public/password-reset
 *
 * Pede o link de redefinição de senha. Até esta entrega o "Esqueci minha senha"
 * era um `mailto:` — e com auto-cadastro sem confirmação de e-mail, quem errasse
 * a digitação ficaria trancado para sempre.
 *
 * RESPOSTA SEMPRE 200 GENÉRICA, exista ou não a conta. Diferente do cadastro
 * (onde esconder a colisão quebraria o formulário), aqui revelar a existência da
 * conta não compra nada em UX e entrega uma lista de e-mails válidos a quem
 * sondar.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { clientIp } from "@/lib/api/client-ip";
import { audit } from "@/lib/audit";
import { emailDigest } from "@/lib/audit/email-digest";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { findUserIdByEmail } from "@/lib/auth/admin-users";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import {
  signPasswordResetToken,
  PASSWORD_RESET_TTL_SECONDS,
} from "@/lib/auth/password-reset-token";
import { sendEmail } from "@/lib/email/send";
import { buildPasswordResetEmail } from "@/lib/email/templates/password-reset";
import { absoluteSiteUrl } from "@/lib/marketing/site-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200) }).strict();

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_request", "invalid_json", 400, { requestId });
  }

  const parsed = schema.safeParse(body);
  // Mesmo com e-mail malformado a resposta é a genérica: um 422 aqui já
  // diferenciaria "existe" de "não existe" por tempo de resposta.
  if (!parsed.success) {
    return ok({ sent: true }, { requestId });
  }
  const email = parsed.data.email;

  const ip = clientIp(req);
  // Dois limites. O de IP barra varredura; o de e-mail impede usar o formulário
  // para bombardear a caixa de uma pessoa específica a partir de muitos IPs.
  const byIp = await checkRateLimit(`pwreset-ip:${ip}`, 5, 3600);
  const byEmail = await checkRateLimit(`pwreset-mail:${emailDigest(email)}`, 3, 3600);
  if (!byIp.allowed || !byEmail.allowed) {
    logger.warn("password_reset_rate_limited", { requestId, ip });
    return ok({ sent: true }, { requestId });
  }

  const admin = createAdminClient();
  const userId = await findUserIdByEmail(admin, email);

  if (userId) {
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_SECONDS * 1000);
    const token = signPasswordResetToken({ userId, email });
    const resetUrl = absoluteSiteUrl(`/redefinir-senha/${token}`);

    await audit({
      action: "auth.password_reset_requested",
      actorUserId: userId,
      resourceType: "user",
      resourceId: userId,
      requestId,
      ip,
      userAgent: req.headers.get("user-agent"),
      bypassedRls: true,
      metadata: { email_hash: emailDigest(email) },
    });

    after(async () => {
      const mail = buildPasswordResetEmail({ resetUrl, expiresAt });
      try {
        const res = await sendEmail({
          to: email,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        });
        if (!res.ok) {
          // Silêncio aqui já escondeu um caminho de e-mail inteiramente quebrado
          // antes (conta Resend sem domínio verificado devolve 403 em todo envio).
          logger.error("password_reset_email_failed", {
            requestId,
            reason: res.error,
            details: res.details,
          });
        }
      } catch (err) {
        logger.error("password_reset_email_threw", {
          requestId,
          details: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  return ok({ sent: true }, { requestId });
}
