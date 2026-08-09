import { describe, it, expect } from "vitest";

import { asLinks, mergeProductLinks, inheritedChannels, LINK_CHANNELS } from "./links";

/**
 * A herança de links é o que faz um produto cadastrado no CRM nascer com botão
 * de compra. Sem ela, a peça nova ia para a vitrine sem nenhum canal — foi
 * exatamente a queixa que originou este módulo.
 */

const GLOBAL = {
  shopee: "https://shopee.com.br/gltech3d",
  instagram: "https://www.instagram.com/gltech3d/",
};

describe("asLinks", () => {
  it("descarta string vazia, que é ausência e não valor", () => {
    // Se "" passasse, sobrescreveria o global com nada e a peça ficaria sem canal.
    expect(asLinks({ shopee: "" })).toEqual({});
    expect(asLinks({ shopee: "   " })).toEqual({});
  });

  it("descarta canal desconhecido e valor não-string", () => {
    expect(asLinks({ tiktok: "https://x", shopee: 42 })).toEqual({});
  });

  it("sobrevive a jsonb inesperado", () => {
    for (const junk of [null, undefined, "[]", 7, []]) {
      expect(asLinks(junk)).toEqual({});
    }
  });
});

describe("mergeProductLinks", () => {
  it("peça sem link nenhum herda a loja inteira", () => {
    // Cenário do produto recém-criado no CRM: links = {}.
    expect(mergeProductLinks(GLOBAL, {})).toEqual(GLOBAL);
  });

  it("link próprio da peça vence o global", () => {
    const own = { shopee: "https://shopee.com.br/product/123/456" };
    expect(mergeProductLinks(GLOBAL, own).shopee).toBe(own.shopee);
    // e os demais canais continuam herdados
    expect(mergeProductLinks(GLOBAL, own).instagram).toBe(GLOBAL.instagram);
  });

  it("apagar o campo volta a herdar, não deixa sem canal", () => {
    expect(mergeProductLinks(GLOBAL, { shopee: "" }).shopee).toBe(GLOBAL.shopee);
  });

  it("sem global e sem peça, resulta vazio sem quebrar", () => {
    expect(mergeProductLinks({}, {})).toEqual({});
    expect(mergeProductLinks(null, undefined)).toEqual({});
  });

  it("não inventa canal que ninguém definiu", () => {
    const merged = mergeProductLinks(GLOBAL, {});
    expect(merged.whatsapp).toBeUndefined();
    expect(merged.mercadoLivre).toBeUndefined();
  });
});

describe("inheritedChannels", () => {
  it("lista só o que a peça não define e o global tem", () => {
    expect(inheritedChannels(GLOBAL, { shopee: "https://x.com/y" })).toEqual(["instagram"]);
  });

  it("nada herdado quando a peça define tudo que o global tem", () => {
    expect(inheritedChannels(GLOBAL, GLOBAL)).toEqual([]);
  });

  it("nada herdado quando o global está vazio", () => {
    expect(inheritedChannels({}, {})).toEqual([]);
  });

  it("campo vazio na peça conta como herdado", () => {
    expect(inheritedChannels(GLOBAL, { shopee: "" })).toContain("shopee");
  });
});

describe("LINK_CHANNELS", () => {
  it("cobre os quatro canais que a vitrine renderiza", () => {
    // ProductActions.tsx renderiza exatamente estes quatro; um canal a mais aqui
    // sem o <a> correspondente vira link que ninguém vê.
    expect([...LINK_CHANNELS].sort()).toEqual(
      ["instagram", "mercadoLivre", "shopee", "whatsapp"],
    );
  });
});
