import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { clientIp } from "@/lib/api/client-ip";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { resolveGltechOrgId } from "@/lib/marketing/gltech-org";
import { sendEmail } from "@/lib/email/send";
import { buildNewsletterWelcomeEmail } from "@/lib/email/templates/newsletter-welcome";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(200),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();
  const ip = clientIp(req);

  // Rate limit: 5 tentativas por minuto por IP
  const rl = await checkRateLimit(`newsletter-ip:${ip}`, 5, 60);
  if (!rl.allowed) {
    return fail("rate_limited", "Muitas tentativas. Tente novamente em alguns instantes.", 429, { requestId });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_request", "Corpo da requisição inválido (JSON esperado).", 400, { requestId });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", parsed.error.issues[0]?.message ?? "E-mail inválido", 422, { requestId });
  }

  const email = parsed.data.email;
  const admin = createAdminClient();
  const orgId = await resolveGltechOrgId(admin);

  if (!orgId) {
    return fail("unavailable", "Serviço temporariamente indisponível.", 503, { requestId });
  }

  // Verificar se o contato já existe
  const { data: existingContact } = await admin
    .from("contacts")
    .select("id, tags")
    .eq("organization_id", orgId)
    .eq("email", email)
    .maybeSingle();

  const isAlreadySubscribed = existingContact && Array.isArray(existingContact.tags) && existingContact.tags.includes("newsletter");

  if (isAlreadySubscribed) {
    // Retorna sucesso amigável sem reenviar o e-mail duplicado
    return ok(
      {
        subscribed: true,
        alreadySubscribed: true,
        message: "Você já está cadastrado em nossa newsletter!",
      },
      { requestId },
    );
  }

  let contactId = existingContact?.id;

  if (existingContact) {
    // Atualiza adicionando a tag newsletter caso não tivesse
    const currentTags = Array.isArray(existingContact.tags) ? existingContact.tags : [];
    const newTags = Array.from(new Set([...currentTags, "newsletter"]));
    await admin
      .from("contacts")
      .update({ tags: newTags, updated_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("id", existingContact.id);
  } else {
    // Insere novo contato
    const { data: newContact, error: insErr } = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        email,
        source: "newsletter",
        source_metadata: { channel: "landing_page", ip },
        tags: ["newsletter"],
        consent: { newsletter: true, at: new Date().toISOString() },
      })
      .select("id")
      .single();

    if (insErr && insErr.code !== "23505") {
      logger.error("newsletter_insert_failed", { requestId, error: insErr.message });
      return fail("internal_error", "Falha ao salvar inscrição.", 500, { requestId });
    }

    contactId = (newContact as { id: string } | null)?.id;
  }

  await audit({
    action: "contact.created",
    organizationId: orgId,
    resourceType: "contact",
    resourceId: contactId ?? email,
    requestId,
    ip,
    userAgent: req.headers.get("user-agent"),
    bypassedRls: true,
    metadata: { email },
  });

  // Disparo do e-mail de boas-vindas com after() para não bloquear a resposta HTTP
  after(async () => {
    try {
      const welcome = buildNewsletterWelcomeEmail({ email });
      const res = await sendEmail({
        to: email,
        subject: welcome.subject,
        html: welcome.html,
        text: welcome.text,
      });
      if (!res.ok) {
        logger.error("newsletter_welcome_email_failed", { requestId, error: res.error });
      }
    } catch (err) {
      logger.error("newsletter_welcome_email_threw", {
        requestId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return ok(
    {
      subscribed: true,
      alreadySubscribed: false,
      message: "Inscrição confirmada com sucesso! Confira sua caixa de entrada.",
    },
    { requestId, status: 201 },
  );
}
