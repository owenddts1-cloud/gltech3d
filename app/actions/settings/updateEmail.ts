"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { resolveActiveOrg, loadAuthUser } from "@/lib/auth/server";

const emailSchema = z.object({ email: z.string().trim().email().max(254) });

export type UpdateEmailResult = { ok: true } | { ok: false; error: string };

/**
 * Troca o email da conta. `supabase.auth.updateUser({ email })` dispara o fluxo
 * de confirmação do próprio Supabase — o email só muda depois que o usuário
 * clica no link enviado para o NOVO endereço. Aqui a gente só inicia.
 */
export async function updateEmail(input: unknown): Promise<UpdateEmailResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Email inválido." };

  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Não autenticado." };

  if (parsed.data.email.toLowerCase() === (authUser.email ?? "").toLowerCase()) {
    return { ok: false, error: "Esse já é o seu email atual." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email: parsed.data.email });
  if (error) return { ok: false, error: error.message };

  const hdrs = await headers();
  const activeOrg = await resolveActiveOrg(authUser);
  await audit({
    action: "profile.email_change_requested",
    actorUserId: authUser.id,
    organizationId: activeOrg?.orgId ?? null,
    resourceType: "user",
    resourceId: authUser.id,
    requestId: hdrs.get("x-request-id"),
    ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: hdrs.get("user-agent") ?? null,
    // Não logamos o email novo em claro — é PII; só o fato do pedido.
    metadata: { requested: true },
  });

  return { ok: true };
}
