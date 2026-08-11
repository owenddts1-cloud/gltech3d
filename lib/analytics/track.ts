/**
 * Ponto único de disparo de evento.
 *
 * POR QUE UM PONTO SÓ. A auditoria apontou o problema de fundo: "você está
 * otimizando no escuro" — nenhum GA4, nenhum Pixel, nenhum Vercel Analytics, só
 * Sentry. Sem evento de clique no WhatsApp, clique em marketplace e envio de
 * orçamento, nenhuma outra melhoria pode ser medida.
 *
 * Mas colocar três SDKs e sair chamando os três em cada botão é como o
 * rastreamento vira inconsistente: alguém acrescenta um CTA e lembra de dois dos
 * três. Aqui a tela chama `track()` e este módulo decide quem recebe.
 *
 * A REGRA DE CONSENTIMENTO ESTÁ AQUI, e é o motivo mais forte para centralizar:
 *
 *   Vercel Analytics — SEM cookie. Dispara sempre.
 *   GA4 e Meta Pixel — usam cookie. Só depois do aceite explícito.
 *
 * Disparar GA4 sem aceite seria não-conformidade com a LGPD na mesma página que
 * publica a política de privacidade. Com a decisão neste arquivo, nenhuma tela
 * consegue errar isso por esquecimento.
 */

import { track as vercelTrack } from "@vercel/analytics";

import { hasAnalyticsConsent } from "./consent";

/**
 * Eventos que a operação precisa. Lista fechada de propósito: `string` livre
 * produz `click_whats`, `clickWhatsapp` e `whatsapp_click` como três eventos
 * distintos, e o relatório fica inútil três meses depois.
 */
export type AnalyticsEvent =
  | "view_item"
  | "click_whatsapp"
  | "click_comprar"
  | "click_marketplace"
  | "submit_orcamento"
  | "scroll_to_catalog";

/** Valores simples. Nada de objeto aninhado: os três destinos achatam mesmo. */
export type AnalyticsProps = Record<string, string | number | boolean | null>;

interface GtagWindow {
  gtag?: (command: "event", name: string, params?: Record<string, unknown>) => void;
  fbq?: (command: "trackCustom", name: string, params?: Record<string, unknown>) => void;
}

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  // Vercel Analytics: sem cookie, então não depende de aceite.
  try {
    vercelTrack(event, props);
  } catch {
    // Medição nunca pode derrubar a página. Um bloqueador de anúncio que remove
    // o script faz a chamada estourar, e o cliente perderia o clique de compra
    // por causa do rastreamento — exatamente o oposto do objetivo.
  }

  if (!hasAnalyticsConsent()) return;

  const w = window as unknown as GtagWindow;
  try {
    w.gtag?.("event", event, props);
  } catch {
    // idem
  }
  try {
    w.fbq?.("trackCustom", event, props);
  } catch {
    // idem
  }
}
