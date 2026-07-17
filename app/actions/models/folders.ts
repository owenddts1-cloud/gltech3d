"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { wouldCreateCycle } from "@/lib/models/tree";
import type { FolderRow } from "@/lib/models/config";

/**
 * CRUD da árvore de pastas do explorador de Modelagem (migration 0049).
 * Pastas livres, com vínculo opcional a um contato. Regra anti-ciclo e
 * re-parent no delete moram em lib/models/tree.ts (puro, testável).
 */

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

interface Row {
  id: string;
  parent_id: string | null;
  name: string;
  icon: string;
  color: string | null;
  contact_id: string | null;
  sort_order: number | string | null;
}

function toView(r: Row): FolderRow {
  return {
    id: r.id,
    parentId: r.parent_id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    contactId: r.contact_id,
    sortOrder: r.sort_order == null ? null : Number(r.sort_order),
  };
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: z.string().uuid().nullable().optional(),
  icon: z.string().trim().max(40).optional().default("Folder"),
  color: z.string().trim().max(20).optional().default(""),
  contactId: z.string().uuid().nullable().optional(),
});

export async function fetchTree() {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const { data, error } = await c.ctx.supabase
    .from("model_folders")
    .select("id, parent_id, name, icon, color, contact_id, sort_order")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const, folders: ((data as Row[] | null) ?? []).map(toView) };
}

export async function createFolder(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const d = parsed.data;

  const { data, error } = await c.ctx.supabase
    .from("model_folders")
    .insert({
      organization_id: c.ctx.orgId,
      parent_id: d.parentId ?? null,
      name: d.name,
      icon: d.icon || "Folder",
      color: d.color || null,
      contact_id: d.contactId ?? null,
      created_by: c.ctx.userId,
    })
    .select("id, parent_id, name, icon, color, contact_id, sort_order")
    .single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/models");
  return { ok: true as const, folder: toView(data as Row) };
}

export async function renameFolder(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120) }).safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Nome inválido" };

  const { error } = await c.ctx.supabase
    .from("model_folders")
    .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
    .eq("organization_id", c.ctx.orgId)
    .eq("id", parsed.data.id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/models");
  return { ok: true as const };
}

export async function setFolderIcon(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = z
    .object({ id: z.string().uuid(), icon: z.string().trim().max(40), color: z.string().trim().max(20).optional().default("") })
    .safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Ícone inválido" };

  const { error } = await c.ctx.supabase
    .from("model_folders")
    .update({ icon: parsed.data.icon || "Folder", color: parsed.data.color || null, updated_at: new Date().toISOString() })
    .eq("organization_id", c.ctx.orgId)
    .eq("id", parsed.data.id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/models");
  return { ok: true as const };
}

export async function moveFolder(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = z
    .object({ id: z.string().uuid(), newParentId: z.string().uuid().nullable() })
    .safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const { id, newParentId } = parsed.data;

  // Anti-ciclo: carrega a árvore e checa se o novo pai é a própria pasta ou um
  // descendente dela.
  const { data: all, error: treeErr } = await c.ctx.supabase
    .from("model_folders")
    .select("id, parent_id")
    .eq("organization_id", c.ctx.orgId);
  if (treeErr) return { ok: false as const, error: treeErr.message };

  const folders = (all as { id: string; parent_id: string | null }[] | null) ?? [];
  if (wouldCreateCycle(folders.map((f) => ({ id: f.id, parentId: f.parent_id })), id, newParentId)) {
    return { ok: false as const, error: "Não dá para mover uma pasta para dentro dela mesma." };
  }

  const { error } = await c.ctx.supabase
    .from("model_folders")
    .update({ parent_id: newParentId, updated_at: new Date().toISOString() })
    .eq("organization_id", c.ctx.orgId)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/models");
  return { ok: true as const };
}

/**
 * Exclui a pasta re-parentando os filhos (subpastas e arquivos) para o pai dela
 * — nada se perde. Só depois remove a pasta (que a esta altura está vazia).
 */
export async function deleteFolder(id: string) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const { data: folder, error: fErr } = await c.ctx.supabase
    .from("model_folders")
    .select("parent_id")
    .eq("organization_id", c.ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (fErr) return { ok: false as const, error: fErr.message };
  if (!folder) return { ok: false as const, error: "Pasta não encontrada." };

  const newParent = (folder as { parent_id: string | null }).parent_id;

  // Sobe subpastas e arquivos um nível.
  const upSub = await c.ctx.supabase
    .from("model_folders")
    .update({ parent_id: newParent })
    .eq("organization_id", c.ctx.orgId)
    .eq("parent_id", id);
  if (upSub.error) return { ok: false as const, error: upSub.error.message };

  const upFiles = await c.ctx.supabase
    .from("models_3d")
    .update({ folder_id: newParent })
    .eq("organization_id", c.ctx.orgId)
    .eq("folder_id", id);
  if (upFiles.error) return { ok: false as const, error: upFiles.error.message };

  const { error } = await c.ctx.supabase
    .from("model_folders")
    .delete()
    .eq("organization_id", c.ctx.orgId)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/models");
  return { ok: true as const };
}
