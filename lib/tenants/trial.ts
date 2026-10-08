/**
 * Duração PADRÃO do trial. O valor vivo vem de `platform_settings.trial_days`
 * (`getTrialDaysLive()` em lib/pricing/settings.ts); esta constante é o default
 * dele e o fallback quando a linha não pode ser lida.
 */
export const TRIAL_DAYS = 7;

/** Fim do trial a partir de agora, em ISO. */
export function trialEndsAtFrom(now: Date = new Date(), days: number = TRIAL_DAYS): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}

/**
 * Slug livre a partir de um nome, tentando sufixos curtos em caso de colisão.
 *
 * Não tenta garantir unicidade consultando o banco antes: o índice único é a
 * autoridade, e um "SELECT para ver se existe" seguido de INSERT é uma corrida
 * esperando acontecer. O chamador tenta, pega `slug_conflict` e pede o próximo.
 */
export function slugCandidates(base: string, attempts = 4): string[] {
  const clean = base.length >= 2 ? base : "oficina";
  const out = [clean];
  for (let i = 1; i < attempts; i++) {
    // Sufixo curto e aleatório: sequencial (-2, -3) vaza quantos tenants
    // existem com aquele nome.
    const suffix = Math.random().toString(36).slice(2, 6);
    out.push(`${clean.slice(0, 35)}-${suffix}`);
  }
  return out;
}
