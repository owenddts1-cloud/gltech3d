import { describe, it, expect } from "vitest";
import { signInviteToken, verifyInviteToken, INVITE_TTL_SECONDS } from "./invite-token";

const base = () => ({
  invite_id: "11111111-1111-1111-1111-111111111111",
  email: "alice@example.com",
  organization_id: "22222222-2222-2222-2222-222222222222",
  role: "agent",
  exp: Math.floor(Date.now() / 1000) + INVITE_TTL_SECONDS,
});

describe("invite-token", () => {
  it("sign+verify roundtrip recovers payload", () => {
    const payload = base();
    const token = signInviteToken(payload);
    const out = verifyInviteToken(token);
    expect(out).toEqual(payload);
  });

  it("returns null for expired token", () => {
    const expired = { ...base(), exp: Math.floor(Date.now() / 1000) - 10 };
    const token = signInviteToken(expired);
    expect(verifyInviteToken(token)).toBeNull();
  });

  it("returns null for tampered signature", () => {
    const token = signInviteToken(base());
    const parts = token.split(".");
    const body = parts[0]!;
    const sig = parts[1]!;
    const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    expect(verifyInviteToken(`${body}.${flipped}`)).toBeNull();
  });

  it("returns null for tampered body", () => {
    const token = signInviteToken(base());
    const parts = token.split(".");
    const body = parts[0]!;
    const sig = parts[1]!;
    const flipped = body.slice(0, -1) + (body.endsWith("A") ? "B" : "A");
    expect(verifyInviteToken(`${flipped}.${sig}`)).toBeNull();
  });

  it("returns null for malformed token (no dot)", () => {
    expect(verifyInviteToken("notatoken")).toBeNull();
  });
});

/**
 * Este token deixou de ser só convite de equipe: ele também é a credencial de
 * ativação do comprador do Calc3D PRO, e `activateAccountAction` cria conta e
 * grava `user_organizations` com o `role` que vem dentro dele. Os casos abaixo
 * são os caminhos que essa segunda função de uso tornou relevantes.
 */
describe("invite-token — uso como credencial de ativação", () => {
  it("rejeita escalonamento de role sem reassinar", () => {
    const token = signInviteToken({ ...base(), role: "viewer" });
    const parts = token.split(".");
    const sig = parts[1]!;
    const decoded = JSON.parse(Buffer.from(parts[0]!, "base64url").toString("utf8")) as {
      role: string;
    };
    decoded.role = "admin";
    const forged = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");
    expect(verifyInviteToken(`${forged}.${sig}`)).toBeNull();
  });

  it("rejeita troca de organization_id sem reassinar", () => {
    const token = signInviteToken(base());
    const parts = token.split(".");
    const sig = parts[1]!;
    const decoded = JSON.parse(Buffer.from(parts[0]!, "base64url").toString("utf8")) as {
      organization_id: string;
    };
    decoded.organization_id = "33333333-3333-3333-3333-333333333333";
    const forged = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");
    expect(verifyInviteToken(`${forged}.${sig}`)).toBeNull();
  });

  // Caminho distinto do "tampered signature": aqui a verificação sai pelo
  // `sig.length !== expected.length`, antes do timingSafeEqual — que lançaria
  // com buffers de tamanhos diferentes.
  it("rejeita assinatura de comprimento diferente sem estourar", () => {
    const token = signInviteToken(base());
    const body = token.split(".")[0]!;
    expect(verifyInviteToken(`${body}.curta`)).toBeNull();
  });

  it("rejeita corpo bem assinado que não tem o formato de convite", () => {
    const sig = signInviteToken(base()).split(".")[1]!;
    const body = Buffer.from(JSON.stringify({ foo: "bar" }), "utf8").toString("base64url");
    expect(verifyInviteToken(`${body}.${sig}`)).toBeNull();
  });

  it.each([
    ["pontos demais", "a.b.c"],
    ["corpo vazio", ".abc"],
    ["assinatura vazia", "abc."],
    ["string vazia", ""],
  ])("rejeita token malformado: %s", (_label, token) => {
    expect(verifyInviteToken(token)).toBeNull();
  });
});
