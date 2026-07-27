/**
 * POST /api/v1/public/instagram-webhook
 *
 * Receives notifications about new Instagram posts (e.g. from Make.com or Zapier)
 * and broadcasts an email newsletter to all contacts tagged with 'newsletter'.
 */
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { fail, ok } from "@/lib/api/wrappers";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveGltechOrgId } from "@/lib/marketing/gltech-org";
import { sendBatchEmails } from "@/lib/email/resend";
import { buildInstagramPostEmail } from "@/lib/email/templates/instagram-post";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Comparação de segredo em tempo constante, sem vazar o tamanho por exceção. */
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const webhookSchema = z.object({
  postUrl: z.string().url(),
  imageUrl: z.string().url().optional().nullable(),
  caption: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const secretHeader = req.headers.get("x-instagram-webhook-secret");
  const secretEnv = env.INSTAGRAM_WEBHOOK_SECRET;

  // 1) Verify authorization secret to prevent unauthorized email blasts.
  if (!secretEnv) {
    console.warn("[instagram-webhook] INSTAGRAM_WEBHOOK_SECRET is not configured in env variables.");
    return fail(
      "UNCONFIGURED",
      "Webhook secret is unconfigured on the server",
      500,
      { requestId }
    );
  }

  if (!secretMatches(secretHeader, secretEnv)) {
    return fail(
      "UNAUTHORIZED",
      "Unauthorized: Invalid webhook secret token",
      401,
      { requestId }
    );
  }

  /**
   * Rate limit — esta rota dispara `sendBatchEmails` para TODA a base marcada
   * como `newsletter`. Sem teto, um segredo vazado (ele trafega por Make.com /
   * Zapier) vira amplificador de spam e queima a reputação do domínio no Resend.
   * O disparo é por post, então 3 por hora é folgado para o uso real.
   */
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await checkRateLimit(`instagram-webhook:${ip}`, 3, 3600);
  if (!rl.allowed) {
    return fail("rate_limited", "Too many broadcast requests", 429, {
      requestId,
      headers: { "Retry-After": "3600" },
    });
  }

  // 2) Parse and validate body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("BAD_REQUEST", "Malformed JSON body", 400, { requestId });
  }

  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Validation error",
      422,
      {
        requestId,
        details: parsed.error.flatten().fieldErrors,
      }
    );
  }

  const input = parsed.data;

  // 3) Initialize admin Supabase client and resolve GLTech organization context.
  const admin = createAdminClient();
  const orgId = await resolveGltechOrgId(admin);

  if (!orgId) {
    return fail(
      "INTERNAL_ERROR",
      "Could not resolve organization context for GLTech",
      500,
      { requestId }
    );
  }

  // 4) Fetch all contacts tagged with 'newsletter' for the resolved organization.
  const { data: contacts, error: fetchError } = await admin
    .from("contacts")
    .select("email, name")
    .eq("organization_id", orgId)
    .contains("tags", ["newsletter"]);

  if (fetchError) {
    console.error("[instagram-webhook] failed to fetch newsletter contacts:", fetchError);
    return fail(
      "DATABASE_ERROR",
      "Database query failed",
      500,
      { requestId }
    );
  }

  if (!contacts || contacts.length === 0) {
    return ok({
      success: true,
      message: "No newsletter subscribers found.",
      recipientCount: 0,
    });
  }

  // 5) Build the template & broadcast email alerts (best-effort asynchronously).
  const emailTemplate = buildInstagramPostEmail({
    postUrl: input.postUrl,
    imageUrl: input.imageUrl,
    caption: input.caption,
  });

  const batchPayload = contacts.map((contact) => ({
    to: contact.email,
    subject: emailTemplate.subject,
    html: emailTemplate.html,
    text: emailTemplate.text,
  }));

  const { successCount, results } = await sendBatchEmails(batchPayload);

  // Log action to audit pipeline
  void audit({
    action: "instagram.broadcast",
    organizationId: orgId,
    resourceType: "contacts",
    resourceId: orgId,
    requestId,
    metadata: {
      postUrl: input.postUrl,
      totalSubscribers: contacts.length,
      successCount,
      failedCount: contacts.length - successCount,
    },
  });

  return ok({
    success: true,
    message: `Broadcast complete. Sent ${successCount}/${contacts.length} emails successfully.`,
    recipientCount: contacts.length,
    successCount,
  });
}
