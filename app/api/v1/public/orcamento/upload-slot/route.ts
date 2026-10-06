/**
 * POST /api/v1/public/orcamento/upload-slot
 *
 * Issues a signed upload URL for the 3D model a visitor attaches on the public
 * quote page (/orcamento). No account, no session: the token travels in the URL
 * and `uploadToSignedUrl` in the browser does not depend on cookies (same
 * design as /api/v1/public/pro-signup/receipt-slot).
 *
 * ABUSE SURFACE: a public endpoint that hands out upload slots is free file
 * hosting by construction. Defences are cumulative — IP rate limit, path
 * generated HERE (nothing from the body chooses the folder, which kills path
 * traversal at the source), extension allowlist, and MIME/size enforced by the
 * bucket itself (migration 0085), not only by this Zod.
 *
 * After the upload the browser calls ./confirm to get the 7-day read link.
 *
 * `contentType` in the response is the MIME the browser must upload with. It
 * cannot be bound to the signed URL (Supabase does not support it), so it is a
 * contract for honest clients; ./confirm verifies the stored type and the magic
 * bytes and deletes what does not match.
 *
 * RATE LIMIT: `checkRateLimit` uses Upstash when configured and an in-memory
 * counter per instance otherwise (see docs/runbooks/pendencias-em-aberto.md).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { clientIp } from "@/lib/api/client-ip";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import {
  ORCAMENTO_BUCKET,
  buildSlotPath,
  orcamentoUploadSlotSchema,
  resolveOrcamentoContentType,
} from "@/lib/schemas/orcamento-upload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();

  const ip = clientIp(req);
  const rl = await checkRateLimit(`orcamento-upload-slot:${ip}`, 10, 3600);
  if (!rl.allowed) {
    logger.warn("orcamento_upload_slot_rate_limited", { requestId, ip, count: rl.count });
    return fail("rate_limited", "muitos envios, tente novamente mais tarde", 429, { requestId });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_request", "invalid_json", 400, { requestId });
  }

  const parsed = orcamentoUploadSlotSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", "arquivo não aceito (máximo 50 MB)", 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const contentType = resolveOrcamentoContentType(parsed.data.filename, parsed.data.contentType);
  if (!contentType) {
    return fail(
      "validation_error",
      "formato não aceito: envie STL, 3MF, OBJ, STEP, imagem ou PDF",
      422,
      { requestId },
    );
  }

  // Folder = issuance stamp + fresh UUID, generated here. The original name
  // only enters after the slash, already sanitised — it can never choose the
  // folder. The stamp lets ./confirm refuse links for slots older than 2 h.
  const path = buildSlotPath(parsed.data.filename, randomUUID(), new Date());

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(ORCAMENTO_BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    logger.error("orcamento_upload_slot_failed", {
      requestId,
      details: error?.message ?? "no data",
    });
    return fail("internal_error", "falha ao preparar o envio do arquivo", 500, { requestId });
  }

  return ok(
    { path: data.path, token: data.token, signedUrl: data.signedUrl, contentType },
    { status: 201, requestId },
  );
}
