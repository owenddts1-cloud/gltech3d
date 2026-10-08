/**
 * POST /api/v1/public/pro-signup/email-action
 *
 * Executes the one-click "Aprovar e liberar" / "Recusar" from the owner's email.
 * No session: the credential is the signed token (lib/pro-signup/email-action-token.ts).
 * The owner explicitly chose this trade-off; the guards are:
 *
 *  - POST only, and only after a CLICK. The page /aprovar/<token> renders a
 *    summary on GET and sends this POST only when the owner presses
 *    "Confirmar aprovação"/"Confirmar recusa". An automatic POST on page load is
 *    NOT safe: e-mail security sandboxes (Defender Safe Links, Proofpoint,
 *    Mimecast) detonate links in headless browsers WITH JavaScript and would
 *    approve or reject on their own.
 *  - Token: HMAC with its own secret, bound to purpose + action + request id +
 *    amount, 48h. Feature is OFF without PRO_APPROVAL_TOKEN_SECRET.
 *  - Single effect: only a `pending` request changes (conditional claim in
 *    lib/pro-signup/approve.ts). A second click answers 409 `already_decided`.
 *  - Rate limit per IP (10 / 10 min).
 *  - Audit with `via: "email_link"` + IP, and an alarm email to the owner with a
 *    link to undo it in the Assinantes panel.
 *
 * Service role is used after the token is verified; the request id comes from
 * the SIGNED token, never from the body.
 */
import { randomUUID } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { clientIp } from "@/lib/api/client-ip";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyEmailActionToken } from "@/lib/pro-signup/email-action-token";
import { approveProSignup, rejectProSignup } from "@/lib/pro-signup/approve";
import { maskEmail } from "@/lib/pro-signup/whatsapp-message";
import { sendEmail } from "@/lib/email/send";
import { ownerNotifyEmail } from "@/lib/email/owner";
import { buildProApprovedAlarmEmail } from "@/lib/email/templates/pro-approved-alarm";
import { absoluteSiteUrl } from "@/lib/marketing/site-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RATE_LIMIT = 10;
const RATE_WINDOW_SEC = 600;

