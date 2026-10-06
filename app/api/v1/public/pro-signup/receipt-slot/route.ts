/**
 * POST /api/v1/public/pro-signup/receipt-slot
 *
 * Emite uma URL assinada de upload para o comprovante do Pix, antes do pedido
 * existir e sem o comprador ter conta.
 *
 * POR QUE FUNCIONA SEM SESSÃO: `createSignedUploadUrl` devolve um token que viaja
 * na própria URL; `uploadToSignedUrl` no browser não depende de cookie. É a
 * mesma razão pela qual upload sempre funcionou neste projeto enquanto LEITURA
 * autenticada quebrava — ver docs/runbooks/sessao-do-browser.md.
 *
 * SUPERFÍCIE DE ABUSO, e o que a contém: um endpoint público que emite slot de
 * upload é, por construção, hospedagem de arquivo grátis. As defesas são
 * cumulativas — rate limit por IP, caminho gerado NO SERVIDOR (nada do corpo
 * entra nele, o que mata path traversal na origem), e MIME/tamanho impostos pelo
 * próprio bucket na migration 0081, não só por este Zod. Validação que mora só
 * na aplicação é validação contornável.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { clientIp } from "@/lib/api/client-ip";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { receiptSlotSchema, safeReceiptFilename } from "@/lib/schemas/pro-signup";
import { RECEIPT_BUCKET } from "@/lib/pro-signup/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();

  const ip = clientIp(req);
  const rl = await checkRateLimit(`pro-signup-receipt:${ip}`, 2, 3600);
  if (!rl.allowed) {
    logger.warn("pro_signup_receipt_rate_limited", { requestId, ip, count: rl.count });
    return fail("rate_limited", "muitas tentativas, tente novamente mais tarde", 429, { requestId });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_request", "invalid_json", 400, { requestId });
  }

  const parsed = receiptSlotSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", "arquivo não aceito", 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors,
    });
  }

  // O prefixo é um UUID novo gerado aqui. O nome original do arquivo só entra
  // depois da barra e já saneado — nunca pode escolher a pasta.
  const path = `${randomUUID()}/${safeReceiptFilename(parsed.data.filename)}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(RECEIPT_BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    logger.error("pro_signup_receipt_slot_failed", {
      requestId,
      details: error?.message ?? "no data",
    });
    return fail("internal_error", "falha ao preparar o envio do comprovante", 500, { requestId });
  }

  return ok({ path: data.path, token: data.token }, { status: 201, requestId });
}
