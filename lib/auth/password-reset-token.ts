/**
 * Token de redefinição de senha.
 *
 * Reusa o HMAC de `invite-token.ts` em vez de inventar um segundo formato
 * assinado — mas com um DISCRIMINADOR obrigatório no campo `role`.
 *
 * Por que o discriminador é essencial: sem ele, um token de convite de equipe
 * (que carrega `role: 'admin'` e vale 7 dias) seria aceito pela tela de
 * redefinição, e qualquer convite viraria um "troque a senha desta conta". O
 * emissor grava `PASSWORD_RESET_ROLE`, e o verificador recusa qualquer outro
 * valor.
 */
import { signInviteToken, verifyInviteToken } from "@/lib/auth/invite-token";

/** Nunca é um papel real de `user_organizations` — é um rótulo de propósito. */
export const PASSWORD_RESET_ROLE = "password_reset";

/** Uma hora. Curto de propósito: o link dá acesso total à conta. */
export const PASSWORD_RESET_TTL_SECONDS = 60 * 60;

export interface PasswordResetPayload {
  userId: string;
  email: string;
}

export function signPasswordResetToken(
  payload: PasswordResetPayload,
  now: Date = new Date(),
): string {
  return signInviteToken({
    invite_id: payload.userId,
    email: payload.email.trim().toLowerCase(),
    // O payload do invite exige organization_id; redefinição de senha não tem
    // org, e gravar uma seria mentira. String vazia, nunca lida.
    organization_id: "",
    role: PASSWORD_RESET_ROLE,
    exp: Math.floor(now.getTime() / 1000) + PASSWORD_RESET_TTL_SECONDS,
  });
}

/** `null` para assinatura inválida, expirado OU propósito diferente. */
export function verifyPasswordResetToken(token: string): PasswordResetPayload | null {
  const payload = verifyInviteToken(token);
  if (!payload) return null;
  if (payload.role !== PASSWORD_RESET_ROLE) return null;
  if (!payload.invite_id || !payload.email) return null;
  return { userId: payload.invite_id, email: payload.email };
}
