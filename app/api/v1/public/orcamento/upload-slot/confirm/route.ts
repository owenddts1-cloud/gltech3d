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
 *      A mismatching object is DELETED, not just refused.
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
import {
  SNIFF_BYTES,
  checkOrcamentoFile,
  readHead,
  totalSizeFromHeaders,
} from "@/lib/orcamento/file-check";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Validity of the internal link used only to read the first bytes. */
const SNIFF_LINK_TTL_SECONDS = 60;

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

  // Read only the first bytes through a short-lived signed URL. supabase-js
  // `download()` replaces the auth headers when given custom ones, so a Range
  // request goes through a signed link instead.
  const { data: sniffLink, error: sniffLinkErr } = await bucket.createSignedUrl(path, SNIFF_LINK_TTL_SECONDS);
  if (sniffLinkErr || !sniffLink) {
    // Storage answers "Object not found" here when nothing was uploaded.
    logger.warn("orcamento_upload_confirm_missing", { requestId, details: sniffLinkErr?.message ?? "no data" });
    return fail("not_found", "arquivo não encontrado — envie novamente", 404, { requestId });
  }

  let res: Response;
  try {
    res = await fetch(sniffLink.signedUrl, {
      headers: { Range: `bytes=0-${SNIFF_BYTES - 1}` },
      cache: "no-store",
    });
  } catch (err) {
    logger.error("orcamento_upload_confirm_read_failed", {
      requestId,
      details: err instanceof Error ? err.message : String(err),
    });
    return fail("internal_error", "falha ao verificar o arquivo", 502, { requestId });
  }
  if (res.status === 404 || res.status === 400) {
    await res.body?.cancel();
    return fail("not_found", "arquivo não encontrado — envie novamente", 404, { requestId });
  }
  if (res.status !== 200 && res.status !== 206) {
    await res.body?.cancel();
    logger.error("orcamento_upload_confirm_read_failed", { requestId, details: `HTTP ${res.status}` });
    return fail("internal_error", "falha ao verificar o arquivo", 502, { requestId });
  }

  const check = checkOrcamentoFile({
    kind,
    storedContentType: res.headers.get("content-type"),
    head: await readHead(res.body, SNIFF_BYTES),
    totalSize: totalSizeFromHeaders(res.status, res.headers),
  });

  if (!check.ok) {
    const { error: removeErr } = await bucket.remove([path]);
    logger.warn("orcamento_upload_rejected", {
      requestId,
      ip,
      kind,
      reason: check.reason,
      removed: !removeErr,
      removeError: removeErr?.message,
    });
    return fail(
      "file_rejected",
      `o conteúdo não corresponde a um arquivo .${kind} válido`,
      422,
      { requestId },
    );
  }

  const { data, error } = await bucket.createSignedUrl(path, ORCAMENTO_LINK_TTL_SECONDS);
  if (error || !data) {
    logger.error("orcamento_upload_confirm_failed", {
      requestId,
      details: error?.message ?? "no data",
    });
    return fail("internal_error", "falha ao gerar o link do arquivo", 500, { requestId });
  }

  const expiresAt = new Date(Date.now() + ORCAMENTO_LINK_TTL_SECONDS * 1000).toISOString();
  return ok({ fileUrl: data.signedUrl, expiresAt }, { requestId });
}
