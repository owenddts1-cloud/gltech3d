"use server";

/**
 * Estimar peso e tempo de um produto a partir do STL vinculado.
 *
 * O QUE ISTO DESTRAVA. Os 18 produtos do catálogo têm `filament_grams = 0` e
 * `print_time_seconds = 0`. Sem esses dois números nenhum custo é calculável, e é
 * daí que saem a "margem média 100%" da tela de Produtos e os 95,5% de Vendas.
 * Preencher à mão exigiria pesar cada peça e cronometrar cada impressão.
 *
 * RODA NO SERVIDOR, e não no navegador, por um motivo: assim a mesma peça pode
 * ser estimada em lote, sem alguém precisar abrir 18 abas. O fatiador é TypeScript
 * puro (`lib/slicer/*`), então roda em Node sem adaptação.
 *
 * CUSTO: fatiar o Acoplamento (2.602 triângulos, 357 camadas) leva ~4 s. Aceitável
 * para uma ação sob demanda; NÃO é aceitável dentro de um render de página, e por
 * isso é uma action explícita e não um cálculo automático ao abrir a tela.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { MODELS_BUCKET } from "@/lib/models/config";
import { estimateFromMesh } from "@/lib/pricing/estimate-from-mesh";
import { DEFAULT_SLICE_SETTINGS } from "@/lib/slicer/pipeline";

const schema = z.object({
  productId: z.string().uuid(),
  /** Sobrescreve o padrão do fatiador. Peça oca pede preenchimento menor. */
  infillDensityPct: z.coerce.number().min(0).max(100).optional(),
  wallCount: z.coerce.number().int().min(1).max(10).optional(),
  layerHeight: z.coerce.number().min(0.04).max(0.6).optional(),
  supportsEnabled: z.boolean().optional(),
});

export interface EstimateResult {
  filamentGrams: number;
  printTimeSeconds: number;
  layerCount: number;
  supportCm3: number;
  openContourCount: number;
  elapsedMs: number;
}

export async function estimateProductFromModel(raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "Nenhuma organização ativa" };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const { productId, ...overrides } = parsed.data;

  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from("products")
    .select("id, name, model_id")
    .eq("organization_id", activeOrg.orgId)
    .eq("id", productId)
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!product) return { ok: false as const, error: "Peça não encontrada." };

  const modelId = (product as { model_id: string | null }).model_id;
  if (!modelId) {
    return {
      ok: false as const,
      error: "Esta peça não tem um modelo 3D vinculado. Escolha o STL antes de estimar.",
    };
  }

  const { data: model } = await supabase
    .from("models_3d")
    .select("file_path, name, kind")
    .eq("organization_id", activeOrg.orgId)
    .eq("id", modelId)
    .maybeSingle();
  if (!model) return { ok: false as const, error: "Modelo vinculado não existe mais." };

  const { file_path: filePath, kind } = model as { file_path: string; kind: string | null };
  // O estimador lê STL. 3MF é lido pelo `parseMeshBuffer` do navegador, que
  // depende de `DecompressionStream`; deixar explícito é melhor que falhar com
  // "não reconheci o arquivo".
  if (kind && kind !== "stl") {
    return {
      ok: false as const,
      error: "Por enquanto a estimativa lê apenas STL. Envie o STL desta peça.",
    };
  }
  if (!filePath.startsWith(`${activeOrg.orgId}/`)) {
    return { ok: false as const, error: "Caminho fora da sua organização." };
  }

  const signed = await supabase.storage.from(MODELS_BUCKET).createSignedUrl(filePath, 300);
  if (signed.error) return { ok: false as const, error: signed.error.message };

  const started = Date.now();
  let estimate;
  try {
    const res = await fetch(signed.data.signedUrl, { cache: "no-store" });
    if (!res.ok) return { ok: false as const, error: `Falha ao ler o arquivo (HTTP ${res.status})` };
    estimate = estimateFromMesh(await res.arrayBuffer(), {
      settings: { ...DEFAULT_SLICE_SETTINGS, ...overrides },
    });
  } catch (e) {
    // Malha quebrada, arquivo truncado ou formato inesperado. A mensagem do
    // parser já é específica; propagá-la ajuda mais que "erro ao estimar".
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Não consegui fatiar este arquivo.",
    };
  }
  const elapsedMs = Date.now() - started;

  const { error: saveError } = await supabase
    .from("products")
    .update({
      filament_grams: estimate.filamentGrams,
      print_time_seconds: estimate.printTimeSeconds,
      cost_estimated_at: new Date().toISOString(),
      // Proveniência: sem ela, um valor estimado fica indistinguível de um peso
      // de balança, e a diferença importa — a peça real varia com preenchimento,
      // suporte e falha.
      cost_estimate_source: {
        ...estimate.profile,
        layerCount: estimate.layerCount,
        supportCm3: estimate.supportCm3,
        openContourCount: estimate.openContourCount,
        modelId,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", activeOrg.orgId)
    .eq("id", productId);
  if (saveError) return { ok: false as const, error: saveError.message };

  revalidatePath("/app/products");

  const result: EstimateResult = {
    filamentGrams: estimate.filamentGrams,
    printTimeSeconds: estimate.printTimeSeconds,
    layerCount: estimate.layerCount,
    supportCm3: estimate.supportCm3,
    openContourCount: estimate.openContourCount,
    elapsedMs,
  };
  return { ok: true as const, estimate: result };
}

/** Vincula um modelo do repositório à peça. `null` desfaz o vínculo. */
export async function linkProductModel(raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "Nenhuma organização ativa" };

  const parsed = z
    .object({ productId: z.string().uuid(), modelId: z.string().uuid().nullable() })
    .safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };

  const supabase = await createClient();

  // Confere que o modelo é da mesma organização antes de gravar o ponteiro: a
  // FK garante que o id existe, não que ele é seu.
  if (parsed.data.modelId) {
    const { data: model } = await supabase
      .from("models_3d")
      .select("id")
      .eq("organization_id", activeOrg.orgId)
      .eq("id", parsed.data.modelId)
      .maybeSingle();
    if (!model) return { ok: false as const, error: "Modelo não encontrado." };
  }

  const { error } = await supabase
    .from("products")
    .update({ model_id: parsed.data.modelId, updated_at: new Date().toISOString() })
    .eq("organization_id", activeOrg.orgId)
    .eq("id", parsed.data.productId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/products");
  return { ok: true as const };
}
