/**
 * POST /api/v1/public/signup
 *
 * Auto-cadastro com trial de 7 dias. Cria usuário, organização própria e
 * membership de admin, e já devolve a sessão aberta.
 *
 * Route Handler e não Server Action: `/api/v1/public/` já está liberado no
 * middleware, `checkRateLimit` precisa do IP do request, e o envelope
 * `ok()`/`fail()` é contrato de rota. Server Action numa página pública é POST
 * no path de uma *página* — ver o comentário em `lib/auth/public-paths.ts`.
 *
 * Doutrina do service role: nada do corpo vira `organization_id`. A org é criada
 * aqui e o id sai do INSERT, nunca da requisição.
 *
 * RISCOS ASSUMIDOS POR DECISÃO DE PRODUTO (sem confirmação de e-mail):
 *   (a) e-mail descartável cria org grátis — mitigado por rate limit e honeypot;
 *   (b) quem digita o e-mail errado perde o acesso — mitigado pelo reset de
 *       senha, que vai nesta mesma entrega;
 *   (c) ninguém prova posse do endereço, então ele não serve de canal de
 *       recuperação forte.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { clientIp } from "@/lib/api/client-ip";
import { audit } from "@/lib/audit";
import { emailDigest } from "@/lib/audit/email-digest";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { signupSchema, MIN_SIGNUP_ELAPSED_MS } from "@/lib/schemas/signup";
import { createTenant } from "@/lib/tenants/createTenant";
import { slugify } from "@/lib/text/slugify";
import { slugCandidates, trialEndsAtFrom } from "@/lib/tenants/trial";
import { getTrialDaysLive } from "@/lib/pricing/settings";
import { sendEmail } from "@/lib/email/send";
import { buildTrialStartedEmail } from "@/lib/email/templates/trial-started";

import { ownerNotifyEmail } from "@/lib/email/owner";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Para onde o recém-cadastrado é levado. Rota LIVRE — `/app/inbox` é PRO. */
const LANDING_ROUTE = "/app/dashboard";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();

  // 5 cadastros por hora por IP.
  //
  // ATENÇÃO: sem UPSTASH_REDIS_REST_URL o checkRateLimit cai para um contador em
  // memória, que em serverless é POR INSTÂNCIA — praticamente sem limite. E aqui
  // o abuso não gera só e-mail: cria `auth.users` e `organizations`. Redis é
  // pré-requisito de produção nesta rota.
  const ip = clientIp(req);
  const rl = await checkRateLimit(`signup:${ip}`, 5, 3600);
  if (!rl.allowed) {
    logger.warn("signup_rate_limited", { requestId, ip, count: rl.count, limit: rl.limit });
    return fail("rate_limited", "muitas tentativas, tente novamente mais tarde", 429, { requestId });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_request", "invalid_json", 400, { requestId });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", "dados inválidos", 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const input = parsed.data;

  // Honeypot e tempo de preenchimento. Respondemos como se tivesse dado certo:
  // dizer "você é um bot" só ensina o bot a contornar.
  const tooFast = input.elapsed_ms !== undefined && input.elapsed_ms < MIN_SIGNUP_ELAPSED_MS;
  if (input.website || tooFast) {
    logger.warn("signup_bot_rejected", { requestId, ip, reason: input.website ? "honeypot" : "too_fast" });
    return ok({ redirect_to: LANDING_ROUTE }, { status: 201, requestId });
  }

  const admin = createAdminClient();

  // 1) Usuário. `email_confirm: true` materializa a decisão de não exigir
  // confirmação — ver o cabeçalho deste arquivo.
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (userErr || !created.user) {
    // Colisão de e-mail devolve 409 explícito. Isso É enumeração de contas, e é
    // uma troca consciente: num formulário de CADASTRO, esconder a colisão
    // produz um formulário que "não faz nada" e mata a conversão. A mitigação é
    // o rate limit acima. Não "corrija" isto sem ler esta linha.
    const msg = userErr?.message ?? "";
    if (/already|registered|exists/i.test(msg)) {
      return fail("email_in_use", "Este e-mail já tem conta. Entre pelo login.", 409, { requestId });
    }
    logger.error("signup_create_user_failed", { requestId, details: msg });
    return fail("internal_error", "não consegui criar sua conta", 500, { requestId });
  }

  const userId = created.user.id;
  // Trial length from platform_settings (editable by the platform admin).
  const trialDays = await getTrialDaysLive();
  const trialEndsAt = trialEndsAtFrom(new Date(), trialDays);

  // 2) Organização. Tenta alguns slugs: o índice único do banco é a autoridade.
  let org: { id: string; slug: string; display_name: string } | null = null;
  let lastError = "";
  for (const candidate of slugCandidates(slugify(input.display_name))) {
    const res = await createTenant(admin, {
      display_name: input.display_name,
      slug: candidate,
      // `plan: 'standard'` + `trial_ends_at`: o trial é uma JANELA sobre o plano
      // gratuito, não um plano. Gravar 'pro' faria o usuário virar "PRO
      // expirado" no 8º dia e confundiria badge, copy e renovação.
      plan: "standard",
      trialEndsAt,
      createdBy: userId,
      // Load-bearing: sem isto `loadAppShellContext` desvia para
      // /onboarding/connect-whatsapp, um beco sem saída para quem só quer testar.
      markOnboarded: true,
    });
    if (res.ok) {
      org = res.org;
      break;
    }
    lastError = res.message;
    if (res.code !== "slug_conflict") break;
  }

  if (!org) {
    await rollbackUser(admin, userId, requestId);
    logger.error("signup_create_org_failed", { requestId, details: lastError });
    return fail("internal_error", "não consegui criar seu espaço", 500, { requestId });
  }

  // 3) Membership de admin.
  const nowIso = new Date().toISOString();
  const { error: memberErr } = await admin.from("user_organizations").insert({
    user_id: userId,
    organization_id: org.id,
    role: "admin",
    invited_at: nowIso,
    accepted_at: nowIso,
  });

  if (memberErr) {
    // Não há transação cobrindo auth.admin + PostgREST. Compensação best-effort;
    // se ela também falhar, os dois ids ficam no log para conserto manual.
    await admin.from("organizations").delete().eq("id", org.id);
    await rollbackUser(admin, userId, requestId);
    logger.error("signup_membership_failed", {
      requestId,
      userId,
      organizationId: org.id,
      details: memberErr.message,
    });
    return fail("internal_error", "não consegui finalizar seu cadastro", 500, { requestId });
  }

  await audit({
    action: "signup.trial_started",
    actorUserId: userId,
    organizationId: org.id,
    resourceType: "organization",
    resourceId: org.id,
    requestId,
    ip,
    userAgent: req.headers.get("user-agent"),
    bypassedRls: true,
    metadata: {
      plan: "standard",
      trial_days: trialDays,
      trial_ends_at: trialEndsAt,
      slug: org.slug,
      email_hash: emailDigest(input.email),
    },
  });

  // 4) Sessão aberta. Sem isto a pessoa cairia na tela de login logo depois de
  // escolher a senha.
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (signInErr) {
    // A conta existe e está liberada; só a sessão não subiu. Degradar para o
    // login é aceitável — o que não pode é dizer que o cadastro falhou.
    logger.warn("signup_signin_failed", { requestId, details: signInErr.message });
    return ok({ organization_id: org.id, redirect_to: "/login" }, { status: 201, requestId });
  }

  after(async () => {
    const mail = buildTrialStartedEmail({
      displayName: org.display_name,
      email: input.email,
      trialEndsAt: new Date(trialEndsAt),
      trialDays,
    });
    try {
      const res = await sendEmail({
        to: ownerNotifyEmail(),
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        replyTo: input.email,
      });
      if (!res.ok) {
        logger.error("signup_notify_failed", { requestId, reason: res.error, details: res.details });
      }
    } catch (err) {
      logger.error("signup_notify_threw", {
        requestId,
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return ok({ organization_id: org.id, redirect_to: LANDING_ROUTE }, { status: 201, requestId });
}

/** Compensação best-effort: nunca lança, sempre registra. */
async function rollbackUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  requestId: string,
): Promise<void> {
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch (err) {
    logger.error("signup_rollback_failed", {
      requestId,
      userId,
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
