/**
 * GET /api/v1/admin/pro-signups — fila de pedidos do Calc3D PRO.
 *
 * Platform admin apenas. A tabela guarda telefone e comprovante de pagamento de
 * terceiros; a RLS já só deixa `fn_is_platform_admin()` ler, e esta rota repete
 * a checagem antes de usar o service role.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/wrappers";

const querySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

interface CursorPayload {
  created_at: string;
  id: string;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8")) as CursorPayload;
  } catch {
    return null;
  }
}

const SELECT_COLUMNS =
  "id, status, plan, buyer_name, buyer_email, buyer_phone, company_name, amount_cents, currency, pix_txid, declared_paid_at, receipt_storage_path, organization_id, reviewed_at, review_note, invited_user_email, created_at";

export async function GET(req: NextRequest) {
  const requestId = randomUUID();

  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403, { requestId });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return fail("validation_error", "Invalid query", 400, {
      requestId,
      details: parsed.error.flatten(),
    });
  }
  const { status, cursor, limit } = parsed.data;

  const admin = createAdminClient();
  let query = admin
    .from("pro_signup_requests")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    // Uma linha a mais do que o pedido: é como sabemos se há próxima página sem
    // um COUNT separado.
    .limit(limit + 1);

  if (status) query = query.eq("status", status);

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) return fail("validation_error", "Invalid cursor", 400, { requestId });
    query = query.lt("created_at", decoded.created_at);
  }

  const { data, error } = await query;
  if (error) {
    return fail("internal_error", "Failed to list signups", 500, {
      requestId,
      details: error.message,
    });
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return ok(page, {
    requestId,
    meta: {
      has_more: hasMore,
      cursor:
        hasMore && last
          ? encodeCursor({ created_at: last.created_at as string, id: last.id as string })
          : null,
    },
  });
}
