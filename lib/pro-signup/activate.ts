/**
 * Core of the Calc3D PRO buyer activation (`/ativar/<token>`).
 *
 * THE RULE: activation sets a password ONLY by CREATING the account. It never
 * touches an account that already exists.
 *
 * Why: the activation link is a bearer credential that travels by e-mail and,
 * from the panel, by WhatsApp to a phone the requester typed. Before this rule,
 * a link pointing at an EXISTING account would overwrite that account's
 * password (`updateUserById`) — account takeover for whoever held the link,
 * reusable for 7 days. Now:
 *
 *  - the approval no longer issues a link when the e-mail already has an
 *    account (lib/pro-signup/approve.ts, `existingAccount`); that person logs in
 *    with the current password or uses /esqueci-senha, which mails the REAL
 *    address;
 *  - a link is single-use by construction: the first use creates the account,
 *    every later use finds it existing and is refused (`account_exists`);
 *  - if someone created an account with that e-mail in between (e.g. via
 *    /criar-conta), activation refuses too, instead of attaching that account
 *    to the paid org.
 *
 * No migration needed: "the account does not exist yet" is the single-use
 * marker, enforced atomically by the unique e-mail in auth.users.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

export type ActivateErrorCode = "not_approved" | "account_exists" | "internal_error";

export type ActivateResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; error: ActivateErrorCode; message?: string };

export interface ActivateInput {
  admin: SupabaseClient;
  /** From the VERIFIED invite token. */
  signupId: string;
  organizationId: string;
  email: string;
  /** Already validated for strength by the caller. */
  password: string;
  now?: () => Date;
}

/** Supabase answers "already registered" with 422 / code `email_exists`. */
function isAlreadyRegistered(err: { message?: string; code?: string; status?: number }): boolean {
  if (err.code === "email_exists" || err.code === "user_already_exists") return true;
  return /already (been )?registered|already exists/i.test(err.message ?? "");
}

export async function activateProAccount(input: ActivateInput): Promise<ActivateResult> {
  const { admin } = input;
  const email = input.email.trim().toLowerCase();
  const nowIso = (input.now ?? (() => new Date()))().toISOString();

  // The token is signed, but not the last word: the request must be APPROVED
  // and point at this organization. A token issued and later reverted stops
  // working here.
  const { data: signup, error: signupErr } = await admin
    .from("pro_signup_requests")
    .select("id, status, organization_id")
    .eq("id", input.signupId)
    .maybeSingle();
  if (signupErr) {
    logger.error("pro_activation_lookup_failed", { signupId: input.signupId, details: signupErr.message });
    return { ok: false, error: "internal_error" };
  }
  if (!signup || signup.status !== "approved" || signup.organization_id !== input.organizationId) {
    return { ok: false, error: "not_approved" };
  }

  // The ONLY place a password is set. `email_confirm: true` because possession
  // of the inbox was proven: the link arrived there (or the owner relayed it).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });
  if (createErr) {
    if (isAlreadyRegistered(createErr)) {
      // Link reused, or the account already existed: never overwrite a password.
      logger.warn("pro_activation_account_exists", { signupId: input.signupId });
      return { ok: false, error: "account_exists" };
    }
    logger.error("pro_activation_create_user_failed", {
      signupId: input.signupId,
      details: createErr.message,
    });
    return { ok: false, error: "internal_error" };
  }
  const userId = created.user?.id ?? null;
  if (!userId) return { ok: false, error: "internal_error" };

  // Brand-new user → no membership can exist; plain insert.
  const { error: memberErr } = await admin.from("user_organizations").insert({
    user_id: userId,
    organization_id: input.organizationId,
    role: "admin",
    invited_at: nowIso,
    accepted_at: nowIso,
  });
  if (memberErr) {
    logger.error("pro_activation_membership_insert_failed", {
      signupId: input.signupId,
      details: memberErr.message,
    });
    // Undo the account so the (single-use) link can be retried. If the undo
    // fails too, the link is burnt and the operator must intervene — say so.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      logger.error("pro_activation_rollback_failed", {
        signupId: input.signupId,
        userId,
        details: delErr.message,
      });
    }
    return { ok: false, error: "internal_error" };
  }

  // Onboarding done the moment someone can log in. Guard is `onboarded_at IS
  // NULL` (status is always 'active'); without it the buyer lands in the
  // WhatsApp/Nuvemshop wizard.
  const { error: onboardErr } = await admin
    .from("organizations")
    .update({ onboarded_at: nowIso })
    .eq("id", input.organizationId)
    .is("onboarded_at", null);
  if (onboardErr) {
    logger.error("pro_activation_onboarded_at_failed", {
      organizationId: input.organizationId,
      details: onboardErr.message,
    });
  }

  return { ok: true, userId, email };
}
