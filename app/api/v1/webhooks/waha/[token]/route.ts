/**
 * POST /api/v1/webhooks/waha/[token]
 *
 * Rota per-tenant canônica de produção: cada channel_session tem um
 * webhook_path_token único url-safe. Pipeline: lookup por token -> verifica
 * HMAC SHA512 -> loga em webhook_events_log -> dispatchWahaEvent (ingestão
 * compartilhada, ver lib/waha/ingest.ts).
 *
 * Idempotência e resolução atômica de contato/conversa vivem no módulo
 * compartilhado — este handler só faz auth + roteamento.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchWahaEvent, verifyHmacSha512, type WahaEnvelope } from "@/lib/waha/ingest";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteCtx {
  params: Promise<{ token: string }>;
}

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
  const requestId = randomUUID();
  const { token } = await ctx.params;

  if (!token || token.length < 8) {
    return fail("not_found", "unknown webhook token", 404, { requestId });
  }

  /**
   * Teto por token antes de qualquer trabalho: o WAHA reenvia em caso de 429, e
   * isto impede que um flood (forjado ou não) consuma banco e fila de ingestão.
   * 600/min cobre com folga o pico real de uma sessão de WhatsApp.
   */
  const rl = await checkRateLimit(`waha-webhook:${token}`, 600, 60);
  if (!rl.allowed) {
    return fail("rate_limited", "too_many_requests", 429, {
      requestId,
      headers: { "Retry-After": "60" },
    });
  }

  const rawBody = await req.text();
  let envelope: WahaEnvelope;
  try {
    envelope = JSON.parse(rawBody) as WahaEnvelope;
  } catch {
    return fail("invalid_request", "invalid_json", 400, { requestId });
  }

  const admin = createAdminClient();

  const { data: session, error: sessErr } = await admin
    .from("channel_sessions")
    .select(
      "id, organization_id, waha_session_name, webhook_secret_encrypted, status, is_warmup_complete, warmup_started_at",
    )
    .eq("webhook_path_token", token)
    .maybeSingle();

  if (sessErr) {
    return fail("internal_error", sessErr.message, 500, { requestId });
  }
  if (!session) {
    return fail("not_found", "unknown webhook token", 404, { requestId });
  }

  /**
   * HMAC — FAIL-CLOSED.
   *
   * A versão anterior era best-effort: se `fn_decrypt_oauth` falhasse (chave
   * rotacionada, `WAHA_BYO_ENCRYPTION_KEY` errada, RPC ausente num clone
   * self-host, segredo nulo), ela setava `hmacSkipped` e **aceitava o webhook sem
   * assinatura** — bastava conhecer o `webhook_path_token` para injetar mensagem
   * arbitrária no inbox do tenant. E gravava `valid_signature: true` no log, o
   * que apagava o rastro de que nada tinha sido verificado.
   *
   * Agora: sem segredo utilizável, ninguém entra. Indisponibilidade da cripto é
   * 503 (problema nosso, o WAHA reenvia), assinatura errada é 401.
   */
  const sigHeader = req.headers.get("x-webhook-hmac") ?? req.headers.get("X-Webhook-Hmac");

  if (!session.webhook_secret_encrypted) {
    await audit({
      action: "waha.webhook_hmac_unavailable",
      organizationId: session.organization_id,
      requestId,
      metadata: {
        provider: "waha",
        session: session.waha_session_name,
        reason: "missing_webhook_secret",
      },
    });
    return fail("service_unavailable", "webhook_secret_not_configured", 503, { requestId });
  }

  let secret: string | null = null;
  try {
    const dec = await admin.rpc("fn_decrypt_oauth", {
      ciphertext: session.webhook_secret_encrypted,
    });
    if (!dec.error && dec.data) secret = dec.data as string;
  } catch {
    secret = null;
  }

  if (!secret) {
    await audit({
      action: "waha.webhook_hmac_unavailable",
      organizationId: session.organization_id,
      requestId,
      metadata: { provider: "waha", session: session.waha_session_name, reason: "decrypt_failed" },
    });
    return fail("service_unavailable", "webhook_secret_undecryptable", 503, { requestId });
  }

  const validSignature = verifyHmacSha512(rawBody, sigHeader, secret);
  if (!validSignature) {
    await audit({
      action: "waha.webhook_invalid_signature",
      organizationId: session.organization_id,
      requestId,
      metadata: { provider: "waha", session: session.waha_session_name, event: envelope.event },
    });
    return fail("unauthenticated", "invalid_signature", 401, { requestId });
  }

  const eventType = envelope.event ?? "unknown";
  const externalId = envelope.payload?.id ?? null;

  const headersJson: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (key.toLowerCase().startsWith("authorization")) return;
    if (key.toLowerCase() === "cookie") return;
    headersJson[key] = value;
  });
  await admin.from("webhook_events_log").insert({
    organization_id: session.organization_id,
    channel_session_id: session.id,
    provider: "waha",
    webhook_path_token: token,
    http_method: "POST",
    headers: headersJson,
    raw_body: rawBody,
    payload_parsed: envelope as unknown as Record<string, unknown>,
    signature_header: sigHeader ?? null,
    // O fato, não uma conveniência: só chega aqui quem passou pelo HMAC.
    valid_signature: validSignature,
    event_type: eventType,
    external_id: externalId,
    status: "received",
    attempts: 0,
  });

  try {
    await dispatchWahaEvent(admin, session, envelope, requestId);
  } catch (err) {
    console.error("[waha.webhook] handler failed", err);
  }

  return ok({ accepted: true }, { requestId });
}
