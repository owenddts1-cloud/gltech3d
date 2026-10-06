/**
 * GET   /api/v1/contacts/[id] — fetch single (handler em ../_handler.ts)
 * PATCH /api/v1/contacts/[id] — update (handler em ../_handler.ts)
 * DELETE /api/v1/contacts/[id] — hard delete SEM histórico (manager+); com
 *   histórico → 409 contact_has_history (use a anonimização LGPD).
 *
 * Thin wrapper: auth + Zod + ok/fail. Decrypt CPF + LGPD irreversibility no handler.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ApiError } from "@/lib/api/types";
import { ok, fail } from "@/lib/api/wrappers";
import { requireProApiForSession } from "@/lib/plan/api";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { roleCan } from "@/lib/auth/permissions";
import { contactPatchSchema, validateRequest } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

import { deleteContactHandler, getContactHandler, patchContactHandler } from "../_handler";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return fail("unauthenticated", "Auth required.", 401, { requestId });
  }

  const authUser = await loadAuthUser();
  const activeOrg = authUser ? await resolveActiveOrg(authUser) : null;
  if (!activeOrg) {
    return fail("no_active_org", "No active organization.", 403, { requestId });
  }

  const decryptPurpose = req.headers.get("x-decrypt-purpose");

  try {
    const result = await getContactHandler(
      supabase,
      {
        organization_id: activeOrg.orgId,
        actor: { type: "user", id: user.id },
        requestId,
      },
      { contactId: id, decryptPurpose },
    );
    return ok(result, { requestId });
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.code, err.message, err.status, { requestId });
    }
    throw err;
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return fail("unauthenticated", "Auth required.", 401, { requestId });
  }
  const planDenied = await requireProApiForSession(requestId);
  if (planDenied) return planDenied;

  const authUser = await loadAuthUser();
  const activeOrg = authUser ? await resolveActiveOrg(authUser) : null;
  if (!activeOrg) {
    return fail("no_active_org", "No active organization.", 403, { requestId });
  }

  let input;
  try {
    input = await validateRequest(contactPatchSchema, req);
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.code, err.message, err.status, {
        details: err.details as Record<string, unknown> | undefined,
        requestId,
      });
    }
    throw err;
  }

  try {
    const contact = await patchContactHandler(
      supabase,
      {
        organization_id: activeOrg.orgId,
        actor: { type: "user", id: user.id },
        requestId,
      },
      id,
      input,
    );
    return ok(contact, { requestId });
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.code, err.message, err.status, { requestId });
    }
    throw err;
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return fail("unauthenticated", "Auth required.", 401, { requestId });
  }
  const planDenied = await requireProApiForSession(requestId);
  if (planDenied) return planDenied;

  const authUser = await loadAuthUser();
  const activeOrg = authUser ? await resolveActiveOrg(authUser) : null;
  if (!authUser || !activeOrg) {
    return fail("no_active_org", "No active organization.", 403, { requestId });
  }
  // Same rule as the button (usePermission("contact.delete") → admin) and as
  // RLS since migration 0084 (DELETE on contacts is admin-only).
  if (!roleCan(activeOrg.role, "contact.delete", { isPlatformAdmin: authUser.is_platform_admin })) {
    return fail("forbidden_role", "Apenas administrador pode excluir contatos.", 403, { requestId });
  }

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return fail("invalid_request", "ID de contato inválido.", 400, { requestId });
  }

  try {
    const result = await deleteContactHandler(
      supabase,
      {
        organization_id: activeOrg.orgId,
        actor: { type: "user", id: user.id },
        requestId,
      },
      idParsed.data,
    );
    return ok(result, { requestId });
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.code, err.message, err.status, { details: err.details, requestId });
    }
    throw err;
  }
}
