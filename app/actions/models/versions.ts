"use server";

/**
 * Versões de uma peça do repositório 3D (migration 0075).
 *
 * FLUXO, e por que ele é assim. O arquivo transformado é gerado NO BROWSER (é lá
 * que a geometria já está carregada) e sobe direto para o Storage por URL
 * assinada. Não passa por Server Action: o limite de corpo de uma action é 1 MB,
 * e um STL de peça média passa disso com folga.
 *
 * O servidor continua dono das decisões que importam: monta o caminho dentro da
 * pasta da org, resolve o número da versão, e confere que o `file_path` que o
 * cliente devolve está sob o prefixo certo. O cliente não escolhe onde grava nem
 * qual número recebe.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { MODELS_BUCKET } from "@/lib/models/config";

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
  return {
    ok: true,
    ctx: { orgId: activeOrg.orgId, userId: authUser.id, supabase: await createClient() },
  };
}

const vec3 = z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() });

const transformSchema = z.object({
  rotationDeg: vec3,
  // Escala zero achataria a peça num plano sem volume; negativa é espelho e é
  // legítima. O teto evita transformar um erro de digitação em 100 MB de STL.
  scale: z.object({
    x: z.number().finite().refine((v) => v !== 0, "Escala não pode ser zero."),
    y: z.number().finite().refine((v) => v !== 0, "Escala não pode ser zero."),
    z: z.number().finite().refine((v) => v !== 0, "Escala não pode ser zero."),
  }),
  translationMm: vec3,
});

const boundingBox = z.object({
  min: z.tuple([z.number(), z.number(), z.number()]),
  max: z.tuple([z.number(), z.number(), z.number()]),
});

export interface ModelVersionRow {
  id: string;
  versionNumber: number;
  filePath: string;
  sizeKb: number;
  triangles: number;
  volumeCm3: number;
  note: string;
  createdAt: string;
  isCurrent: boolean;
}

interface Row {
  id: string;
  version_number: number;
  file_path: string;
  size_kb: number | string;
  triangles: number | string;
  volume_cm3: number | string;
  note: string | null;
  created_at: string;
}

const SELECT_COLS =
  "id, version_number, file_path, size_kb, triangles, volume_cm3, note, created_at";

/** Histórico de uma peça, da mais nova para a mais antiga. */
export async function fetchModelVersions(modelId: string) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };
  if (!z.string().uuid().safeParse(modelId).success) {
    return { ok: false as const, error: "Peça inválida." };
  }

  const { data: model } = await c.ctx.supabase
    .from("models_3d")
    .select("current_version_id")
    .eq("organization_id", c.ctx.orgId)
    .eq("id", modelId)
    .maybeSingle();

  const currentId = (model as { current_version_id?: string | null } | null)?.current_version_id ?? null;

  const { data, error } = await c.ctx.supabase
    .from("model_versions")
    .select(SELECT_COLS)
    .eq("organization_id", c.ctx.orgId)
    .eq("model_id", modelId)
    .order("version_number", { ascending: false });
  if (error) return { ok: false as const, error: error.message };

  return {
    ok: true as const,
    versions: ((data as Row[] | null) ?? []).map(
      (r): ModelVersionRow => ({
        id: r.id,
        versionNumber: r.version_number,
        filePath: r.file_path,
        sizeKb: Number(r.size_kb),
        triangles: Number(r.triangles),
        volumeCm3: Number(r.volume_cm3),
        note: r.note ?? "",
        createdAt: r.created_at,
        isCurrent: r.id === currentId,
      }),
    ),
  };
}

/**
 * URL assinada para o cliente subir o arquivo já transformado.
 *
 * O caminho é montado aqui, sob `<orgId>/versions/`. O cliente recebe o token e
 * o path prontos — não tem como gravar fora da pasta da própria organização.
 */
