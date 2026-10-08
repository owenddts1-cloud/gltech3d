/**
 * POST /api/v1/public/pro-signup
 *
 * Intake público do Calc3D PRO: o comprador fez o Pix, declara o pagamento e
 * pede a liberação do CRM. Pipeline: rate-limit por IP -> honeypot -> Zod ->
 * INSERT com service role -> audit -> e-mail ao dono (best-effort, em after()).
 *
 * Route Handler e não Server Action de propósito: `lib/auth/public-paths.ts` já
 * libera `/api/v1/public/`, `checkRateLimit` precisa do IP, e o envelope
 * ok()/fail()/X-Request-Id é contrato de rota. Server Action numa página pública
 * é POST no path de uma página — ver o comentário em public-paths.ts sobre como
 * isso estoura.
 *
 * O cliente usa service role, que bypassa RLS. Nada do corpo pode virar
 * `organization_id`: a coluna fica NULA aqui e só é preenchida na aprovação,
 * dentro do console de platform admin.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { clientIp } from "@/lib/api/client-ip";
import { emailDigest } from "@/lib/audit/email-digest";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { normalizeBrPhone } from "@/lib/schemas/public-leads";
import { proSignupRequestSchema } from "@/lib/schemas/pro-signup";
import { formatBRL } from "@/lib/pricing/pro-plans";
import { getProPlanLive } from "@/lib/pricing/settings";
import { sendEmail } from "@/lib/email/send";
import { buildProSignupNotifyEmail } from "@/lib/email/templates/pro-signup-notify";
import { absoluteSiteUrl } from "@/lib/marketing/site-url";
import { emailActionUrls } from "@/lib/pro-signup/email-action-token";

import { ownerNotifyEmail } from "@/lib/email/owner";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();

  // 3 envios por hora por IP — bem mais apertado que os 5/min da rota de leads
  // porque CADA envio aqui dispara um e-mail para o dono.
  //
  // ATENÇÃO: sem UPSTASH_REDIS_REST_URL o checkRateLimit cai para contador em
  // memória, que em serverless é POR INSTÂNCIA, ou seja praticamente sem limite.
  // Nessa condição esta rota é um amplificador de spam com o domínio da
  // GLTech3D. Redis é pré-requisito de produção aqui.
  const ip = clientIp(req);
  const rl = await checkRateLimit(`pro-signup:${ip}`, 3, 3600);
  if (!rl.allowed) {
    logger.warn("pro_signup_rate_limited", { requestId, ip, count: rl.count, limit: rl.limit });
    return fail("rate_limited", "muitas tentativas, tente novamente mais tarde", 429, { requestId });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_request", "invalid_json", 400, { requestId });
  }

  const parsed = proSignupRequestSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", "dados inválidos", 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const input = parsed.data;

  // Honeypot: o campo `website` é escondido por CSS no formulário. Humano nunca
  // preenche. Respondemos 201 como se tivesse dado certo — dizer "você é um bot"
  // só ensina o bot a contornar.
  if (input.website) {
    logger.warn("pro_signup_honeypot", { requestId, ip });
    return ok({ received: true }, { status: 201, requestId });
  }

  // O preço é DERIVADO do plano, nunca aceito do corpo. É o que elimina a classe
  // inteira de tampering de valor em vez de tentar detectá-la. O valor vem de
  // platform_settings (editável pelo platform admin), lido no servidor.
  const plan = await getProPlanLive();
  const declaredPaidAt = new Date();
  const phoneE164 = normalizeBrPhone(input.buyer_phone);

  const admin = createAdminClient();

  const { data: inserted, error: insErr } = await admin
    .from("pro_signup_requests")
    .insert({
      organization_id: null,
      status: "pending",
      plan: plan.id,
      buyer_name: input.buyer_name,
      buyer_email: input.buyer_email,
      buyer_phone: phoneE164 ?? input.buyer_phone,
      company_name: input.company_name ?? null,
      amount_cents: plan.amountCents,
      currency: plan.currency,
      pix_txid: input.pix_txid ?? null,
      declared_paid_at: declaredPaidAt.toISOString(),
      receipt_storage_path: input.receipt_path ?? null,
      request_ip: ip,
      user_agent: req.headers.get("user-agent"),
    })
    .select("id")
    .single();

  if (insErr) {
    // 23505 = já existe pedido PENDENTE para este e-mail (índice único parcial).
    // Reenviar o formulário é o caso comum de quem não viu a confirmação; não é
    // erro, e principalmente NÃO pode disparar um segundo e-mail ao dono.
    if (insErr.code === "23505") {
      logger.info("pro_signup_duplicate_pending", { requestId });
      return ok({ received: true, duplicate: true }, { status: 200, requestId });
    }
    logger.error("pro_signup_insert_failed", { requestId, reason: insErr.code, details: insErr.message });
    return fail("internal_error", "falha ao registrar o pedido", 500, { requestId });
  }

  const signupId = inserted.id as string;

  await audit({
    action: "pro_signup.requested",
    resourceType: "pro_signup_request",
    resourceId: signupId,
    requestId,
    ip,
    userAgent: req.headers.get("user-agent"),
    bypassedRls: true,
    // E-mail é PII: vai hasheado, como a rota de criação de tenant já faz.
    metadata: {
      plan: plan.id,
      amount_cents: plan.amountCents,
      has_receipt: !!input.receipt_path,
      buyer_email_hash: emailDigest(input.buyer_email),
    },
  });

  // Em after(): o pedido já está salvo e o comprador não deve esperar o SMTP.
  // `void promise` não serve — a função serverless pode congelar ao retornar e
  // descartar o envio em voo.
  after(async () => {
    const notify = buildProSignupNotifyEmail({
      requestId: signupId,
      planLabel: plan.label,
      amountFormatted: formatBRL(plan.amountCents),
      buyerName: input.buyer_name,
      buyerEmail: input.buyer_email,
      buyerPhone: phoneE164 ?? input.buyer_phone,
      companyName: input.company_name ?? null,
      pixTxid: input.pix_txid ?? null,
      hasReceipt: !!input.receipt_path,
      declaredPaidAt,
      reviewUrl: absoluteSiteUrl(`/admin/pro-signups/${signupId}`),
      // Botões de 1 clique (sem login). `null` sem PRO_APPROVAL_TOKEN_SECRET.
      ...emailActionUrls({ rid: signupId, amt: plan.amountCents }),
    });

    try {
      const res = await sendEmail({
        to: ownerNotifyEmail(),
        subject: notify.subject,
        html: notify.html,
        text: notify.text,
        replyTo: input.buyer_email,
      });
      if (!res.ok) {
        // Silêncio aqui já escondeu um caminho de e-mail inteiramente quebrado
        // antes (conta Resend sem domínio verificado devolve 403 em todo envio).
        logger.error("pro_signup_notify_failed", {
          requestId,
          signupId,
          reason: res.error,
          details: res.details,
        });
      }
    } catch (err) {
      logger.error("pro_signup_notify_threw", {
        requestId,
        signupId,
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return ok({ received: true, request_id: signupId }, { status: 201, requestId });
}
