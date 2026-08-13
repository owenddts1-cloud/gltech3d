/**
 * O motor de regras é onde a automação decide, e onde o erro é caro dos dois
 * lados: não casar deixa venda passar; casar demais faz o robô responder onde
 * não devia, na frente do cliente.
 */

import { describe, expect, it } from "vitest";

import {
  containsKeyword,
  matchRule,
  normalizeText,
  renderTemplate,
  type AutomationRule,
} from "./rules";

const regra = (over: Partial<AutomationRule> = {}): AutomationRule => ({
  id: "r1",
  triggerType: "comment",
  mediaId: null,
  keywords: ["preco"],
  priority: 100,
  isActive: true,
  ...over,
});

describe("containsKeyword — o caso que parece trivial e não é", () => {
  it("casa com acento, sem acento e em qualquer caixa", () => {
    for (const t of ["PREÇO", "preço", "Preco", "PRECO"]) {
      expect(containsKeyword(t, "preco")).toBe(true);
    }
  });

  it("casa no meio da frase", () => {
    expect(containsKeyword("Boa noite, quanto é o preço disso?", "preco")).toBe(true);
  });

  it("casa com pontuação colada", () => {
    for (const t of ["preço?", "preço!", "(preço)", "preço."]) {
      expect(containsKeyword(t, "preco")).toBe(true);
    }
  });

  it("casa com o PLURAL — ninguém escreve exatamente a palavra cadastrada", () => {
    expect(containsKeyword("quais os preços?", "preco")).toBe(true);
    expect(containsKeyword("tem STLs?", "stl")).toBe(true);
  });

  it("NÃO casa como pedaço de outra palavra — o erro caro", () => {
    // "STL" dentro de "instalação" faria o robô responder a quem falava de
    // instalação, com uma DM sobre arquivo 3D.
    expect(containsKeyword("preciso de instalação", "stl")).toBe(false);
    expect(containsKeyword("apreço pelo trabalho", "preco")).toBe(false);
  });

  it("acha a segunda ocorrência quando a primeira é pedaço de palavra", () => {
    // Sem continuar a busca, "instalação" na frente esconderia o "STL" real.
    expect(containsKeyword("fiz a instalação, quero o STL", "stl")).toBe(true);
  });

  it("palavra vazia ou só espaço nunca casa", () => {
    expect(containsKeyword("qualquer coisa", "")).toBe(false);
    expect(containsKeyword("qualquer coisa", "   ")).toBe(false);
  });
});

describe("matchRule", () => {
  it("casa comentário com a palavra certa", () => {
    const r = matchRule([regra()], { kind: "comment", text: "PREÇO", mediaId: "m1" });
    expect(r?.id).toBe("r1");
  });

  it("ignora regra desativada", () => {
    expect(matchRule([regra({ isActive: false })], { kind: "comment", text: "preço", mediaId: null })).toBeNull();
  });

  it("regra presa a um post não responde em outro", () => {
    const presa = regra({ mediaId: "post-A" });
    expect(matchRule([presa], { kind: "comment", text: "preço", mediaId: "post-B" })).toBeNull();
    expect(matchRule([presa], { kind: "comment", text: "preço", mediaId: "post-A" })?.id).toBe("r1");
  });

  it("regra de comentário não dispara em DM, e vice-versa", () => {
    expect(matchRule([regra({ triggerType: "comment" })], { kind: "message", text: "preço", mediaId: null })).toBeNull();
    expect(matchRule([regra({ triggerType: "dm_keyword" })], { kind: "comment", text: "preço", mediaId: null })).toBeNull();
  });

  it("boas-vindas só na PRIMEIRA mensagem", () => {
    const boasVindas = regra({ id: "bv", triggerType: "dm_welcome", keywords: [] });
    expect(matchRule([boasVindas], { kind: "message", text: "oi", mediaId: null, isFirstMessage: true })?.id).toBe("bv");
    expect(matchRule([boasVindas], { kind: "message", text: "oi", mediaId: null, isFirstMessage: false })).toBeNull();
  });

  it("UMA SÓ responde — a de menor prioridade", () => {
    // Duas disparando mandariam duas DMs para o mesmo comentário, e o cliente
    // veria o robô falhando.
    const a = regra({ id: "a", priority: 50 });
    const b = regra({ id: "b", priority: 10 });
    const c = regra({ id: "c", priority: 200 });
    expect(matchRule([a, b, c], { kind: "comment", text: "preço", mediaId: null })?.id).toBe("b");
  });

  it("empate de prioridade é resolvido de forma estável", () => {
    const x = regra({ id: "zzz", priority: 10 });
    const y = regra({ id: "aaa", priority: 10 });
    expect(matchRule([x, y], { kind: "comment", text: "preço", mediaId: null })?.id).toBe("aaa");
    expect(matchRule([y, x], { kind: "comment", text: "preço", mediaId: null })?.id).toBe("aaa");
  });

  it("regra sem palavra-chave vale para qualquer texto daquele tipo", () => {
    const qualquer = regra({ id: "q", keywords: [] });
    expect(matchRule([qualquer], { kind: "comment", text: "que legal!", mediaId: null })?.id).toBe("q");
  });

  it("comentário sem texto não casa regra com palavra-chave", () => {
    expect(matchRule([regra()], { kind: "comment", text: null, mediaId: null })).toBeNull();
  });

  it("lista vazia devolve null em vez de quebrar", () => {
    expect(matchRule([], { kind: "comment", text: "preço", mediaId: null })).toBeNull();
  });
});

describe("renderTemplate", () => {
  it("substitui o que conhece", () => {
    expect(renderTemplate("Olá {nome}, o {produto} custa {preco}!", {
      nome: "Ana", produto: "Luminária", preco: "R$ 44,90",
    })).toBe("Olá Ana, o Luminária custa R$ 44,90!");
  });

  it("variável DESCONHECIDA fica como está, não vira vazio", () => {
    // "Olá , seu pedido de " parece descaso; "{nome}" denuncia o erro de
    // configuração para quem montou o template.
    expect(renderTemplate("Olá {nome}!", {})).toBe("Olá {nome}!");
    expect(renderTemplate("Olá {nome}!", { nome: null })).toBe("Olá {nome}!");
    expect(renderTemplate("Olá {nome}!", { nome: "" })).toBe("Olá {nome}!");
  });

  it("texto sem variável passa intacto", () => {
    expect(renderTemplate("Te mandei no direct 😉", {})).toBe("Te mandei no direct 😉");
  });
});

describe("normalizeText", () => {
  it("tira acento e caixa, preservando o resto", () => {
    expect(normalizeText("PREÇO Ação Único")).toBe("preco acao unico");
  });
});
