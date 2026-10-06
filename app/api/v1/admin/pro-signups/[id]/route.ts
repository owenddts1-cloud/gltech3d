/**
 * GET    /api/v1/admin/pro-signups/:id — um pedido, com URL assinada do comprovante.
 * PATCH  /api/v1/admin/pro-signups/:id — rejeitar um pedido pendente.
 *
 * Platform admin apenas.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/wrappers";
import { clientIp } from "@/lib/api/client-ip";
import { rejectProSignup } from "@/lib/pro-signup/approve";
import { logger } from "@/lib/logger";
import { RECEIPT_BUCKET } from "@/lib/pro-signup/constants";

const SELECT_COLUMNS =
  "id, status, plan, buyer_name, buyer_email, buyer_phone, company_name, amount_cents, currency, pix_txid, declared_paid_at, receipt_storage_path, organization_id, reviewed_at, review_note, invited_user_email, request_ip, created_at";

/** O comprovante é privado. A URL assinada é curta e emitida só para o admin. */
const RECEIPT_URL_TTL_SECONDS = 60 * 10;

const patchSchema = z
  .object({
    action: z.literal("reject"),
    review_note: z.string().trim().max(500).optional(),
  })
  .strict();

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  const { id } = await ctx.params;

  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403, { requestId });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pro_signup_requests")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return fail("internal_error", "Failed to load signup", 500, { requestId, details: error.message });
  }
  if (!data) {
    return fail("not_found", "Pedido não encontrado", 404, { requestId });
  }

  // A leitura do comprovante acontece NO SERVIDOR. Tentar baixá-lo com o client
  // do browser devolveria lista/objeto vazio em silêncio — o cookie é httpOnly e
  // o client do browser sai como `anon`. Ver docs/runbooks/sessao-do-browser.md.
  let receiptUrl: string | null = null;
  const path = data.receipt_storage_path as string | null;
  if (path) {
    const { data: signed, error: signErr } = await admin.storage
      .from(RECEIPT_BUCKET)
      .createSignedUrl(path, RECEIPT_URL_TTL_SECONDS);
    if (signErr) {
      // Não derruba a tela: o resto do pedido ainda precisa ser visível para
      // decidir. Mas o erro tem de aparecer no log, não sumir.
      logger.error("pro_signup_receipt_sign_failed", { requestId, id, details: signErr.message });
    }
    receiptUrl = signed?.signedUrl ?? null;
  }

  return ok({ ...data, receipt_url: receiptUrl }, { requestId });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  const { id } = await ctx.params;

  let adminCtx: Awaited<ReturnType<typeof requirePlatformAdmin>>;
  try {
    adminCtx = await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403, { requestId });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("validation_error", "Invalid JSON body", 400, { requestId });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", "Invalid request body", 400, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  const result = await rejectProSignup({
    admin: createAdminClient(),
    requestId,
    signupId: id,
    reviewerUserId: adminCtx.user.id,
    reviewNote: parsed.data.review_note || null,
    via: "panel",
    ip: clientIp(req),
  });

  if (result.outcome === "error") {
    return result.error === "not_pending"
      ? fail("conflict", result.message, 409, { requestId })
      : fail("internal_error", result.message, 500, { requestId });
  }

  return ok({ id, status: "rejected" }, { requestId });
}
