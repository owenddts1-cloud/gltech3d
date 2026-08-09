import { describe, it, expect } from "vitest";

import {
  mediaPath,
  linksSchema,
  extraCostItemSchema,
  productFullPatchSchema,
  productCreateSchema,
} from "./products-catalog";

describe("mediaPath", () => {
  it("aceita caminho relativo de /public", () => {
    /**
     * REGRESSÃO P0: este campo já foi `z.string().url()`, que exige URL
     * absoluta. Os 10 produtos semeados guardam caminhos relativos, e o
     * formulário reenvia `images` a cada gravação — então `updateProduct`
     * reprovava e devolvia "Dados inválidos" para TODA peça com foto. Ninguém
     * conseguia nem digitar as gramas.
     */
    expect(mediaPath.safeParse("/images/Porta Celular/Astronauta/Astronauta1.png").success).toBe(true);
    expect(mediaPath.safeParse("/images/placeholder-model.svg").success).toBe(true);
  });

  it("aceita URL absoluta do Storage", () => {
    expect(mediaPath.safeParse("https://abc.supabase.co/storage/v1/object/public/x.png").success).toBe(true);
    expect(mediaPath.safeParse("http://localhost:54321/storage/x.png").success).toBe(true);
  });

  it("recusa protocol-relative disfarçado de caminho local", () => {
    // "//evil.com/x.png" começa com "/" mas carrega de outro host.
    expect(mediaPath.safeParse("//evil.com/x.png").success).toBe(false);
  });

  it("recusa esquema perigoso e caminho vazio", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<script>", "../../etc/passwd", "", "   "]) {
      expect(mediaPath.safeParse(bad).success, `deveria recusar ${JSON.stringify(bad)}`).toBe(false);
    }
  });

  it("recusa caminho absurdamente longo", () => {
    expect(mediaPath.safeParse(`/images/${"a".repeat(1200)}.png`).success).toBe(false);
  });
});

describe("linksSchema", () => {
  it("aceita string vazia — é 'herda o link da loja'", () => {
    expect(linksSchema.safeParse({ shopee: "" }).success).toBe(true);
  });

  it("aceita objeto parcial", () => {
    expect(linksSchema.safeParse({}).success).toBe(true);
    expect(linksSchema.safeParse({ instagram: "https://instagram.com/gltech3d" }).success).toBe(true);
  });

  it("recusa URL malformada", () => {
    expect(linksSchema.safeParse({ shopee: "shopee.com.br" }).success).toBe(false);
  });
});

describe("extraCostItemSchema", () => {
  it("aceita rótulo vazio sem obrigar a inventar um nome", () => {
    expect(extraCostItemSchema.safeParse({ label: "", costCents: 250 }).success).toBe(true);
  });

  it("recusa valor negativo ou fracionário de centavo", () => {
    expect(extraCostItemSchema.safeParse({ label: "x", costCents: -1 }).success).toBe(false);
    expect(extraCostItemSchema.safeParse({ label: "x", costCents: 2.5 }).success).toBe(false);
  });
});

describe("productFullPatchSchema", () => {
  it("recusa patch vazio", () => {
    // Patch vazio significaria UPDATE sem coluna nenhuma — sintoma de bug no caller.
    expect(productFullPatchSchema.safeParse({}).success).toBe(false);
  });

  it("aceita patch de um campo só (o autosave manda só o que sujou)", () => {
    expect(productFullPatchSchema.safeParse({ filamentGrams: 45 }).success).toBe(true);
  });

  it("valida o slug como endereço de URL", () => {
    expect(productFullPatchSchema.safeParse({ slug: "lua-cheia" }).success).toBe(true);
    for (const bad of ["Lua Cheia", "lua_cheia", "lua/cheia", "", "Lua-Cheia"]) {
      expect(productFullPatchSchema.safeParse({ slug: bad }).success, `slug ${JSON.stringify(bad)}`).toBe(false);
    }
  });

  it("limita buyerProfile em 2000, igual à constraint da 0069", () => {
    // Se o Zod aceitasse mais que o CHECK do banco, o erro sairia como falha
    // crua do Postgres em vez de mensagem de formulário.
    expect(productFullPatchSchema.safeParse({ buyerProfile: "a".repeat(2000) }).success).toBe(true);
    expect(productFullPatchSchema.safeParse({ buyerProfile: "a".repeat(2001) }).success).toBe(false);
  });

  it("aceita null onde a coluna é anulável", () => {
    for (const patch of [
      { buyerProfile: null }, { observations: null }, { heroCopy: null },
      { priceRange: null }, { salePriceCents: null }, { filamentClientId: null },
      { categoryId: null },
    ]) {
      expect(productFullPatchSchema.safeParse(patch).success, JSON.stringify(patch)).toBe(true);
    }
  });

  it("recusa número negativo onde o banco tem CHECK de não-negativo", () => {
    for (const patch of [
      { filamentGrams: -1 }, { printTimeMinutes: -1 }, { stockQty: -1 },
      { soldQty: -1 }, { marginPct: -1 }, { salePriceCents: -1 },
    ]) {
      expect(productFullPatchSchema.safeParse(patch).success, JSON.stringify(patch)).toBe(false);
    }
  });

  it("não deixa bestsellerRank entrar pelo patch genérico", () => {
    // O índice único parcial da 0041 exige liberar o degrau antes de ocupá-lo;
    // só `setBestsellerRank` faz isso. Pelo patch genérico voltaria como 23505.
    const parsed = productFullPatchSchema.safeParse({ name: "x", bestsellerRank: 1 });
    expect(parsed.success).toBe(true);
    expect(parsed.success && "bestsellerRank" in parsed.data).toBe(false);
  });

  it("limita o tamanho das listas", () => {
    expect(productFullPatchSchema.safeParse({ images: Array(21).fill("/a.png") }).success).toBe(false);
    expect(productFullPatchSchema.safeParse({ videos: Array(11).fill("/a.mp4") }).success).toBe(false);
    expect(
      productFullPatchSchema.safeParse({
        extraCosts: Array(21).fill({ label: "x", costCents: 1 }),
      }).success,
    ).toBe(false);
  });
});

describe("productCreateSchema", () => {
  it("exige nome", () => {
    expect(productCreateSchema.safeParse({}).success).toBe(false);
    expect(productCreateSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("aplica os defaults que o INSERT precisa (colunas NOT NULL)", () => {
    const parsed = productCreateSchema.parse({ name: "Luminária" });
    expect(parsed).toMatchObject({
      category: "",
      description: "",
      filamentGrams: 0,
      printTimeMinutes: 0,
      extraCost: 0,
      marginPct: 100,
    });
  });

  it("aceita a peça completa que o formulário manda", () => {
    const parsed = productCreateSchema.safeParse({
      name: "Luminária Lua",
      slug: "luminaria-lua",
      category: "Luminárias",
      description: "Peça decorativa",
      images: ["/images/Luminarias/Lua Cheia/luminarialuacheia1.png"],
      videos: [],
      colors: ["Branco"],
      links: { shopee: "https://shopee.com.br/gltech3d", instagram: "" },
      salePriceCents: 4490,
      isPublished: true,
      extraCosts: [{ label: "Embalagem", costCents: 250 }],
      buyerProfile: "presente de aniversário",
      variations: [{ name: "Cor", options: ["Branco", "Preto"] }],
    });
    expect(parsed.success, parsed.success ? "" : parsed.error.issues[0]?.message).toBe(true);
  });
});
