/**
 * Canais de venda: normalização e herança.
 *
 * Módulo PURO — sem I/O, sem `server-only`, para ser usado tanto no servidor
 * (repositório da vitrine, preview do rascunho) quanto no cliente (mostrar ao
 * usuário qual link ele vai herdar se deixar o campo vazio).
 *
 * A REGRA: link próprio da peça vence; canal ausente OU VAZIO herda o link
 * global da loja (`landing_settings.links`). É o que faz um produto recém
 * cadastrado no CRM já nascer com botão de compra, sem ninguém recolar quatro
 * URLs por peça.
 *
 * O merge vivia duplicado em `repository.ts` e `draft.ts`. Duplicado, ele podia
 * divergir entre o site e o preview — que é exatamente o tipo de bug que só
 * aparece depois de publicado.
 */

import type { ProductLinks } from "@/lib/landing/types";

/** Canais conhecidos. Chave fora desta lista é descartada na leitura do jsonb. */
export const LINK_CHANNELS = ["shopee", "mercadoLivre", "whatsapp", "instagram"] as const;
export type LinkChannel = (typeof LINK_CHANNELS)[number];

/** Rótulo de UI de cada canal. */
export const LINK_CHANNEL_LABEL: Record<LinkChannel, string> = {
  shopee: "Shopee",
  mercadoLivre: "Mercado Livre",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

/** jsonb solto → `ProductLinks`. String vazia é tratada como ausência. */
export function asLinks(value: unknown): ProductLinks {
  if (typeof value !== "object" || value === null) return {};
  const raw = value as Record<string, unknown>;
  const out: ProductLinks = {};
  for (const channel of LINK_CHANNELS) {
    const v = raw[channel];
    if (typeof v === "string" && v.trim().length > 0) out[channel] = v;
  }
  return out;
}

/**
 * Global da loja + o que a peça sobrescreve.
 *
 * Como `asLinks` já descarta string vazia, limpar o campo na tela volta a herdar
 * o global em vez de deixar a peça sem canal — que é o comportamento esperado
 * por quem apaga um link.
 */
export function mergeProductLinks(global: unknown, own: unknown): ProductLinks {
  return { ...asLinks(global), ...asLinks(own) };
}

/**
 * Quais canais desta peça vêm do global (para a UI dizer "herdado da loja").
 * Só faz sentido chamar com os links CRUS da peça, não com os já mesclados.
 */
export function inheritedChannels(global: unknown, own: unknown): LinkChannel[] {
  const g = asLinks(global);
  const o = asLinks(own);
  return LINK_CHANNELS.filter((c) => !o[c] && Boolean(g[c]));
}
