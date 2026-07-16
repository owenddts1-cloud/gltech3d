"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { revalidateLanding } from "@/lib/landing/repository";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  LANDING_MEDIA_BUCKET,
  LANDING_MEDIA_MAX_BYTES,
  LANDING_MEDIA_MIME,
  type MediaAsset,
} from "@/lib/landing/media-config";

/**
 * Biblioteca de mídia do Landing Edit (bucket `landing-media`, migration 0042).
 *
 * O arquivo NÃO passa pelo Server Action: o limite de body é 1 MB por padrão no
 * Next, e foto de peça estoura isso fácil. Em vez disso o servidor emite uma URL
 * de upload assinada (validando auth + org + tipo) e o browser envia direto para
 * o Storage. Menos salto, sem limite de body, e o servidor segue no controle de
 * quem pode escrever onde.
 */

const uploadRequestSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.enum(LANDING_MEDIA_MIME),
  sizeBytes: z.number().int().positive().max(LANDING_MEDIA_MAX_BYTES),
});

/** Nome de arquivo seguro: sem acento, sem espaço, sem path traversal. */
function safeName(input: string): string {
  const base = input.split(/[\\/]/).pop() ?? "arquivo";
  return (
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .slice(-120) || "arquivo"
  );
}

function kindOf(name: string): "image" | "video" {
  return /\.(mp4|webm)$/i.test(name) ? "video" : "image";
}

async function ctx() {
  const authUser = await loadAuthUser();
  if (!authUser) return null;
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return null;
  return { orgId: activeOrg.orgId, supabase: await createClient() };
}

/**
 * Emite a URL assinada de upload. O caminho é montado no servidor — o cliente
 * não escolhe onde grava, então não dá para escrever na pasta de outra org.
 */
export async function createMediaUploadUrl(raw: unknown) {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Não autenticado" };

  const parsed = uploadRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: "Arquivo não suportado ou grande demais (máx. 50 MB)." };
  }

  const path = `${c.orgId}/${crypto.randomUUID()}-${safeName(parsed.data.filename)}`;
  const { data, error } = await c.supabase.storage.from(LANDING_MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error) return { ok: false as const, error: error.message };

  const { data: pub } = c.supabase.storage.from(LANDING_MEDIA_BUCKET).getPublicUrl(path);
  return {
    ok: true as const,
    path,
    token: data.token,
    publicUrl: pub.publicUrl,
  };
}

/** Tudo que já está guardado, para o visualizador da biblioteca. */
export async function listMedia() {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Não autenticado" };

  const { data, error } = await c.supabase.storage.from(LANDING_MEDIA_BUCKET).list(c.orgId, {
    limit: 200,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) return { ok: false as const, error: error.message };

  const assets: MediaAsset[] = (data ?? [])
    // O Storage devolve um placeholder .emptyFolderPlaceholder em pasta vazia.
    .filter((f) => f.name !== ".emptyFolderPlaceholder")
    .map((f) => {
      const path = `${c.orgId}/${f.name}`;
      const { data: pub } = c.supabase.storage.from(LANDING_MEDIA_BUCKET).getPublicUrl(path);
      return {
        path,
        name: f.name.replace(/^[0-9a-f-]{36}-/i, ""),
        url: pub.publicUrl,
        sizeBytes: (f.metadata?.size as number) ?? 0,
        createdAt: f.created_at ?? null,
        kind: kindOf(f.name),
      };
    });

  return { ok: true as const, assets };
}

export async function deleteMedia(path: string) {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Não autenticado" };

  // Confere o prefixo antes de chamar o Storage. A policy já barra, mas errar
  // aqui em voz alta é melhor do que depender só dela.
  if (!path.startsWith(`${c.orgId}/`)) {
    return { ok: false as const, error: "Caminho fora da sua organização." };
  }

  const { error } = await c.supabase.storage.from(LANDING_MEDIA_BUCKET).remove([path]);
  if (error) return { ok: false as const, error: error.message };

  revalidateLanding();
  revalidatePath("/app/landing-edit");
  return { ok: true as const };
}
