/**
 * POST /api/v1/public/orcamento/upload-slot/confirm
 *
 * Turns an uploaded path into a 7-day signed READ link — the link the visitor
 * sends to the shop on WhatsApp. The bucket is private (migration 0085), so
 * there is no public URL to fall back to.
 *
 * Guards, cumulative:
 *   1. IP rate limit.
 *   2. The path must have exactly the shape the slot endpoint generates
 *      (`<YYYYMMDDHHmm>-<uuid v4>/<sanitised name>`), so it cannot point at
 *      another bucket or folder.
 *   3. The slot must be at most 2 h old (stamp in the folder name). Without
 *      this, anyone holding a path could mint fresh 7-day links forever and
 *      use the bucket as file hosting.
 *   4. The object must exist, its STORED content type must belong to the
 *      file's extension and its first bytes must match the format
 *      (lib/orcamento/file-check.ts). The uploader picks the content type —
 *      a signed upload URL cannot bind it — so this is where it is enforced.
 *      A mismatching object is DELETED, not just refused. For .3mf the ZIP
 *      central directory must list [Content_Types].xml and a 3D/*.model part.
 *   5. The check runs on a COPY under `verified/` and the link points at that
 *      copy; the original upload path is deleted. Replacing the uploaded object
 *      after the check (x-upsert on the signed upload) no longer changes what
 *      the link serves (pendência 19).
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
  ORCAMENTO_LINK_TTL_SECONDS,
  isSlotFresh,
  orcamentoConfirmSchema,
  orcamentoKindOf,
} from "@/lib/schemas/orcamento-upload";
import { verifyAndPublishUpload } from "@/lib/orcamento/verify-upload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();

  const ip = clientIp(req);
  const rl = await checkRateLimit(`orcamento-upload-confirm:${ip}`, 20, 3600);
  if (!rl.allowed) {
    logger.warn("orcamento_upload_confirm_rate_limited", { requestId, ip, count: rl.count });
    return fail("rate_limited", "muitas tentativas, tente novamente mais tarde", 429, { requestId });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_request", "invalid_json", 400, { requestId });
  }

  const parsed = orcamentoConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", "caminho de arquivo inválido", 422, { requestId });
  }
  const { path } = parsed.data;

  if (!isSlotFresh(path, new Date())) {
    return fail("slot_expired", "o envio expirou — selecione o arquivo de novo", 410, { requestId });
  }

  const kind = orcamentoKindOf(path);
  if (!kind) {
    return fail("validation_error", "formato de arquivo não aceito", 422, { requestId });
  }

  const bucket = createAdminClient().storage.from(ORCAMENTO_BUCKET);

  // Copy to verified/ → delete the original → check the COPY → sign the copy.
  // See lib/orcamento/verify-upload.ts for why the order matters.
  const result = await verifyAndPublishUpload({
    bucket,
    path,
    kind,
    linkTtlSeconds: ORCAMENTO_LINK_TTL_SECONDS,
  });

  if (!result.ok) {
    if (result.code === "file_rejected") {
      logger.warn("orcamento_upload_rejected", { requestId, ip, kind, reason: result.reason });
      return fail(
        "file_rejected",
        `o conteúdo não corresponde a um arquivo .${kind} válido`,
        422,
        { requestId },
      );
    }
    if (result.code === "not_found") {
      logger.warn("orcamento_upload_confirm_missing", { requestId, details: result.reason });
      return fail("not_found", "arquivo não encontrado — envie novamente", 404, { requestId });
    }
    logger.error("orcamento_upload_confirm_failed", { requestId, kind, details: result.reason });
    return fail(
      "internal_error",
      result.status === 502 ? "falha ao verificar o arquivo" : "falha ao gerar o link do arquivo",
      result.status,
      { requestId },
    );
  }

  if (result.originalRemoveError) {
    logger.warn("orcamento_upload_original_not_removed", { requestId, details: result.originalRemoveError });
  }

  const expiresAt = new Date(Date.now() + ORCAMENTO_LINK_TTL_SECONDS * 1000).toISOString();
  return ok({ fileUrl: result.signedUrl, expiresAt }, { requestId });
}
