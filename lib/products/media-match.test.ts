import { describe, it, expect } from "vitest";

import { matchProductByFolder, nearestSlugs, effectiveSlug } from "./media-match";

/**
 * Os nomes abaixo são os REAIS: as 10 pastas em `public/images` e as 18 peças do
 * catálogo. Testar com dado inventado aqui não provaria nada — o ponto todo é
 * que o casamento funcione na árvore que já existe.
 *
 * Antes desta lógica, `--from-public` resolvia 5 de 10 e marcava as outras 5 com
 * `???`, porque exigia igualdade exata entre o nome da pasta (o apelido) e o
 * slug (o nome completo).
 */

const PRODUCTS = [
  "Luminária Lua Cheia - Alta Qualidade",
  "Vaso Geométrico Moderno",
  "Batman - Action Figure",
  "Kit Vasos Modernos Com Bandeja",
  "Charizard Articulável",
  "Páscoa 3D Personalizados Coelhos e Ovos Decorativos",
  "Chibi Naruto",
  "Porta-Celular Astronauta",
  "Banguela Fúria da Noite - Chaveiro",
  "Base Carregadora Relógio Apple Watch",
  "Tralalero Tralalá - Tubarão Articulado",
  "Tung Tung Tung Sahur - Boneco Articulado",
  "Porta Canetas Monster",
  "Suporte de Celular Banguela",
  "Meccha Chameleon - Kit de Poses",
  "Letra Decorada Personalizada",
  "Porta Cartões - Consultório Odontológico",
  "Carimbo e Cortador de Biscoito Toy Story",
].map((name, i) => ({ id: String(i + 1), slug: null, name }));

/** As 10 pastas reais de `public/images/<Categoria>/<Peça>`. */
const REAL_FOLDERS: Array<[folder: string, expectedSlug: string]> = [
  ["Batman", "batman-action-figure"],
  ["Charizard Articulavel", "charizard-articulavel"],
  ["Base Carregadora Relogio Apple Watch", "base-carregadora-relogio-apple-watch"],
  ["Banguela Furia da Noite Chaveiro", "banguela-furia-da-noite-chaveiro"],
  ["Naruto", "chibi-naruto"],
  ["Lua Cheia", "luminaria-lua-cheia-alta-qualidade"],
  ["Astronauta", "porta-celular-astronauta"],
  ["Pascoa", "pascoa-3d-personalizados-coelhos-e-ovos-decorativos"],
  ["Kit Vasos Modernos Com Bandeja", "kit-vasos-modernos-com-bandeja"],
  ["Vaso Geometrico Moderno", "vaso-geometrico-moderno"],
];

describe("matchProductByFolder — as 10 pastas reais", () => {
  it.each(REAL_FOLDERS)("resolve %s", (folder, expected) => {
    const match = matchProductByFolder(folder, PRODUCTS);
    expect(match.kind === "exact" || match.kind === "contained", `resultou ${match.kind}`).toBe(true);
    if (match.kind === "exact" || match.kind === "contained") {
      expect(effectiveSlug(match.product)).toBe(expected);
    }
  });

  it("nenhuma das 10 fica sem casar", () => {
    const unresolved = REAL_FOLDERS.filter(([folder]) => {
      const m = matchProductByFolder(folder, PRODUCTS);
      return m.kind !== "exact" && m.kind !== "contained";
    }).map(([folder]) => folder);
    expect(unresolved, `pastas sem casar: ${unresolved.join(", ")}`).toEqual([]);
  });
});

describe("matchProductByFolder — não adivinha", () => {
  it("casa por token inteiro, não por substring solta", () => {
    // "ana" dentro de "banana" seria um falso positivo clássico.
    const produtos = [{ id: "1", slug: "banana-split", name: "Banana Split" }];
    expect(matchProductByFolder("ana", produtos).kind).toBe("none");
  });

  it("dois candidatos viram ambíguo, não um chute", () => {
    const produtos = [
      { id: "1", slug: "vaso-pequeno", name: "Vaso Pequeno" },
      { id: "2", slug: "vaso-grande", name: "Vaso Grande" },
    ];
    const match = matchProductByFolder("Vaso", produtos);
    expect(match.kind).toBe("ambiguous");
    if (match.kind === "ambiguous") expect(match.candidates).toHaveLength(2);
  });

  it("pasta sem relação nenhuma resulta em none", () => {
    expect(matchProductByFolder("Fotos do Natal 2019", PRODUCTS).kind).toBe("none");
  });

  it("pasta vazia ou só símbolos resulta em none", () => {
    expect(matchProductByFolder("", PRODUCTS).kind).toBe("none");
    expect(matchProductByFolder("___", PRODUCTS).kind).toBe("none");
  });

  it("igualdade exata vence e é reportada como exact", () => {
    const produtos = [{ id: "1", slug: "chibi-naruto", name: "Chibi Naruto" }];
    expect(matchProductByFolder("chibi-naruto", produtos).kind).toBe("exact");
  });

  it("acento e caixa não atrapalham", () => {
    expect(matchProductByFolder("PÁSCOA", PRODUCTS).kind).not.toBe("none");
    expect(matchProductByFolder("charizard articulável", PRODUCTS).kind).not.toBe("none");
  });
});

describe("nearestSlugs", () => {
  it("sugere os mais próximos para pasta órfã", () => {
    const near = nearestSlugs("Batmam", PRODUCTS, 3);
    expect(near).toHaveLength(3);
    expect(near[0]).toContain("batman");
  });

  it("é determinístico (desempate por nome)", () => {
    expect(nearestSlugs("xyz", PRODUCTS, 3)).toEqual(nearestSlugs("xyz", PRODUCTS, 3));
  });
});
