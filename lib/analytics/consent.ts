/**
 * Consentimento de rastreamento com cookie (LGPD).
 *
 * O site coleta dados pessoais em formulário e publica política de privacidade.
 * Carregar GA4 e Meta Pixel — que gravam cookie e enviam identificador a
 * terceiro — antes de qualquer aceite contradiz a própria política na mesma
 * página. Este módulo guarda a decisão do visitante e é a ÚNICA fonte que
 * `lib/analytics/track.ts` consulta.
 *
 * Vercel Analytics fica fora desta trava de propósito: não usa cookie nem
 * identificador de visitante, então mede sem exigir aceite. É o que permite ter
 * número desde o primeiro dia, mesmo com quem recusar.
 *
 * `localStorage` e não cookie: a preferência é do navegador, não precisa viajar
 * em toda requisição, e guardar consentimento num cookie é a ironia que se
 * espera evitar.
 */

const KEY = "gl3d.analytics-consent";

export type ConsentState = "granted" | "denied" | "unset";

/** Sem `window` (render do servidor) trata como não consentido. */
export function readConsent(): ConsentState {
  if (typeof window === "undefined") return "unset";
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw === "granted" || raw === "denied" ? raw : "unset";
  } catch {
    // Modo privado de alguns navegadores lança ao ler `localStorage`. Falhar
    // fechado é o certo aqui: sem leitura, sem rastreamento com cookie.
    return "unset";
  }
}

export function hasAnalyticsConsent(): boolean {
  return readConsent() === "granted";
}

/** Grava a escolha e avisa quem estiver ouvindo, para reagir sem recarregar. */
export function writeConsent(state: Exclude<ConsentState, "unset">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, state);
  } catch {
    // Sem persistência a escolha vale só para esta aba — melhor que quebrar.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
}

export const CONSENT_EVENT = "gl3d:analytics-consent";
