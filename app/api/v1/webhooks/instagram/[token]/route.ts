/**
 * Webhook da Meta para o Instagram — Direct, comentários e menções.
 *
 * NÃO CONFUNDIR com `/api/v1/public/instagram-webhook`, que já existe e é outra
 * coisa: um gancho de Zapier/Make que dispara newsletter por e-mail quando você
 * publica. Nome parecido, propósito oposto. Este aqui fala com a Graph API.
 *
 * DUAS CAMADAS DE AUTENTICAÇÃO, e as duas são necessárias:
 *
 *   1. `webhook_path_token` no CAMINHO resolve QUAL conta recebeu. Fica no path
 *      e não em query string porque query string vaza em log de proxy e de CDN.
 *   2. `X-Hub-Signature-256` prova que o corpo veio da Meta. Sem ela, quem
 *      descobrisse a URL injetaria comentário e DM falsos — e o robô responderia,
 *      o lead entraria no CRM e a automação dispararia. Foi exatamente o defeito
 *      que o webhook do WAHA já teve neste projeto: token no caminho sem
 *      assinatura bastava para injetar mensagem.
 *
 * O CORPO É LIDO CRU (`req.text()`), nunca `req.json()`. A Meta assina os BYTES;
 * reserializar muda espaçamento e ordem, e a comparação falha. Há teste travando
 * isso em `lib/instagram/signature.test.ts`.
 *
 * NADA É ENVIADO DAQUI. O handler grava e emite evento; um worker consome e
 * chama a Meta. É a regra dura do CLAUDE.md (nada de HTTP dentro da transação) e
 * é o que dá reprocessamento quando a Meta devolve erro — além de manter a
 * resposta rápida, que a Meta exige sob pena de reentrega.
 */

import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { answerVerificationChallenge, verifyMetaSignature } from "@/lib/instagram/signature";
import { isActionable, normalizeWebhookPayload } from "@/lib/instagram/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ token: string }>;
}

interface AccountRow {
  id: string;
  organization_id: string;
  ig_user_id: string;
  webhook_verify_token: string;
  status: string;
}

/** Resolve a conta pelo token do caminho. Service role: não há sessão aqui. */
async function findAccount(token: string): Promise<AccountRow | null> {
  if (!/^[a-f0-9]{32}$/i.test(token)) return null; // formato do default da 0079
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("instagram_accounts")
    .select("id, organization_id, ig_user_id, webhook_verify_token, status")
    .eq("webhook_path_token", token)
    .maybeSingle();
  return (data as AccountRow | null) ?? null;
}

/**
 * GET — o desafio de verificação da Meta, feito uma vez na configuração.
 *
 * Responde `hub.challenge` como TEXTO PURO. A Meta compara byte a byte; JSON
 * aqui faz a verificação falhar com uma mensagem que não explica nada.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const account = await findAccount(token);
  if (!account) return new NextResponse("not found", { status: 404 });

  const challenge = answerVerificationChallenge(
    req.nextUrl.searchParams,
    account.webhook_verify_token,
  );
  if (challenge === null) return new NextResponse("forbidden", { status: 403 });

  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const requestId = randomUUID();
  const { token } = await ctx.params;

  // Corpo CRU antes de qualquer parsing — é o que a Meta assinou.
  const rawBody = await req.text();

  const account = await findAccount(token);
  if (!account) {
    return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  }

  const appSecret = env.META_APP_SECRET;
  if (!appSecret) {
    // Falha FECHADO. Sem App Secret não há como distinguir a Meta de um
    // estranho, e aceitar "porque ainda não configurei" é como o endpoint vira
    // porta aberta em produção.
    return NextResponse.json(
      { error: { code: "webhook_not_configured", message: "META_APP_SECRET ausente." } },
      { status: 503 },
    );
  }

  if (!verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"), appSecret)) {
    return NextResponse.json({ error: { code: "invalid_signature" } }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: { code: "invalid_json" } }, { status: 400 });
  }

  const eventos = normalizeWebhookPayload(payload).filter(isActionable);
  const supabase = createAdminClient();
  let aceitos = 0;

  for (const evento of eventos) {
    // O evento vem para a conta que o token resolveu. Se o `recipientIgId` não
    // bate, o payload é de outro perfil — sinal de token reaproveitado ou de
    // assinatura de outro app. Descartar é mais seguro que adivinhar.
    if (evento.recipientIgId && evento.recipientIgId !== account.ig_user_id) continue;

    // Grava o evento na fila. O worker é quem decide o que fazer: responder,
    // casar regra de automação, acionar a IA. A idempotência real acontece
    // adiante, em `messages_org_external_id_unique`.
    const { error } = await supabase.from("event_log").insert({
      organization_id: account.organization_id,
      event_type: `instagram.${evento.kind}`,
      entity_kind: "instagram_account",
      entity_id: account.id,
      payload: {
        ...evento,
        accountId: account.id,
        requestId,
      },
    });

    // Um evento que falha não pode derrubar o lote: a Meta reentrega o POST
    // inteiro, e os que já entraram virariam duplicata.
    if (!error) aceitos += 1;
  }

  // 200 sempre que a assinatura confere, mesmo sem evento acionável. A Meta
  // reentrega em qualquer coisa fora de 2xx, e reentrega de evento que já foi
  // processado é ruído — ou pior, duplicata se a idempotência falhar.
  return NextResponse.json({ data: { received: eventos.length, queued: aceitos } });
}
