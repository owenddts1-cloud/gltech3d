import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";

import {
  EMAIL_ACTION_TTL_SECONDS,
  isEmailActionEnabled,
  signEmailActionToken,
  verifyEmailActionToken,
} from "./email-action-token";

const SECRET = "s".repeat(48);
const OTHER = "o".repeat(48);
const RID = "9f3e1b2c-1111-4000-8000-000000000001";
const NOW = new Date("2026-10-06T12:00:00.000Z");

function sign(act: "approve" | "reject" = "approve", secret = SECRET): string {
  const t = signEmailActionToken({ rid: RID, act, amt: 19_700 }, { secret, now: NOW });
  if (!t) throw new Error("token should have been signed");
  return t;
}

/** Re-signs an arbitrary payload with the real secret — a "leaked format" attack. */
function forge(payload: Record<string, unknown>, secret = SECRET): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

describe("email action token", () => {
  it("válido: devolve o payload com rid, ação e valor", () => {
    const res = verifyEmailActionToken(sign(), { secret: SECRET, now: NOW, expectedAct: "approve" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.rid).toBe(RID);
      expect(res.payload.act).toBe("approve");
      expect(res.payload.amt).toBe(19_700);
      expect(res.payload.exp).toBe(Math.floor(NOW.getTime() / 1000) + EMAIL_ACTION_TTL_SECONDS);
    }
  });

  it("expirado depois de 48h", () => {
    const later = new Date(NOW.getTime() + (EMAIL_ACTION_TTL_SECONDS + 1) * 1000);
    expect(verifyEmailActionToken(sign(), { secret: SECRET, now: later })).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("adulterado: trocar o corpo invalida a assinatura", () => {
    const [body, sig] = sign().split(".") as [string, string];
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    payload.amt = 1;
    const tamperedBody = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    expect(verifyEmailActionToken(`${tamperedBody}.${sig}`, { secret: SECRET, now: NOW })).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("assinado com outro segredo é recusado", () => {
    expect(verifyEmailActionToken(sign("approve", OTHER), { secret: SECRET, now: NOW })).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("propósito errado é recusado mesmo com assinatura válida", () => {
    const token = forge({
      purpose: "invite",
      rid: RID,
      act: "approve",
      amt: 19_700,
      exp: Math.floor(NOW.getTime() / 1000) + 60,
    });
    expect(verifyEmailActionToken(token, { secret: SECRET, now: NOW })).toEqual({
      ok: false,
      reason: "wrong_purpose",
    });
  });

  it("ação trocada: o link de Recusar não aprova", () => {
    expect(
      verifyEmailActionToken(sign("reject"), { secret: SECRET, now: NOW, expectedAct: "approve" }),
    ).toEqual({ ok: false, reason: "wrong_action" });
  });

  it("formato quebrado", () => {
    expect(verifyEmailActionToken("abc", { secret: SECRET, now: NOW }).ok).toBe(false);
    expect(verifyEmailActionToken("a.b.c", { secret: SECRET, now: NOW }).ok).toBe(false);
    expect(verifyEmailActionToken(".", { secret: SECRET, now: NOW }).ok).toBe(false);
  });

  it("sem segredo (ou segredo curto) a funcionalidade fica desligada", () => {
    expect(isEmailActionEnabled("")).toBe(false);
    expect(isEmailActionEnabled("curto")).toBe(false);
    expect(isEmailActionEnabled(SECRET)).toBe(true);
    expect(signEmailActionToken({ rid: RID, act: "approve", amt: 1 }, { secret: "" })).toBeNull();
    expect(verifyEmailActionToken(sign(), { secret: "" })).toEqual({
      ok: false,
      reason: "disabled",
    });
  });
});
