/**
 * POST /api/v1/public/leads
 *
 * Public (unauthenticated) landing lead-capture + newsletter signup. Pipeline:
 * rate-limit by IP -> validate (Zod) -> resolve GLTech org (trusted source) ->
 * insert into `contacts` via service-role admin client -> best-effort notify
 * the directorate + welcome the lead (email + WhatsApp) -> audit.
 *
 * Every external side-effect (email, WhatsApp) degrades gracefully: the lead is
 * always saved even when Resend/WAHA are unconfigured. `organization_id` comes
 * from a trusted resolver, NEVER from the request body (admin-client doctrine).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { resolveGltechOrgId } from "@/lib/marketing/gltech-org";
import { landingLeadSchema, normalizeBrPhone } from "@/lib/schemas/public-leads";
import { sendEmail } from "@/lib/email/resend";
import { buildLeadNotifyEmail } from "@/lib/email/templates/lead-notify";
import { buildLeadWelcomeEmail } from "@/lib/email/templates/lead-welcome";
import { buildNewsletterWelcomeEmail } from "@/lib/email/templates/newsletter-welcome";
import { sendWAHA, resolveWahaChatId } from "@/lib/waha/send";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DIRETORIA_EMAIL = "diretoria.gltech@gmail.com";
const WHATSAPP_URL = "https://wa.me/5531999284834";

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();

  // Rate limit: 5 submissions / minute / IP (in-memory fallback if no Redis).
  const ip = clientIp(req);
  const rl = await checkRateLimit(`public-leads:${ip}`, 5, 60);
  if (!rl.allowed) {
    return fail("rate_limited", "muitas tentativas, tente novamente em instantes", 429, {
      requestId,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_request", "invalid_json", 400, { requestId });
  }

  const parsed = landingLeadSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", "dados inválidos", 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const input = parsed.data;

  const admin = createAdminClient();

  const orgId = await resolveGltechOrgId(admin);
  if (!orgId) {
    return fail("unavailable", "cadastro temporariamente indisponível", 503, { requestId });
  }

  const isNewsletter = input.type === "newsletter";
  const phoneE164 = normalizeBrPhone(input.phone);

  const { data: contact, error: insErr } = await admin
    .from("contacts")
    .insert({
      organization_id: orgId,
      created_by_user_id: null,
      name: input.name ?? null,
      email: input.email,
      phone_number: phoneE164,
      source: isNewsletter ? "newsletter" : "landing",
      source_metadata: { channel: "landing_page", ip },
      tags: isNewsletter ? ["newsletter"] : ["lead", "landing"],
      consent: input.consent ? { landing: true, at: new Date().toISOString() } : {},
    })
    .select("id")
    .single();

  if (insErr || !contact) {
    return fail("internal_error", insErr?.message ?? "falha ao salvar", 500, { requestId });
  }

  await audit({
    action: "lead.captured",
    organizationId: orgId,
    resourceType: "contact",
    resourceId: contact.id as string,
    requestId,
    ip,
    userAgent: req.headers.get("user-agent"),
    bypassedRls: true,
    metadata: { type: input.type, has_phone: !!phoneE164 },
  });

  // --- Best-effort side-effects (never block the response) --------------------
  const createdAt = new Date();

  // 1) Notify the directorate.
  const notify = buildLeadNotifyEmail({
    type: input.type,
    name: input.name,
    email: input.email,
    phone: phoneE164,
    createdAt,
  });
  void sendEmail({
    to: DIRETORIA_EMAIL,
    subject: notify.subject,
    html: notify.html,
    text: notify.text,
    replyTo: input.email,
  });

  // 2) Welcome the lead or newsletter subscriber.
  if (isNewsletter) {
    const welcome = buildNewsletterWelcomeEmail({ email: input.email });
    void sendEmail({
      to: input.email,
      subject: welcome.subject,
      html: welcome.html,
      text: welcome.text,
    });
  } else {
    const welcome = buildLeadWelcomeEmail({ name: input.name, whatsappUrl: WHATSAPP_URL });
    void sendEmail({
      to: input.email,
      subject: welcome.subject,
      html: welcome.html,
      text: welcome.text,
    });

    // 3) WhatsApp welcome — best-effort, only if a WORKING session + phone exist.
    if (phoneE164) {
      void sendWhatsappWelcome(admin, orgId, phoneE164, input.name);
    }
  }

  // 4) WhatsApp notification to director — best-effort.
  void sendWhatsappNotificationToDirector(
    admin,
    orgId,
    input.name ?? "Interessado(a)",
    input.email,
    phoneE164 ?? "",
    input.type
  );

  return ok(
    { received: true, type: input.type },
    { status: 201, requestId },
  );
}

/**
 * Sends a WhatsApp welcome via the org's WORKING WAHA session. Returns silently
 * on any missing config/error — this is a nice-to-have, never fatal.
 */
async function sendWhatsappWelcome(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  phoneE164: string,
  name?: string | null,
): Promise<void> {
  try {
    const { data: session } = await admin
      .from("channel_sessions")
      .select("waha_session_name")
      .eq("organization_id", orgId)
      .eq("status", "WORKING")
      .limit(1)
      .maybeSingle();

    const sessionName = session?.waha_session_name as string | undefined;
    if (!sessionName) return;

    const chatId = resolveWahaChatId({
      isGroup: false,
      groupChatId: null,
      phoneNumber: phoneE164,
      waIdentity: null,
    });
    if (!chatId) return;

    const first = (name ?? "").trim().split(/\s+/)[0] || "";
    const text =
      `Olá${first ? `, ${first}` : ""}! Aqui é a GLTech3D 🚀\n\n` +
      "Recebemos seu contato pelo nosso site e já vamos te atender. " +
      "Transformamos arquivos 3D em peças reais com acabamento premium, feitas no Brasil. " +
      "Como podemos te ajudar?";

    await sendWAHA({ sessionName, chatId, text });
  } catch {
    // best-effort; ignore
  }
}

/**
 * Sends a WhatsApp notification to the director (31999284834) via the active WAHA session.
 */
async function sendWhatsappNotificationToDirector(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  leadName: string,
  leadEmail: string,
  leadPhone: string,
  leadType: "lead" | "newsletter",
): Promise<void> {
  try {
    const { data: session } = await admin
      .from("channel_sessions")
      .select("waha_session_name")
      .eq("organization_id", orgId)
      .eq("status", "WORKING")
      .limit(1)
      .maybeSingle();

    const sessionName = session?.waha_session_name as string | undefined;
    if (!sessionName) return;

    // Director's WhatsApp number in E.164 format with WAHA suffix
    const chatId = "5531999284834@c.us";

    const text =
      `🔔 *Novo Lead Capturado!* 🚀\n\n` +
      `*Tipo:* ${leadType === "newsletter" ? "Inscrição na Newsletter" : "Formulário de Contato"}\n` +
      `*Nome:* ${leadName}\n` +
      `*E-mail:* ${leadEmail}\n` +
      `*WhatsApp:* ${leadPhone || "Não informado"}\n\n` +
      `Acesse o painel do DeskcommCRM para gerenciar.`;

    await sendWAHA({ sessionName, chatId, text });
  } catch (err) {
    console.error("[whatsapp-director-notify] failed", err);
  }
}