const bodySchema = z.object({ token: z.string().min(10).max(4096) }).strict();

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const ip = clientIp(req);

  const rl = await checkRateLimit(`pro-email-action:${ip}`, RATE_LIMIT, RATE_WINDOW_SEC);
  if (!rl.allowed) {
    logger.warn("pro_email_action_rate_limited", { requestId, ip, count: rl.count });
    return fail("rate_limited", "Muitas tentativas. Tente de novo em alguns minutos.", 429, {
      requestId,
      headers: {
        "Retry-After": String(RATE_WINDOW_SEC),
        "X-RateLimit-Limit": String(RATE_LIMIT),
        "X-RateLimit-Remaining": "0",
      },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_request", "JSON inválido", 400, { requestId });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", "Requisição inválida", 400, { requestId });
  }

  const verified = verifyEmailActionToken(parsed.data.token);
  if (!verified.ok) {
    logger.warn("pro_email_action_token_rejected", { requestId, ip, reason: verified.reason });
    if (verified.reason === "disabled") {
      return fail("feature_disabled", "Aprovação pelo e-mail desativada", 404, { requestId });
    }
    if (verified.reason === "expired") {
      return fail("token_expired", "Este link expirou", 410, { requestId });
    }
    return fail("invalid_token", "Link inválido", 400, { requestId });
  }
  const { rid, act, amt } = verified.payload;

  const admin = createAdminClient();
  const { data: row, error: readErr } = await admin
    .from("pro_signup_requests")
    .select("id, status, buyer_name, buyer_email, amount_cents, organization_id")
    .eq("id", rid)
    .maybeSingle();

  if (readErr) {
    logger.error("pro_email_action_load_failed", { requestId, rid, details: readErr.message });
    return fail("internal_error", "Falha ao carregar o pedido", 500, { requestId });
  }
  if (!row) return fail("not_found", "Pedido não encontrado", 404, { requestId });

  if (row.status !== "pending") {
    return fail("already_decided", "Este pedido já foi decidido", 409, {
      requestId,
      details: { status: row.status, signup_id: rid },
    });
  }
  if (row.amount_cents !== amt) {
    // O valor do pedido não é o do e-mail. Não decidir às cegas.
    logger.warn("pro_email_action_amount_mismatch", { requestId, rid, ip });
    return fail("amount_mismatch", "O valor do pedido mudou desde o envio do e-mail", 409, {
      requestId,
      details: { signup_id: rid },
    });
  }

  const buyerName = row.buyer_name as string;
  const buyerEmail = row.buyer_email as string;
  const decidedAt = new Date();

  // --- Recusar -------------------------------------------------------------
  if (act === "reject") {
    const res = await rejectProSignup({
      admin,
      requestId,
      signupId: rid,
      reviewerUserId: null,
      reviewNote: "recusado pelo link do e-mail",
      via: "email_link",
      ip,
    });
    if (res.outcome === "error") {
      return res.error === "not_pending"
        ? fail("already_decided", "Este pedido já foi decidido", 409, {
            requestId,
            details: { signup_id: rid },
          })
        : fail("internal_error", res.message, 500, { requestId });
    }
    scheduleOwnerAlarm({
      requestId,
      action: "reject",
      buyerName,
      buyerEmail,
      decidedAt,
      orgName: null,
      undoUrl: absoluteSiteUrl(`/admin/pro-signups/${rid}`),
      ip,
    });
    return ok({ action: "reject", status: "rejected", signup_id: rid, buyer_name: buyerName }, { requestId });
  }

  // --- Aprovar -------------------------------------------------------------
  const result = await approveProSignup({
    admin,
    requestId,
    signupId: rid,
    reviewerUserId: null,
    chosenOrgId: null,
    via: "email_link",
    ip,
    reviewNote: "aprovado pelo link do e-mail",
    expectedAmountCents: amt,
  });

  switch (result.outcome) {
    case "ambiguous":
      return fail(
        "ambiguous_org",
        result.reason === "account_newer_than_request"
          ? "A conta com este e-mail foi criada depois do pedido — decida pelo painel"
          : "Este e-mail tem mais de uma organização — escolha no painel",
        409,
        { requestId, details: { signup_id: rid, reason: result.reason } },
      );
    case "error":
      if (result.error === "not_pending") {
        return fail("already_decided", "Este pedido já foi decidido", 409, {
          requestId,
          details: { signup_id: rid },
        });
      }
      if (result.error === "amount_mismatch" || result.error === "slug_conflict") {
        return fail(result.error, result.message, 409, { requestId, details: { signup_id: rid } });
      }
      if (result.error === "not_found") {
        return fail("not_found", result.message, 404, { requestId });
      }
      return fail("internal_error", result.message, 500, {
        requestId,
        details: { signup_id: rid },
      });
    case "approved": {
      const orgId = result.mode === "upgrade" ? result.organizationId : result.organization.id;
      const orgName =
        result.mode === "upgrade" ? result.organizationName : result.organization.display_name;
      scheduleOwnerAlarm({
        requestId,
        action: "approve",
        buyerName,
        buyerEmail,
        decidedAt,
        orgName,
        undoUrl: absoluteSiteUrl(`/admin/assinantes/${orgId}`),
        ip,
      });

      if (result.mode === "upgrade") {
        return ok(
          {
            action: "approve",
            status: "approved",
            mode: "upgrade",
            signup_id: rid,
            organization_id: orgId,
            organization_name: orgName,
            buyer_membership: result.membership,
            plan_expires_at: result.planExpiresAt,
            email_dispatched: result.emailDispatched,
            buyer_name: result.buyer.name,
            buyer_phone: result.buyer.phone,
          },
          { requestId },
        );
      }
      return ok(
        {
          action: "approve",
          status: "approved",
          mode: "create",
          signup_id: rid,
          organization_id: orgId,
          organization_name: orgName,
          plan_expires_at: result.planExpiresAt,
          existing_account: result.existingAccount,
          activation_url: result.activationUrl,
          activation_expires_at: result.activationExpiresAt,
          email_dispatched: result.emailDispatched,
          buyer_name: result.buyer.name,
          buyer_phone: result.buyer.phone,
          // Masked: the WhatsApp notice says where the activation link went,
          // without carrying the link (pendência 19) nor the full address.
          buyer_email_masked: maskEmail(result.buyer.email),
        },
        { requestId },
      );
    }
  }
}

/**
 * Owner alarm, in `after()`: the decision is already saved and the person who
 * clicked must not wait for SMTP. `void promise` is not enough on serverless —
 * the function may freeze on return and drop the send.
 */
function scheduleOwnerAlarm(args: {
  requestId: string;
  action: "approve" | "reject";
  buyerName: string;
  buyerEmail: string;
  decidedAt: Date;
  orgName: string | null;
  undoUrl: string;
  ip: string;
}) {
  after(async () => {
    try {
      const mail = buildProApprovedAlarmEmail({
        action: args.action,
        buyerName: args.buyerName,
        buyerEmail: args.buyerEmail,
        decidedAt: args.decidedAt,
        orgName: args.orgName,
        undoUrl: args.undoUrl,
        ip: args.ip,
      });
      const res = await sendEmail({
        to: ownerNotifyEmail(),
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
      if (!res.ok) {
        logger.error("pro_email_action_alarm_failed", {
          requestId: args.requestId,
          reason: res.error,
          details: res.details,
        });
      }
    } catch (err) {
      logger.error("pro_email_action_alarm_threw", {
        requestId: args.requestId,
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
