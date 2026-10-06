"use server";
/**
 * Ativação da conta do comprador do Calc3D PRO.
 *
 * POR QUE ISTO EXISTE, em vez de reusar `acceptInviteAction`: aquela ação exige
 * usuário JÁ AUTENTICADO, e o comprador novo não tem conta. O comprador define a
 * própria senha aqui (nada de senha temporária por e-mail, nada de
 * `generateLink`, que exigiria callback na allowlist do Supabase e quebraria o
 * kit self-host).
 *
 * A regra de segurança mora em `lib/pro-signup/activate.ts`: a senha só é
 * definida CRIANDO a conta — nunca numa conta que já existe. Isso impede que o
 * link (que circula por e-mail e WhatsApp) sirva para tomar a conta de alguém,
 * e torna o link de uso único.
 */
import { audit } from "@/lib/audit";
import { verifyInviteToken } from "@/lib/auth/invite-token";
import { validatePassword, passwordProblemMessage } from "@/lib/auth/password";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { activateProAccount } from "@/lib/pro-signup/activate";

export type ActivateAccountResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "invalid_or_expired"
        | "weak_password"
        | "not_approved"
        | "account_exists"
        | "internal_error";
      message?: string;
    };

export async function activateAccountAction(
  token: string,
  password: string,
): Promise<ActivateAccountResult> {
  const payload = verifyInviteToken(token);
  if (!payload) return { ok: false, error: "invalid_or_expired" };

  const weak = validatePassword(password);
  if (weak) {
    return { ok: false, error: "weak_password", message: passwordProblemMessage(weak) };
  }

  const res = await activateProAccount({
    admin: createAdminClient(),
    signupId: payload.invite_id,
    organizationId: payload.organization_id,
    email: payload.email,
    password,
  });
  if (!res.ok) return { ok: false, error: res.error };

  await audit({
    action: "pro_signup.activated",
    actorUserId: res.userId,
    organizationId: payload.organization_id,
    resourceType: "pro_signup_request",
    resourceId: payload.invite_id,
    bypassedRls: true,
    metadata: { role: "admin", account: "created" },
  });

  // Entra de verdade: sem isto o comprador cairia na tela de login logo depois
  // de digitar a senha que acabou de criar.
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: res.email,
    password,
  });
  if (signInErr) {
    // A conta existe e está liberada; só a sessão não subiu. Mandar para o login
    // é degradação aceitável — o importante é não dizer que falhou.
    logger.warn("pro_activation_signin_failed", {
      signupId: payload.invite_id,
      details: signInErr.message,
    });
  }

  return { ok: true };
}
