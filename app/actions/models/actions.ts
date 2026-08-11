"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  MODELS_BUCKET,
  MODELS_MAX_BYTES,
  kindFromFilename,
  type Model3dRow,
} from "@/lib/models/config";

const ALLOWED_EXT = ["stl", "3mf", "png", "jpg", "jpeg", "webp"];

/**
 * Repositório de modelos 3D (migration 0045). O arquivo STL vai direto do
 * browser para o Storage via URL assinada (não passa pelo Server Action, que
 * tem limite de 1 MB de body). O servidor monta o caminho `<orgId>/...` — o
 * cliente não escolhe onde grava.
 */

const boundingBox = z.object({
  min: z.tuple([z.number(), z.number(), z.number()]),
  max: z.tuple([z.number(), z.number(), z.number()]),
});

const uploadUrlSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  sizeBytes: z.number().int().positive().max(MODELS_MAX_BYTES),
});

const saveSchema = z.object({
  name: z.string().trim().min(1).max(200),
  filePath: z.string().trim().min(1).max(500),
  sizeKb: z.coerce.number().int().nonnegative().max(1_000_000),
  // STL preenche geometria; 3MF/imagem deixam zerado.
  triangles: z.coerce.number().int().nonnegative().max(100_000_000).optional().default(0),
  volumeCm3: z.coerce.number().nonnegative().max(10_000_000).optional().default(0),
  boundingBox: boundingBox.optional(),
  thumbnailUrl: z.string().max(200_000).optional().default(""),
  folderId: z.string().uuid().nullable().optional(),
  mimeType: z.string().max(120).optional().default(""),
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

function safeName(input: string): string {
  const base = input.split(/[\\/]/).pop() ?? "modelo.stl";
  return (
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .slice(-120) || "modelo.stl"
  );
}

interface Row {
  id: string;
  name: string;
  file_path: string;
  size_kb: number | string;
  triangles: number | string;
  volume_cm3: number | string;
  bounding_box: unknown;
  thumbnail_url: string | null;
  created_at: string;
  folder_id: string | null;
  kind: string | null;
  mime_type: string | null;
}

const SELECT_COLS =
  "id, name, file_path, size_kb, triangles, volume_cm3, bounding_box, thumbnail_url, created_at, folder_id, kind, mime_type";

function toView(r: Row): Model3dRow {
  const bb = (typeof r.bounding_box === "object" && r.bounding_box !== null
    ? r.bounding_box
    : {}) as { min?: number[]; max?: number[] };
  return {
    id: r.id,
    name: r.name,
    filePath: r.file_path,
    sizeKb: Number(r.size_kb),
    triangles: Number(r.triangles),
    volumeCm3: Number(r.volume_cm3),
    boundingBox: {
      min: (bb.min ?? [0, 0, 0]) as [number, number, number],
      max: (bb.max ?? [0, 0, 0]) as [number, number, number],
    },
    thumbnailUrl: r.thumbnail_url,
    createdAt: r.created_at,
    folderId: r.folder_id,
    kind: (r.kind ?? "stl") as Model3dRow["kind"],
    mimeType: r.mime_type,
  };
}

export async function fetchModels() {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const { data, error } = await c.ctx.supabase
    .from("models_3d")
    .select(SELECT_COLS)
    .order("created_at", { ascending: false });
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const, models: ((data as Row[] | null) ?? []).map(toView) };
}

/** URL de upload assinada para o STL. O caminho é montado no servidor. */
export async function createModelUploadUrl(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = uploadUrlSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Arquivo grande demais (máx. 100 MB)." };
  const ext = parsed.data.filename.toLowerCase().split(".").pop() ?? "";
  if (!ALLOWED_EXT.includes(ext)) {
    return { ok: false as const, error: "Envie STL, 3MF ou imagem (PNG/JPG/WEBP)." };
  }

  const path = `${c.ctx.orgId}/${crypto.randomUUID()}-${safeName(parsed.data.filename)}`;
  const { data, error } = await c.ctx.supabase.storage.from(MODELS_BUCKET).createSignedUploadUrl(path);
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const, path, token: data.token };
}

