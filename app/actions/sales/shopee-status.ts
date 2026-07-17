"use server";

import { env } from "@/lib/env";
import { loadAuthUser } from "@/lib/auth/server";

/**
 * Status da integração automática com a Shopee. Retorna SÓ um booleano —
 * nunca os valores das chaves. Enquanto false, a aba Shopee opera no modo
 * manual e mostra o card "aguardando credenciais".
 *
 * A integração completa (OAuth + webhook de pedidos → marketplace_orders) fica
 * bloqueada até o dono da loja criar o app de desenvolvedor na Shopee e
 * preencher SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY.
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
