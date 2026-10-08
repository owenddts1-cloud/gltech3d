/**
 * POST /api/v1/pro-signup/upgrade
 *
 * Pedido de liberação do PRO feito de DENTRO do CRM, por quem já tem conta
 * (tipicamente saindo do trial).
 *
 * Por que não reusar `/api/v1/public/pro-signup`: aquela rota é pública e, por
 * doutrina de multi-tenancy, **não pode** aceitar `organization_id` — não há
 * fonte confiável para ele ali. Aqui há: `resolveActiveOrg()` o resolve da
 * sessão. É exatamente essa diferença que justifica a rota existir.
 *
 * Gravar `organization_id` no pedido é o que impede a aprovação de criar uma
 * SEGUNDA organização para quem já tem uma com os dados do trial dentro.
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
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { normalizeBrPhone } from "@/lib/schemas/public-leads";
import { formatBRL } from "@/lib/pricing/pro-plans";
import { getProPlanLive } from "@/lib/pricing/settings";
import { sendEmail } from "@/lib/email/send";
import { buildProSignupNotifyEmail } from "@/lib/email/templates/pro-signup-notify";
import { absoluteSiteUrl } from "@/lib/marketing/site-url";
import { emailActionUrls } from "@/lib/pro-signup/email-action-token";
import {
  canRequestProUpgrade,
  PRO_REQUEST_FORBIDDEN_MESSAGE,
} from "@/lib/pro-signup/request-permission";

import { ownerNotifyEmail } from "@/lib/email/owner";
export const dynamic = "force-dynamic";

/** Shown to the in-app user when another pending request holds this e-mail. */
const PENDING_REQUEST_CONFLICT_MESSAGE =
  "Já existe um pedido pendente com este e-mail — fale com o suporte para concluirmos a liberação.";
export const runtime = "nodejs";

const schema = z
  .object({
    buyer_name: z.string().trim().min(2).max(120),
    buyer_phone: z.string().trim().min(8).max(40),
    pix_txid: z.string().trim().max(64).optional(),
  })
  .strict();

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();

  const user = await loadAuthUser();
  if (!user) return fail("unauthenticated", "faça login para continuar", 401, { requestId });

  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) return fail("no_active_org", "nenhuma organização ativa", 400, { requestId });

  // Só o admin da org decide a cobrança dela: aprovar este pedido dá PRO à org
  // inteira. Antes de qualquer escrita e antes de gastar o rate limit.
  if (!canRequestProUpgrade({ role: activeOrg.role, isPlatformAdmin: user.is_platform_admin })) {
    return fail("forbidden_role", PRO_REQUEST_FORBIDDEN_MESSAGE, 403, { requestId });
  }

  // Rate limit por ORG, não por IP: o usuário está autenticado, e o abuso a
  // conter é o mesmo cliente disparando pedidos, não uma varredura anônima.
  const rl = await checkRateLimit(`pro-upgrade:${activeOrg.orgId}`, 3, 3600);
  if (!rl.allowed) {
    return fail("rate_limited", "muitas tentativas, tente novamente mais tarde", 429, { requestId });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_request", "invalid_json", 400, { requestId });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", "dados inválidos", 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const plan = await getProPlanLive();
  const declaredPaidAt = new Date();
  const phoneE164 = normalizeBrPhone(parsed.data.buyer_phone);
  const admin = createAdminClient();
  const buyerEmail = user.email.trim().toLowerCase();

  // A PENDING request from the PUBLIC form with this e-mail is NEVER touched
  // here (pendência 18 stays open). Signup does not verify e-mail ownership
  // (email_confirm: true), so "the session has this e-mail" does not prove
  // "this person paid the public Pix": cancelling/replacing that request would
  // let whoever registered the e-mail first take the PRO paid by someone else.
  // The unique pending-per-e-mail index (0081) refuses the insert instead, and
  // the owner decides in the panel.

  const { data: inserted, error: insErr } = await admin
    .from("pro_signup_requests")
    .insert({
      // Da sessão, NUNCA do corpo da requisição.
      organization_id: activeOrg.orgId,
      status: "pending",
      plan: plan.id,
      buyer_name: parsed.data.buyer_name,
      buyer_email: buyerEmail,
      buyer_phone: phoneE164 ?? parsed.data.buyer_phone,
      company_name: activeOrg.name,
      amount_cents: plan.amountCents,
      currency: plan.currency,
      pix_txid: parsed.data.pix_txid ?? null,
      declared_paid_at: declaredPaidAt.toISOString(),
      request_ip: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    })
    .select("id")
    .single();

  if (insErr) {
    // 23505 = já existe pedido PENDENTE para este e-mail. Reenviar é o caso
    // comum de quem não viu a confirmação; não é erro, e não pode disparar um
    // segundo e-mail ao dono.
    if (insErr.code === "23505") {
      // Whose pending request is it? Ours (resubmit) = silent duplicate, as
      // before. Anyone else's (public form, or another org) = say so, audit,
      // and never alter it.
      const { data: existing, error: existingErr } = await admin
        .from("pro_signup_requests")
        .select("id, organization_id")
        .eq("status", "pending")
        .eq("buyer_email", buyerEmail)
        .maybeSingle();
      if (existingErr) {
        logger.error("pro_upgrade_conflict_lookup_failed", { requestId, details: existingErr.message });
      }
      const existingRow = existing as { id: string; organization_id: string | null } | null;
      if (existingRow && existingRow.organization_id === activeOrg.orgId) {
        return ok({ received: true, duplicate: true }, { status: 200, requestId });
      }
      await audit({
        action: "pro_signup.blocked_by_pending",
        actorUserId: user.id,
        organizationId: activeOrg.orgId,
        resourceType: "pro_signup_request",
        resourceId: existingRow?.id ?? null,
        requestId,
        bypassedRls: true,
        metadata: {
          origin: "in_app",
          existing_is_public: existingRow ? existingRow.organization_id === null : null,
          buyer_email_hash: emailDigest(buyerEmail),
        },
      });
      return fail(
        "state_conflict",
        PENDING_REQUEST_CONFLICT_MESSAGE,
        409,
        { requestId },
      );
    }
    logger.error("pro_upgrade_insert_failed", { requestId, reason: insErr.code, details: insErr.message });
    return fail("internal_error", "falha ao registrar o pedido", 500, { requestId });
  }

  const signupId = inserted.id as string;

  await audit({
    action: "pro_signup.requested",
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "pro_signup_request",
    resourceId: signupId,
    requestId,
    bypassedRls: true,
    metadata: {
      plan: plan.id,
      amount_cents: plan.amountCents,
      origin: "in_app",
      buyer_email_hash: emailDigest(user.email),
    },
  });

  after(async () => {
    const notify = buildProSignupNotifyEmail({
      requestId: signupId,
      planLabel: plan.label,
      amountFormatted: formatBRL(plan.amountCents),
      buyerName: parsed.data.buyer_name,
      buyerEmail: user.email,
      buyerPhone: phoneE164 ?? parsed.data.buyer_phone,
      companyName: activeOrg.name,
      pixTxid: parsed.data.pix_txid ?? null,
      hasReceipt: false,
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
        replyTo: user.email,
      });
      if (!res.ok) {
        logger.error("pro_upgrade_notify_failed", { requestId, reason: res.error, details: res.details });
      }
    } catch (err) {
      logger.error("pro_upgrade_notify_threw", {
        requestId,
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return ok({ received: true, request_id: signupId }, { status: 201, requestId });
}
