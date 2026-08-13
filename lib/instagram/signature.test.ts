/**
 * A assinatura é a única coisa que separa "evento do Instagram" de "alguém
 * mandando JSON num endereço público". Estes testes existem porque o modo de
 * falhar é silencioso: um webhook que aceita tudo funciona perfeitamente até
 * alguém descobrir a URL.
 */

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { answerVerificationChallenge, verifyMetaSignature } from "./signature";

const SEGREDO = "app-secret-de-teste";
const CORPO = '{"object":"instagram","entry":[{"id":"1784","time":1}]}';

const assinar = (corpo: string, segredo = SEGREDO) =>
  `sha256=${createHmac("sha256", segredo).update(corpo, "utf8").digest("hex")}`;

describe("verifyMetaSignature", () => {
  it("aceita a assinatura correta", () => {
    expect(verifyMetaSignature(CORPO, assinar(CORPO), SEGREDO)).toBe(true);
  });

  it("RECUSA corpo adulterado — o caso que importa", () => {
    const assinatura = assinar(CORPO);
    const adulterado = CORPO.replace('"1784"', '"9999"');
    expect(verifyMetaSignature(adulterado, assinatura, SEGREDO)).toBe(false);
  });

  it("recusa assinatura feita com outro segredo", () => {
    expect(verifyMetaSignature(CORPO, assinar(CORPO, "outro-segredo"), SEGREDO)).toBe(false);
  });

  it("recusa cabeçalho ausente, vazio ou sem o prefixo", () => {
    const hex = assinar(CORPO).slice("sha256=".length);
    expect(verifyMetaSignature(CORPO, null, SEGREDO)).toBe(false);
    expect(verifyMetaSignature(CORPO, "", SEGREDO)).toBe(false);
    expect(verifyMetaSignature(CORPO, hex, SEGREDO)).toBe(false); // sem "sha256="
    expect(verifyMetaSignature(CORPO, `sha1=${hex}`, SEGREDO)).toBe(false);
  });

  it("recusa hex malformado em vez de aceitar pedaço", () => {
    // `Buffer.from("zz", "hex")` não lança: devolve buffer vazio. Sem a
    // validação de formato, uma assinatura vazia poderia passar por caminhos
    // menos cuidadosos.
    for (const ruim of ["sha256=", "sha256=zz", "sha256=abc", `sha256=${"a".repeat(63)}`, `sha256=${"a".repeat(65)}`]) {
      expect(verifyMetaSignature(CORPO, ruim, SEGREDO)).toBe(false);
    }
  });

  it("FALHA FECHADO quando o segredo não está configurado", () => {
    // Sem App Secret no ambiente, o correto é recusar tudo — não aceitar tudo.
    expect(verifyMetaSignature(CORPO, assinar(CORPO), "")).toBe(false);
  });

  it("é sensível a espaço — o corpo CRU é o que foi assinado", () => {
    // Reserializar o JSON antes de conferir quebra a assinatura. Este teste
    // trava o comportamento: quem trocar `req.text()` por `req.json()` no
    // handler quebra AQUI, e não em produção com evento recusado em silêncio.
    //
    // O corpo tem espaçamento de propósito: a Meta não garante forma canônica, e
    // um corpo que por acaso já esteja canônico não provaria nada.
    const comEspaco = '{ "object": "instagram", "entry": [ { "id": "1784" } ] }';
    const assinatura = assinar(comEspaco);
    const reserializado = JSON.stringify(JSON.parse(comEspaco));

    expect(reserializado).not.toBe(comEspaco);
    expect(verifyMetaSignature(comEspaco, assinatura, SEGREDO)).toBe(true);
    expect(verifyMetaSignature(reserializado, assinatura, SEGREDO)).toBe(false);
  });

  it("aceita corpo com acento e emoji", () => {
    const corpo = '{"text":"Olá! Quero o preço 😊"}';
    expect(verifyMetaSignature(corpo, assinar(corpo), SEGREDO)).toBe(true);
  });
});

describe("answerVerificationChallenge", () => {
  const params = (o: Record<string, string>) => new URLSearchParams(o);

  it("devolve o desafio quando o token confere", () => {
    const p = params({ "hub.mode": "subscribe", "hub.verify_token": "abc", "hub.challenge": "12345" });
    expect(answerVerificationChallenge(p, "abc")).toBe("12345");
  });

  it("RECUSA token errado — senão qualquer um registra o seu endpoint", () => {
    const p = params({ "hub.mode": "subscribe", "hub.verify_token": "errado", "hub.challenge": "12345" });
    expect(answerVerificationChallenge(p, "abc")).toBeNull();
  });

  it("recusa modo diferente de subscribe", () => {
    const p = params({ "hub.mode": "unsubscribe", "hub.verify_token": "abc", "hub.challenge": "1" });
    expect(answerVerificationChallenge(p, "abc")).toBeNull();
  });

  it("recusa quando falta desafio ou token", () => {
    expect(answerVerificationChallenge(params({ "hub.mode": "subscribe", "hub.challenge": "1" }), "abc")).toBeNull();
    expect(answerVerificationChallenge(params({ "hub.mode": "subscribe", "hub.verify_token": "abc" }), "abc")).toBeNull();
  });

  it("falha fechado sem token esperado configurado", () => {
    const p = params({ "hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "1" });
    expect(answerVerificationChallenge(p, "")).toBeNull();
  });
});
