"use server";

/**
 * Lucro por canal — o consumidor que faltava.
 *
 * POR QUE ESTE ARQUIVO EXISTE. A tabela `platform_commissions` era escrita pela
 * tela de Landing Edit e **lida por ninguém**. `computeChannelPrices`, a função
 * do motor que recebe comissão, não era chamada em lugar algum do sistema.
 *
 * O efeito prático, medido em 11/08/2026: as 7 plataformas das 2 organizações
 * estavam em 0%, e nenhuma tela mostrava isso — o sistema simplesmente afirmava
 * margem cheia. Uma auditoria externa concluiu que preencher aqueles campos era
 * "a meia hora mais lucrativa disponível no sistema"; não era, porque preencher
 * não mudava número nenhum. Primeiro existe o consumidor.
 */

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import {
  channelResultAtPrice,
  computeChannelPrices,
  type ChannelCommission,
  type ChannelPricing,
} from "@/lib/pricing/engine";

interface Ctx {
  orgId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

async function requireCtx(): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "Nenhuma organização ativa" };
  return { ok: true, ctx: { orgId: activeOrg.orgId, supabase: await createClient() } };
}

/** Comissões cadastradas da organização. Lista vazia se nada foi configurado. */
export async function fetchChannelCommissions() {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const { data, error } = await c.ctx.supabase
    .from("platform_commissions")
    .select("platform, commission_pct")
    .eq("organization_id", c.ctx.orgId)
    .order("platform");
  if (error) return { ok: false as const, error: error.message };

  const channels: ChannelCommission[] = (
    (data as Array<{ platform: string; commission_pct: number | string }> | null) ?? []
  ).map((r) => ({
    platform: r.platform,
    commissionPct: Number(r.commission_pct) || 0,
  }));

  return {
    ok: true as const,
    channels,
    /** Todos zerados: o sinal de que o cadastro nunca foi preenchido. */
    allZero: channels.length > 0 && channels.every((ch) => ch.commissionPct === 0),
  };
}

const analiseSchema = z.object({
  /** Custo unitário de produção, em reais. */
  unitCost: z.number().finite().nonnegative(),
  /** Preço praticado hoje, em reais. 0 = ainda não precificado. */
  sellingPrice: z.number().finite().nonnegative().default(0),
  /** Margem líquida que se quer obter, em %. */
  targetMarginPct: z.number().finite().min(0).max(99).default(30),
  /** Alíquota efetiva do Simples. 0 = não configurada. */
  simplesTaxPct: z.number().finite().min(0).max(50).default(0),
});

export interface ChannelAnalysis {
  /** Preço que atingiria a margem alvo, por canal. */
  sugerido: ChannelPricing[];
  /** O que sobra do preço praticado hoje, por canal. */
  atual: ChannelPricing[];
  /** Canais em que o preço de hoje dá PREJUÍZO. */
  canaisNoPrejuizo: string[];
  /** Nenhuma comissão cadastrada: todo número abaixo é otimista. */
  comissoesZeradas: boolean;
}

/**
 * Analisa um produto contra os canais da organização.
 *
 * Devolve as duas metades da pergunta: "por quanto eu deveria vender?" e "o que
 * sobra do preço que está no anúncio hoje?". A segunda é como se descobre que um
 * item passou a dar prejuízo sem ninguém ter mudado nada.
 */
export async function analyzeProductChannels(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = analiseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const { unitCost, sellingPrice, targetMarginPct, simplesTaxPct } = parsed.data;

  const commissions = await fetchChannelCommissions();
  if (!commissions.ok) return { ok: false as const, error: commissions.error };

  const sugerido = computeChannelPrices(unitCost, targetMarginPct, {
    channels: commissions.channels,
    simplesTaxPct,
  });

  const atual =
    sellingPrice > 0
      ? commissions.channels.map((ch) =>
          channelResultAtPrice(unitCost, sellingPrice, ch, simplesTaxPct),
        )
      : [];

  const analysis: ChannelAnalysis = {
    sugerido,
    atual,
    canaisNoPrejuizo: atual.filter((a) => a.netProfit < 0).map((a) => a.channel),
    comissoesZeradas: commissions.allZero,
  };

  return { ok: true as const, analysis };
}
