import { env } from "@/lib/env";

/**
 * Último recurso quando `PRO_SIGNUP_NOTIFY_EMAIL` não está configurada.
 *
 * Estava copiado em quatro rotas (`leads`, `pro-signup`, `signup`,
 * `pro-signup/upgrade`). A divergência que isso produz é silenciosa: alguém
 * troca o endereço num arquivo, e três fluxos continuam avisando a caixa antiga
 * sem erro nenhum aparecer.
 */
const FALLBACK_OWNER_EMAIL = "diretoria.gltech@gmail.com";

/**
 * Para onde vão os avisos operacionais: pedido de pagamento, trial iniciado,
 * lead capturado.
 *
 * Fonte única. Configure `PRO_SIGNUP_NOTIFY_EMAIL` para mudar sem tocar código.
 */
export function ownerNotifyEmail(): string {
  return env.PRO_SIGNUP_NOTIFY_EMAIL || FALLBACK_OWNER_EMAIL;
}
