import { describe, it, expect } from "vitest";
import {
  toWhatsappNumber,
  buildActivationMessage,
  buildUpgradeMessage,
  buildWhatsappUrl,
} from "./whatsapp-message";

describe("toWhatsappNumber", () => {
  it.each([
    ["(31) 99928-4834", "5531999284834"],
    ["31999284834", "5531999284834"],
    ["+55 31 99928-4834", "5531999284834"],
    ["5531999284834", "5531999284834"],
    ["31 3333-4444", "553133334444"],
  ])("normaliza %s -> %s", (entrada, esperado) => {
    expect(toWhatsappNumber(entrada)).toBe(esperado);
  });

  it.each([null, undefined, "", "   ", "abc", "123"])(
    "devolve null para entrada inútil: %s",
    (entrada) => {
      expect(toWhatsappNumber(entrada)).toBeNull();
    },
  );

  it("não duplica o DDI de um número que já tem", () => {
    expect(toWhatsappNumber("+5531999284834")).toBe("5531999284834");
  });
});

describe("buildWhatsappUrl", () => {
  it("monta o link com o texto codificado", () => {
    const url = buildWhatsappUrl("(31) 99928-4834", "Oi, tudo bem?");
    expect(url).toBe("https://wa.me/5531999284834?text=Oi%2C%20tudo%20bem%3F");
  });

  /**
   * O erro que esta função existe para impedir: um link com `?` e `&` cru
   * truncaria a mensagem exatamente no ponto onde o link de ativação começa.
   */
  it("escapa a URL dentro da mensagem sem truncar", () => {
    const link = "https://gltech3d.vercel.app/ativar/abc.def?x=1&y=2";
    const url = buildWhatsappUrl("31999284834", `Entre aqui: ${link}`)!;
    expect(url).toContain(encodeURIComponent(link));
    // Só pode existir um `?` — o que separa o parâmetro `text`.
    expect(url.split("?").length - 1).toBe(1);
    expect(decodeURIComponent(url.split("?text=")[1]!)).toContain(link);
  });

  it("devolve null quando o telefone não serve", () => {
    expect(buildWhatsappUrl(null, "oi")).toBeNull();
    expect(buildWhatsappUrl("123", "oi")).toBeNull();
  });
});

describe("buildActivationMessage", () => {
  it("usa o primeiro nome e inclui o link", () => {
    const msg = buildActivationMessage({
      buyerName: "João Carlos Silva",
      activationUrl: "https://exemplo.com/ativar/xyz",
    });
    expect(msg).toContain("Oi, João!");
    expect(msg).toContain("https://exemplo.com/ativar/xyz");
    expect(msg).not.toContain("Carlos");
  });

  it("funciona sem nome, sem deixar saudação quebrada", () => {
    const msg = buildActivationMessage({ buyerName: "   ", activationUrl: "https://x.com/a" });
    expect(msg.startsWith("Oi!")).toBe(true);
    expect(msg).not.toContain("Oi, !");
  });

  it("inclui a validade quando há data", () => {
    const msg = buildActivationMessage({
      buyerName: "Ana",
      activationUrl: "https://x.com/a",
      expiresAt: new Date("2026-10-12T12:00:00.000Z"),
    });
    expect(msg).toMatch(/vale até \d{2}\/\d{2}\/\d{4}/);
  });

  it("omite a validade quando não há data", () => {
    const msg = buildActivationMessage({ buyerName: "Ana", activationUrl: "https://x.com/a" });
    expect(msg).not.toContain("vale até");
  });
});

describe("buildUpgradeMessage", () => {
  it("não manda criar senha — quem já tem conta já tem senha", () => {
    const msg = buildUpgradeMessage("Ana Paula", "https://gltech3d.vercel.app/app/dashboard");
    expect(msg).toContain("Oi, Ana!");
    expect(msg).toContain("senha que você já usa");
    expect(msg).not.toMatch(/criar sua senha/i);
  });
});