export async function saveModel(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const d = parsed.data;
  // Confere o prefixo: o path tem de estar dentro da pasta da própria org.
  if (!d.filePath.startsWith(`${c.ctx.orgId}/`)) {
    return { ok: false as const, error: "Caminho fora da sua organização." };
  }

  const kind = kindFromFilename(d.name);

  const { data, error } = await c.ctx.supabase
    .from("models_3d")
    .insert({
      organization_id: c.ctx.orgId,
      name: d.name,
      file_path: d.filePath,
      size_kb: d.sizeKb,
      triangles: d.triangles,
      volume_cm3: d.volumeCm3,
      bounding_box: d.boundingBox ?? {},
      thumbnail_url: d.thumbnailUrl || null,
      folder_id: d.folderId ?? null,
      kind,
      mime_type: d.mimeType || null,
      created_by: c.ctx.userId,
    })
    .select(SELECT_COLS)
    .single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/models");
  return { ok: true as const, model: toView(data as Row) };
}

/**
 * URL assinada de LEITURA do arquivo. Vale para inspecionar e para baixar.
 *
 * POR QUE PRECISA EXISTIR: o bucket `models-3d` é privado e a policy
 * `tenant_read_models_3d` (0045) exige `auth.uid()`. Mas o cliente Supabase do
 * BROWSER (`lib/supabase/browser.ts`) lê a sessão de `document.cookie`, e o
 * cookie de auth é gravado com `httpOnly: true` (middleware.ts / server.ts) —
 * JavaScript não enxerga cookie httpOnly. Ou seja: toda chamada do browser sai
 * como `anon` e o download direto é sempre negado.
 *
 * O sintoma era enganoso — funcionava na máquina que subiu o arquivo, porque a
 * geometria ainda estava na memória do React e o Storage nem era consultado. Em
 * outro dispositivo, ou depois de um F5, quebrava.
 *
 * A assinatura viaja na própria URL, então quem baixa não precisa de sessão. O
 * cookie httpOnly fica como está: é ele que impede um XSS de roubar a sessão.
 */
export async function createModelDownloadUrl(id: string) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const { data: row, error } = await c.ctx.supabase
    .from("models_3d")
    .select("file_path, name")
    .eq("organization_id", c.ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!row) return { ok: false as const, error: "Modelo não encontrado." };

  const { file_path: filePath, name } = row as { file_path: string; name: string };
  // Defesa em profundidade: a query já filtra por org, mas o caminho também tem
  // de estar sob o prefixo da org antes de virar uma URL assinada.
  if (!filePath.startsWith(`${c.ctx.orgId}/`)) {
    return { ok: false as const, error: "Caminho fora da sua organização." };
  }

  // 5 min: tempo de sobra para baixar 100 MB e curto para um link vazado.
  const signed = await c.ctx.supabase.storage
    .from(MODELS_BUCKET)
    .createSignedUrl(filePath, 300, { download: safeName(name) });
  if (signed.error) return { ok: false as const, error: signed.error.message };

  return { ok: true as const, url: signed.data.signedUrl, filename: safeName(name) };
}

/** Move um arquivo para outra pasta (ou para a raiz com `folderId: null`). */
export async function moveFile(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = z
    .object({ id: z.string().uuid(), folderId: z.string().uuid().nullable() })
    .safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };

  const { error } = await c.ctx.supabase
    .from("models_3d")
    .update({ folder_id: parsed.data.folderId, updated_at: new Date().toISOString() })
    .eq("organization_id", c.ctx.orgId)
    .eq("id", parsed.data.id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/models");
  return { ok: true as const };
}

/** Renomeia o registro do arquivo (não mexe no path do storage). */
export async function renameFile(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = z
    .object({ id: z.string().uuid(), name: z.string().trim().min(1).max(200) })
    .safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Nome inválido" };

  const { error } = await c.ctx.supabase
    .from("models_3d")
    .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
    .eq("organization_id", c.ctx.orgId)
    .eq("id", parsed.data.id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/models");
  return { ok: true as const };
}

export async function deleteModel(id: string) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  // Busca o path para apagar o arquivo do Storage junto.
  const { data: row } = await c.ctx.supabase
    .from("models_3d")
    .select("file_path")
    .eq("organization_id", c.ctx.orgId)
    .eq("id", id)
    .maybeSingle();

  const { error } = await c.ctx.supabase
    .from("models_3d")
    .delete()
    .eq("organization_id", c.ctx.orgId)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  const filePath = (row as { file_path?: string } | null)?.file_path;
  if (filePath) {
    // Best-effort: o registro já foi removido; se a mídia falhar, não trava a UI.
    await c.ctx.supabase.storage.from(MODELS_BUCKET).remove([filePath]);
  }

  revalidatePath("/app/models");
  return { ok: true as const };
}

