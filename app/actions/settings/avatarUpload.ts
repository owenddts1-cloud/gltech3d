"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadAuthUser } from "@/lib/auth/server";
import { AVATARS_BUCKET } from "@/lib/settings/avatar-config";

const MAX_BYTES = 5 * 1024 * 1024;
const MIME = ["image/png", "image/jpeg", "image/webp", "image/avif"] as const;

const schema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.enum(MIME),
  sizeBytes: z.number().int().positive().max(MAX_BYTES),
});

/**
 * URL de upload assinada para o avatar do usuário. O caminho é montado no
 * servidor sob `<user_id>/` — a pessoa não escolhe onde grava, e a policy do
 * bucket (migration 0046) só deixa escrever na própria pasta.
 */
export async function createAvatarUploadUrl(raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Não autenticado." };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: "Imagem não suportada ou grande demais (máx. 5 MB)." };
  }

  const ext = (parsed.data.filename.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${authUser.id}/${crypto.randomUUID()}.${ext || "png"}`;

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(AVATARS_BUCKET).createSignedUploadUrl(path);
  if (error) return { ok: false as const, error: error.message };

  const { data: pub } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
  return { ok: true as const, path, token: data.token, publicUrl: pub.publicUrl };
}
