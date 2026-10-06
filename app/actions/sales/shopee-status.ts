"use server";

import { env } from "@/lib/env";
import { loadAuthUser } from "@/lib/auth/server";

/**
 * Se as credenciais da Shopee (SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY) foram
 * informadas. Retorna SÓ um booleano — nunca os valores das chaves.
 *
 * Não existe integração automática ainda (sem OAuth, sem webhook de pedidos,
 * sem sync): nos dois estados as vendas da Shopee são lançadas manualmente, e o
 * ShopeeStatusCard diz isso. `configured = true` só acrescenta no card que as
 * credenciais já foram informadas e serão usadas quando a integração
 * (planejada) for liberada.
 */
export async function getShopeeIntegrationStatus(): Promise<{
  ok: boolean;
  configured: boolean;
}> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, configured: false };
  const configured = Boolean(env.SHOPEE_PARTNER_ID && env.SHOPEE_PARTNER_KEY);
  return { ok: true, configured };
}