/** Opção enxuta para o seletor de peça do fatiador. */
export interface ModelOption {
  id: string;
  name: string;
  triangles: number;
}

/**
 * Peças fatiáveis: só STL, e só as que têm geometria.
 *
 * Filtra `triangles > 0` porque o repositório também guarda imagem e 3MF (que
 * ainda não tem parser) — oferecer no seletor o que não dá para fatiar só
 * produziria erro depois do clique.
 */
export async function fetchSliceableModels() {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const { data, error } = await c.ctx.supabase
    .from("models_3d")
    .select("id, name, triangles")
    .eq("organization_id", c.ctx.orgId)
    .eq("kind", "stl")
    .gt("triangles", 0)
    .order("created_at", { ascending: false });
  if (error) return { ok: false as const, error: error.message };

  return {
    ok: true as const,
    models: ((data as { id: string; name: string; triangles: number | string }[] | null) ?? []).map(
      (r): ModelOption => ({ id: r.id, name: r.name, triangles: Number(r.triangles) }),
    ),
  };
}

/**
 * Perfil de impressão da organização.
 *
 * Lê de `organizations.settings` e dos parâmetros que a própria operação já usa
 * no cálculo de custo. NÃO criei tabela `printer_profiles`: o CRM já guarda
 * tarifa de energia (`k_energy`) e a tela de Projetos já trabalha com
 * temperatura, altura de camada e velocidade. Duplicar isso numa tabela nova
 * criaria duas fontes de verdade para o mesmo número.
 */
export async function fetchPrintProfile() {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const { data } = await c.ctx.supabase
    .from("organizations")
    .select("display_name, settings")
    .eq("id", c.ctx.orgId)
    .maybeSingle();

  const settings = ((data as { settings?: Record<string, unknown> } | null)?.settings ??
    {}) as Record<string, unknown>;
  const num = (key: string, fallback: number): number => {
    const value = Number(settings[key]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  /**
   * Como `num`, mas ACEITA zero.
   *
   * `num` trata 0 como "não configurado" e devolve o padrão. Isso é certo para
   * temperatura e velocidade — bico a 0 °C não é uma escolha — e ERRADO para
   * retração e ventoinha, onde 0 é a escolha legítima de desligar. Sem isto,
   * gravar `retraction_mm: 0` nas configurações da organização silenciosamente
   * voltaria a retração para 2 mm.
   */
  const numOrZero = (key: string, fallback: number): number => {
    const value = Number(settings[key]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  };

  return {
    ok: true as const,
    profile: {
      name: (data as { display_name?: string } | null)?.display_name ?? "FDM 0.4",
      nozzleDiameter: num("nozzle_diameter", 0.4),
      filamentDiameter: num("filament_diameter", 1.75),
      bedTempC: num("bed_temp", 60),
      nozzleTempC: num("nozzle_temp", 210),
      printSpeed: num("print_speed", 50),
      travelSpeed: num("travel_speed", 120),
      firstLayerSpeed: num("first_layer_speed", 20),
      // Padrões medidos na Anycubic Kobra X: 2 mm a 30 mm/s.
      retractionMm: numOrZero("retraction_mm", 2),
      retractionSpeedMmS: num("retraction_speed", 30),
      retractionMinTravelMm: numOrZero("retraction_min_travel", 1.5),
      zHopMm: numOrZero("z_hop_mm", 0.2),
      bridgeSpeed: num("bridge_speed", 20),
      ironingSpeed: num("ironing_speed", 25),
      ironingFlowPct: numOrZero("ironing_flow_pct", 12),
      fanSpeedPct: numOrZero("fan_speed", 100),
      fanOffLayers: numOrZero("fan_off_layers", 1),
      fanFullAtLayer: numOrZero("fan_full_at_layer", 3),
      minLayerHeight: num("min_layer_height", 0.08),
      maxLayerHeight: num("max_layer_height", 0.28),
    },
  };
}
