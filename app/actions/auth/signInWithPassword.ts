"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { loginSchema, type LoginInput } from "@/lib/auth/schemas";
import { audit, hashEmail } from "@/lib/audit";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { isTrustedDevice } from "@/lib/auth/trusted-device";

export type SignInResult = {
  ok: false;
  error: "invalid_credentials" | "rate_limited" | "validation_error" | "mfa_required";
  details?: Record<string, unknown>;
  challengeId?: string;
};

/**
 * Sign in with password.
 *
 * On success: redirects server-side to `next` (or /app/inbox / /onboarding/mfa).
 * The redirect ensures Set-Cookie headers from supabase.auth propagate before
 * middleware re-evaluates the session — fixes Next 15 Server Action cookie
 * propagation race.
 *
 * On failure: returns an error discriminator. Caller renders inline message.
 */
export async function signInWithPassword(
  input: LoginInput,
  next?: string,
): Promise<SignInResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation_error",
      details: parsed.error.flatten().fieldErrors,
    };
  }

  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = hdrs.get("user-agent") ?? null;

  // Rate Limiting — máximo de 5 tentativas de login por minuto por IP.
  const rl = await checkRateLimit(`login-attempt:${ip ?? "unknown"}`, 5, 60);
  if (!rl.allowed) {
    await audit({
      action: "auth.login_failed",
      metadata: {
        email_hash: hashEmail(parsed.data.email),
        reason: "rate_limited",
      },
      requestId,
      ip,
      userAgent,
    });
    return { ok: false, error: "rate_limited" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    await audit({
      action: "auth.login_failed",
      metadata: {
        email_hash: hashEmail(parsed.data.email),
        reason: error?.message ?? "unknown",
      },
      requestId,
      ip,
      userAgent,
    });
    return { ok: false, error: "invalid_credentials" };
  }

  // MFA gating — se o usuário tem TOTP verificado, exigimos o desafio a menos que
  // este dispositivo já tenha sido aprovado e marcado como confiável.
  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = factorsData?.totp?.find((f) => f.status === "verified");
  if (verifiedTotp) {
    const trusted = await isTrustedDevice(data.user.id);
    if (!trusted) {
      return { ok: false, error: "mfa_required", challengeId: verifiedTotp.id };
    }
  }

  await audit({
    action: "auth.login_success",
    actorUserId: data.user.id,
    metadata: {},
    requestId,
    ip,
    userAgent,
  });

  // Server-side redirect ensures fresh session cookie is sent to browser.
  redirect(next || "/portal");
}
