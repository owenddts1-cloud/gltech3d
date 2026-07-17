"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser } from "@/lib/auth/server";

export interface SessionRow {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
  notAfter: string | null;
  userAgent: string | null;
  ip: string | null;
}

/**
 * Sessões ativas do próprio usuário, via RPC `fn_my_sessions` (migration 0047).
 * Read-only — a revogação individual mexeria em internals do GoTrue; o "sair de
 * todos os dispositivos" cobre o encerramento.
 */
export async function listSessions(): Promise<
  { ok: true; sessions: SessionRow[] } | { ok: false; error: string }
> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Não autenticado." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_my_sessions");
  if (error) return { ok: false, error: error.message };

  interface Raw {
    id: string;
    created_at: string | null;
    updated_at: string | null;
    not_after: string | null;
    user_agent: string | null;
    ip: string | null;
  }
  const sessions: SessionRow[] = ((data as Raw[] | null) ?? []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    notAfter: r.not_after,
    userAgent: r.user_agent,
    ip: r.ip,
  }));

  return { ok: true, sessions };
}
