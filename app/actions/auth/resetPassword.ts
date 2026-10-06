"use server";
/**
 * Conclui a redefinição de senha a partir do token assinado.
 *
 * O token é verificado DE NOVO aqui, mesmo que a página já o tenha verificado
 * para errar cedo: a página só decide o que renderizar, esta action é quem
 * decide o acesso.
 */
import { audit } from "@/lib/audit";
import { emailDigest } from "@/lib/audit/email-digest";
import { verifyPasswordResetToken } from "@/lib/auth/password-reset-token";
import { validatePassword, passwordProblemMessage } from "@/lib/auth/password";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export type ResetPasswordResult =
  | { ok: true }
  | {
      ok: false;
      error: "invalid_or_expired" | "weak_password" | "internal_error";
      message?: string;
    };

export async function resetPasswordAction(
  token: string,
  password: string,
): Promise<ResetPasswordResult> {
  const payload = verifyPasswordResetToken(token);
  if (!payload) return { ok: false, error: "invalid_or_expired" };

  const weak = validatePassword(password);
  if (weak) {
    return { ok: false, error: "weak_password", message: passwordProblemMessage(weak) };
  }

  const admin = createAdminClient();

  // O e-mail do token tem que continuar batendo com o da conta. Se a pessoa
  // trocou de e-mail depois de pedir o reset, o link antigo não vale mais.
  const { data: userRes, error: readErr } = await admin.auth.admin.getUserById(payload.userId);
  if (readErr || !userRes.user) {
    logger.warn("password_reset_user_missing", { userId: payload.userId });
    return { ok: false, error: "invalid_or_expired" };
  }
  const currentEmail = (userRes.user.email ?? "").trim().toLowerCase();
  if (currentEmail !== payload.email) {
    return { ok: false, error: "invalid_or_expired" };
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(payload.userId, {
    password,
    email_confirm: true,
  });
  if (updErr) {
    logger.error("password_reset_update_failed", {
      userId: payload.userId,
      details: updErr.message,
    });
    return { ok: false, error: "internal_error", message: updErr.message };
  }

  await audit({
    action: "auth.password_reset_completed",
    actorUserId: payload.userId,
    resourceType: "user",
    resourceId: payload.userId,
    bypassedRls: true,
    metadata: { email_hash: emailDigest(payload.email) },
  });

  // Entra direto: pedir para digitar a senha de novo logo depois de criá-la é
  // atrito sem ganho de segurança — quem chegou aqui provou posse do e-mail.
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: payload.email,
    password,
  });
  if (signInErr) {
    logger.warn("password_reset_signin_failed", { details: signInErr.message });
  }

  return { ok: true };
}
