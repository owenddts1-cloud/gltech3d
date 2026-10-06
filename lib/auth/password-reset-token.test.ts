/**
 * O ponto crítico deste módulo é o DISCRIMINADOR de propósito.
 *
 * Sem ele, um token de convite de equipe — que carrega `role: 'admin'` e vale 7
 * dias — seria aceito pela tela de redefinição, e todo convite viraria um
 * "troque a senha desta conta". O teste abaixo trava isso.
 */
import { describe, it, expect } from "vitest";
import { signInviteToken } from "./invite-token";
import {
  signPasswordResetToken,
  verifyPasswordResetToken,
  PASSWORD_RESET_ROLE,
  PASSWORD_RESET_TTL_SECONDS,
} from "./password-reset-token";

const USER = "11111111-1111-4111-8111-111111111111";
const EMAIL = "pessoa@exemplo.com";

describe("password-reset-token", () => {
  it("faz round-trip preservando usuário e e-mail", () => {
    const out = verifyPasswordResetToken(signPasswordResetToken({ userId: USER, email: EMAIL }));
    expect(out).toEqual({ userId: USER, email: EMAIL });
  });

  it("normaliza o e-mail para minúsculas", () => {
    const out = verifyPasswordResetToken(
      signPasswordResetToken({ userId: USER, email: "  Pessoa@Exemplo.COM " }),
    );
    expect(out?.email).toBe(EMAIL);
  });

  it("RECUSA um token de convite de equipe, mesmo válido e assinado", () => {
    const convite = signInviteToken({
      invite_id: USER,
      email: EMAIL,
      organization_id: "22222222-2222-4222-8222-222222222222",
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    expect(verifyPasswordResetToken(convite)).toBeNull();
  });

  it.each(["viewer", "agent", "manager", "admin", ""])(
    "recusa token com role '%s'",
    (role) => {
      const t = signInviteToken({
        invite_id: USER,
        email: EMAIL,
        organization_id: "",
        role,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      expect(verifyPasswordResetToken(t)).toBeNull();
    },
  );

  it("aceita somente o role de propósito", () => {
    const t = signInviteToken({
      invite_id: USER,
      email: EMAIL,
      organization_id: "",
      role: PASSWORD_RESET_ROLE,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    expect(verifyPasswordResetToken(t)).not.toBeNull();
  });

  it("expira em uma hora, não nos 7 dias do convite", () => {
    expect(PASSWORD_RESET_TTL_SECONDS).toBe(3600);
    const vencido = signPasswordResetToken(
      { userId: USER, email: EMAIL },
      new Date(Date.now() - (PASSWORD_RESET_TTL_SECONDS + 60) * 1000),
    );
    expect(verifyPasswordResetToken(vencido)).toBeNull();
  });

  it("recusa corpo adulterado sem reassinatura", () => {
    const token = signPasswordResetToken({ userId: USER, email: EMAIL });
    const [body, sig] = token.split(".");
    const decoded = JSON.parse(Buffer.from(body!, "base64url").toString("utf8")) as {
      email: string;
    };
    decoded.email = "invasor@exemplo.com";
    const forjado = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");
    expect(verifyPasswordResetToken(`${forjado}.${sig}`)).toBeNull();
  });

  it.each(["", "semponto", "a.b.c", ".abc", "abc."])("recusa token malformado: %s", (t) => {
    expect(verifyPasswordResetToken(t)).toBeNull();
  });
});
