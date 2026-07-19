"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Ações leves de contato para os comboboxes do CRM.
 *
 * `quickCreateContact` cobre o fluxo "Outro cliente" (ex.: Nova O.S.): cria o
 * contato na hora com `source='pendente'` — o cadastro fica marcado como
 * pendente em Contatos para o usuário completar depois. Sem mudança de schema:
 * `source` é o campo de proveniência existente ('landing', 'controle', ...).
 */

export interface ContactOption {
  id: string;
  name: string;
  isPending: boolean;
}

const quickCreateSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(160),
});

interface Ctx {
  orgId: string;
  userId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

async function requireCtx(): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "Nenhuma organização ativa" };
  return { ok: true, ctx: { orgId: activeOrg.orgId, userId: authUser.id, supabase: await createClient() } };
}

interface ContactRow {
  id: string;
  name: string | null;
  display_name: string | null;
  source: string | null;
}

const toOption = (r: ContactRow): ContactOption => ({
  id: r.id,
  name: r.display_name || r.name || "Sem nome",
  isPending: r.source === "pendente",
});

/** Lista contatos da org para popular comboboxes (id + nome + flag pendente). */
export async function fetchContactOptions() {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const { data, error } = await c.ctx.supabase
    .from("contacts")
    .select("id, name, display_name, source")
    .order("name", { ascending: true });
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const, contacts: ((data as ContactRow[] | null) ?? []).map(toOption) };
}

/**
 * Cria um contato "rápido" com cadastro pendente. Dedup por nome (case-insensitive):
 * se já existir, retorna o existente em vez de duplicar.
 */
export async function quickCreateContact(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = quickCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Nome inválido" };
  }
  const name = parsed.data.name;

  // Dedup: nome já cadastrado (name ou display_name) → reusa.
  const { data: existing } = await c.ctx.supabase
    .from("contacts")
    .select("id, name, display_name, source")
    .or(`name.ilike.${name},display_name.ilike.${name}`)
    .limit(1);
  const found = (existing as ContactRow[] | null)?.[0];
  if (found) return { ok: true as const, contact: toOption(found), existed: true as const };

  const { data, error } = await c.ctx.supabase
    .from("contacts")
    .insert({
      organization_id: c.ctx.orgId,
      name,
      display_name: name,
      source: "pendente",
      created_by_user_id: c.ctx.userId,
    })
    .select("id, name, display_name, source")
    .single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/contacts");
  return { ok: true as const, contact: toOption(data as ContactRow), existed: false as const };
}