export async function createVersionUploadUrl(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = z.object({ modelId: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Peça inválida." };

  const { data: model } = await c.ctx.supabase
    .from("models_3d")
    .select("id")
    .eq("organization_id", c.ctx.orgId)
    .eq("id", parsed.data.modelId)
    .maybeSingle();
  if (!model) return { ok: false as const, error: "Peça não encontrada." };

  const path = `${c.ctx.orgId}/versions/${parsed.data.modelId}/${crypto.randomUUID()}.stl`;
  const { data, error } = await c.ctx.supabase.storage
    .from(MODELS_BUCKET)
    .createSignedUploadUrl(path);
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const, path, token: data.token };
}

const saveSchema = z.object({
  modelId: z.string().uuid(),
  filePath: z.string().trim().min(1).max(500),
  sizeKb: z.coerce.number().int().nonnegative().max(1_000_000),
  triangles: z.coerce.number().int().nonnegative().max(100_000_000),
  volumeCm3: z.coerce.number().nonnegative().max(10_000_000),
  boundingBox: boundingBox,
  transform: transformSchema,
  note: z.string().trim().max(300).default(""),
});

/**
 * Grava a versão nova e aponta a peça para ela.
 *
 * A PRIMEIRA EDIÇÃO GRAVA DUAS LINHAS: a v1 com o arquivo ORIGINAL e a v2 com o
 * resultado. Sem isso o estado de origem só existiria enquanto ninguém
 * sobrescrevesse `models_3d.file_path`, e "voltar ao original" não teria para
 * onde voltar.
 */
export async function saveModelVersion(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const d = parsed.data;

  if (!d.filePath.startsWith(`${c.ctx.orgId}/`)) {
    return { ok: false as const, error: "Caminho fora da sua organização." };
  }

  const { data: model, error: modelError } = await c.ctx.supabase
    .from("models_3d")
    .select("id, name, file_path, size_kb, triangles, volume_cm3, bounding_box")
    .eq("organization_id", c.ctx.orgId)
    .eq("id", d.modelId)
    .maybeSingle();
  if (modelError) return { ok: false as const, error: modelError.message };
  if (!model) return { ok: false as const, error: "Peça não encontrada." };

  const original = model as {
    file_path: string;
    size_kb: number;
    triangles: number;
    volume_cm3: number;
    bounding_box: unknown;
  };

  const { data: last } = await c.ctx.supabase
    .from("model_versions")
    .select("version_number")
    .eq("organization_id", c.ctx.orgId)
    .eq("model_id", d.modelId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  let next = ((last as { version_number?: number } | null)?.version_number ?? 0) + 1;

  // Nenhuma versão ainda: preserva o original como v1 antes de gravar a edição.
  if (next === 1) {
    const { error } = await c.ctx.supabase.from("model_versions").insert({
      organization_id: c.ctx.orgId,
      model_id: d.modelId,
      version_number: 1,
      file_path: original.file_path,
      size_kb: original.size_kb,
      triangles: original.triangles,
      volume_cm3: original.volume_cm3,
      bounding_box: original.bounding_box ?? {},
      transform: {},
      note: "Original, como enviado",
      created_by: c.ctx.userId,
    });
    if (error) return { ok: false as const, error: error.message };
    next = 2;
  }

  const { data: created, error } = await c.ctx.supabase
    .from("model_versions")
    .insert({
      organization_id: c.ctx.orgId,
      model_id: d.modelId,
      version_number: next,
      file_path: d.filePath,
      size_kb: d.sizeKb,
      triangles: d.triangles,
      volume_cm3: d.volumeCm3,
      bounding_box: d.boundingBox,
      transform: d.transform,
      note: d.note,
      created_by: c.ctx.userId,
    })
    .select("id, version_number")
    .single();
  if (error) return { ok: false as const, error: error.message };

  const version = created as { id: string; version_number: number };

  // A peça passa a apontar para a versão nova. `file_path` também muda: é o que
  // o fatiador, o download e o visualizador leem.
  const { error: pointError } = await c.ctx.supabase
    .from("models_3d")
    .update({
      current_version_id: version.id,
      file_path: d.filePath,
      size_kb: d.sizeKb,
      triangles: d.triangles,
      volume_cm3: d.volumeCm3,
      bounding_box: d.boundingBox,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", c.ctx.orgId)
    .eq("id", d.modelId);
  if (pointError) return { ok: false as const, error: pointError.message };

  revalidatePath("/app/models");
  return { ok: true as const, versionNumber: version.version_number };
}

/** Volta a peça para uma versão anterior. Não apaga nada: só move o ponteiro. */
export async function restoreModelVersion(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = z
    .object({ modelId: z.string().uuid(), versionId: z.string().uuid() })
    .safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };

  const { data, error } = await c.ctx.supabase
    .from("model_versions")
    .select("id, file_path, size_kb, triangles, volume_cm3, bounding_box")
    .eq("organization_id", c.ctx.orgId)
    .eq("model_id", parsed.data.modelId)
    .eq("id", parsed.data.versionId)
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: "Versão não encontrada." };

  const v = data as {
    id: string;
    file_path: string;
    size_kb: number;
    triangles: number;
    volume_cm3: number;
    bounding_box: unknown;
  };

  const { error: updateError } = await c.ctx.supabase
    .from("models_3d")
    .update({
      current_version_id: v.id,
      file_path: v.file_path,
      size_kb: v.size_kb,
      triangles: v.triangles,
      volume_cm3: v.volume_cm3,
      bounding_box: v.bounding_box ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", c.ctx.orgId)
    .eq("id", parsed.data.modelId);
  if (updateError) return { ok: false as const, error: updateError.message };

  revalidatePath("/app/models");
  return { ok: true as const };
}
