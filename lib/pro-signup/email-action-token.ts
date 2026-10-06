/**
 * Signed token behind the "Aprovar e liberar" / "Recusar" buttons of the
 * owner's PRO-request email (one click, no login — the owner's decision).
 *
 * Format: `<body>.<sig>`, body = base64url(JSON payload), sig =
 * base64url(HMAC_SHA256(PRO_APPROVAL_TOKEN_SECRET, body)). Same shape as
 * `lib/auth/invite-token.ts`, but a DIFFERENT secret and an explicit `purpose`,
 * so a token minted for one flow can never be replayed in the other.
 *
 * What makes a one-click link acceptable here:
 *  - purpose-bound (`pro_signup_email_action`) and action-bound (`act`): the
 *    "Recusar" link cannot approve, and vice versa;
 *  - short-lived (48h);
 *  - bound to the request id AND the amount (`amt`), checked again against the
 *    row before acting;
 *  - the page that opens it only READS; the mutation is a POST fired only when
 *    the owner clicks "Confirmar…" on that page. Not on load: e-mail security
 *    sandboxes open links in headless browsers that DO run JavaScript;
 *  - the effect is single: only a `pending` request changes state;
 *  - every use emails the owner an alarm with a link to undo it.
 *
 * Without the secret configured the feature is OFF: `sign` returns null (the
 * email falls back to the panel link) and `verify` rejects with `disabled`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { env } from "@/lib/env";
import { absoluteSiteUrl } from "@/lib/marketing/site-url";

export const EMAIL_ACTION_PURPOSE = "pro_signup_email_action" as const;
export const EMAIL_ACTION_TTL_SECONDS = 60 * 60 * 48;
const MIN_SECRET_LENGTH = 32;

export type EmailAction = "approve" | "reject";

export interface EmailActionPayload {
  purpose: typeof EMAIL_ACTION_PURPOSE;
  /** pro_signup_requests.id */
  rid: string;
  act: EmailAction;
  /** amount_cents of the request when the email was sent. */
  amt: number;
  /** epoch seconds */
  exp: number;
}

const payloadSchema = z
  .object({
    purpose: z.string(),
    rid: z.string().uuid(),
    act: z.enum(["approve", "reject"]),
    amt: z.number().int().positive(),
    exp: z.number().int().positive(),
  })
  .strict();

export type VerifyFailure =
  | "disabled"
  | "malformed"
  | "bad_signature"
  | "wrong_purpose"
  | "wrong_action"
  | "expired";

export type VerifyResult =
  | { ok: true; payload: EmailActionPayload }
  | { ok: false; reason: VerifyFailure };

interface Opts {
  /** Overrides the env secret (tests). */
  secret?: string;
  now?: Date;
}

function resolveSecret(override?: string): string | null {
  const secret = override ?? env.PRO_APPROVAL_TOKEN_SECRET;
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

/** True when the one-click buttons can be offered. */
export function isEmailActionEnabled(secret?: string): boolean {
  return resolveSecret(secret) !== null;
}

function hmac(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/** Returns `null` when the feature is disabled (no/short secret). */
export function signEmailActionToken(
  input: { rid: string; act: EmailAction; amt: number },
  opts: Opts = {},
): string | null {
  const secret = resolveSecret(opts.secret);
  if (!secret) return null;
  const now = opts.now ?? new Date();
  const payload: EmailActionPayload = {
    purpose: EMAIL_ACTION_PURPOSE,
    rid: input.rid,
    act: input.act,
    amt: input.amt,
    exp: Math.floor(now.getTime() / 1000) + EMAIL_ACTION_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${hmac(secret, body)}`;
}

/**
 * Verifies signature, purpose, expiry and — when `expectedAct` is given — the
 * action. The signature is checked BEFORE the payload is parsed: nothing from an
 * unsigned body is trusted, not even for the error message.
 */
export function verifyEmailActionToken(
  token: string,
  opts: Opts & { expectedAct?: EmailAction } = {},
): VerifyResult {
  const secret = resolveSecret(opts.secret);
  if (!secret) return { ok: false, reason: "disabled" };

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed" };
  const [body, sig] = parts as [string, string];

  const expected = Buffer.from(hmac(secret, body));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "bad_signature" };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    // Signed but not JSON: only possible with a bug in `sign` or a leaked secret.
    // Handled by rejecting the token.
    return { ok: false, reason: "malformed" };
  }
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "malformed" };
  const p = parsed.data;

  if (p.purpose !== EMAIL_ACTION_PURPOSE) return { ok: false, reason: "wrong_purpose" };
  if (opts.expectedAct && p.act !== opts.expectedAct) return { ok: false, reason: "wrong_action" };

  const nowSec = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  if (p.exp <= nowSec) return { ok: false, reason: "expired" };

  return { ok: true, payload: { ...p, purpose: EMAIL_ACTION_PURPOSE } };
}

/**
 * The two one-click links for the owner's email, or `null` when the feature is
 * off — the email then shows only the panel link. Used by both senders
 * (public intake and in-app upgrade) so they cannot drift.
 */
export function emailActionUrls(
  input: { rid: string; amt: number },
  opts: Opts = {},
): { approveUrl: string; rejectUrl: string } | null {
  const approve = signEmailActionToken({ ...input, act: "approve" }, opts);
  const reject = signEmailActionToken({ ...input, act: "reject" }, opts);
  if (!approve || !reject) return null;
  return {
    approveUrl: absoluteSiteUrl(`/aprovar/${approve}`),
    rejectUrl: absoluteSiteUrl(`/aprovar/${reject}`),
  };
}
