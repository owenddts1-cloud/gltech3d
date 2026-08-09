import { describe, it, expect } from "vitest";

import {
  toProductRowPatch,
  salePriceCentsAfter,
  sumExtraCostCents,
  extraCostsFromRow,
} from "./patch";

/**
 * O mapper é o ponto onde a unificação pode dar errado em silêncio: um campo
 * traduzido a menos não quebra typecheck nem lint, só perde o dado que o usuário
 * digitou. Cada asserção aqui trava uma falha concreta.
 */

describe("toProductRowPatch — invariante do patch parcial", () => {
  it("chave ausente na entrada NUNCA aparece na saída", () => {
    // O autosave manda só o que sujou. Se o mapper emitisse as demais chaves
    // (como `undefined` ou `null`), gravar o nome apagaria o resto da peça.
    const patch = toProductRowPatch({ name: "Luminária" });
    expect(Object.keys(patch).sort()).toEqual(["name", "updated_at"]);
  });

  it("sempre carimba updated_at", () => {
    expect(toProductRowPatch({ isTop: true }).updated_at).toEqual(expect.any(String));
  });

  it("distingue 'não tocar' de 'limpar'", () => {
    // Sem a chave: a coluna nem entra no UPDATE.
    expect("sale_price_cents" in toProductRowPatch({ name: "x" })).toBe(false);
    // Com null explícito: a coluna é zerada de propósito.
    expect(toProductRowPatch({ salePriceCents: null }).sale_price_cents).toBeNull();
    // Zero é um valor, não uma ausência — não pode sumir.
    expect(toProductRowPatch({ salePriceCents: 0 }).sale_price_cents).toBe(0);
  });
});

describe("toProductRowPatch — conversões de unidade", () => {
  it("minutos viram segundos", () => {
    expect(toProductRowPatch({ printTimeMinutes: 90 }).print_time_seconds).toBe(5400);
  });

  it("arredonda minuto fracionário para segundo inteiro", () => {
    // print_time_seconds é integer no banco; 2,5 min = 150 s exatos.
    expect(toProductRowPatch({ printTimeMinutes: 2.5 }).print_time_seconds).toBe(150);
    expect(toProductRowPatch({ printTimeMinutes: 1.011 }).print_time_seconds).toBe(61);
  });

  it("reais viram centavos quando só vem salePrice", () => {
    expect(toProductRowPatch({ salePrice: 49.9 }).sale_price_cents).toBe(4990);
    expect(toProductRowPatch({ salePrice: null }).sale_price_cents).toBeNull();
  });

  it("centavos vencem reais quando os dois vêm", () => {
    const patch = toProductRowPatch({ salePriceCents: 1234, salePrice: 99.9 });
    expect(patch.sale_price_cents).toBe(1234);
  });
});

describe("toProductRowPatch — insumos (BOM multi-linha)", () => {
  it("preserva as linhas em vez de colapsar em uma", () => {
    // A regressão real: `extrasFromReais()` transformava o BOM inteiro num único
    // item rotulado "Insumos", perdendo a discriminação que o usuário digitou.
    const patch = toProductRowPatch({
      extraCosts: [
        { label: "Embalagem", costCents: 250 },
        { label: "Ímã", costCents: 80 },
      ],
    });
    expect(patch.extra_costs).toEqual([
      { label: "Embalagem", cost_cents: 250 },
      { label: "Ímã", cost_cents: 80 },
    ]);
  });

  it("lista vazia limpa os insumos", () => {
    expect(toProductRowPatch({ extraCosts: [] }).extra_costs).toEqual([]);
  });

  it("mantém o formato legado byte a byte", () => {
    // Enquanto um caller antigo mandar `extraCost`, o resultado tem que ser
    // idêntico ao que `extrasFromReais()` produzia — senão a migração dos
    // callers vira uma mudança de dados disfarçada.
    expect(toProductRowPatch({ extraCost: 2.5 }).extra_costs).toEqual([
      { label: "Insumos", cost_cents: 250 },
    ]);
    expect(toProductRowPatch({ extraCost: 0 }).extra_costs).toEqual([]);
  });

  it("extraCosts vence extraCost", () => {
    const patch = toProductRowPatch({
      extraCosts: [{ label: "Caixa", costCents: 100 }],
      extraCost: 9,
    });
    expect(patch.extra_costs).toEqual([{ label: "Caixa", cost_cents: 100 }]);
  });

  it("aceita rótulo vazio sem inventar um nome", () => {
    expect(toProductRowPatch({ extraCosts: [{ label: "", costCents: 500 }] }).extra_costs).toEqual([
      { label: "", cost_cents: 500 },
    ]);
  });
});

describe("toProductRowPatch — texto vazio vira null", () => {
  it.each([
    ["category", "category"],
    ["description", "description"],
    ["heroCopy", "hero_copy"],
    ["priceRange", "price_range"],
    ["material", "material"],
    ["dimensions", "dimensions"],
    ["observations", "observations"],
    ["buyerProfile", "buyer_profile"],
  ])("%s vazio → %s null", (wire, column) => {
    const patch = toProductRowPatch({ [wire]: "" });
    expect(patch[column]).toBeNull();
  });

  it("mas preserva o texto quando há conteúdo", () => {
    expect(toProductRowPatch({ buyerProfile: "mães de aluno" }).buyer_profile).toBe("mães de aluno");
  });
});

describe("toProductRowPatch — nomes de coluna", () => {
  it("traduz todo campo camelCase para o snake_case da tabela", () => {
    // Um campo esquecido aqui é dado que o usuário digita e o banco nunca recebe.
    const patch = toProductRowPatch({
      slug: "lua-cheia",
      categoryId: "11111111-1111-4111-8111-111111111111",
      isTop: true,
      isPublished: true,
      stockQty: 3,
      soldQty: 7,
      sortOrder: 2.5,
      filamentClientId: "fil-1",
      filamentGrams: 45,
      printerClientId: "prn-1",
      marginPct: 120,
      colors: ["Preto"],
      videos: ["/videos/x.mp4"],
      links: { shopee: "https://shopee.com.br/gltech3d" },
    });
    expect(patch).toMatchObject({
      slug: "lua-cheia",
      category_id: "11111111-1111-4111-8111-111111111111",
      is_top: true,
      is_published: true,
      stock_qty: 3,
      sold_qty: 7,
      sort_order: 2.5,
      filament_client_id: "fil-1",
      filament_grams: 45,
      printer_client_id: "prn-1",
      margin_pct: 120,
      colors: ["Preto"],
      videos: ["/videos/x.mp4"],
      links: { shopee: "https://shopee.com.br/gltech3d" },
    });
  });

  it("nenhuma chave da saída sobrou em camelCase", () => {
    const patch = toProductRowPatch({
      printTimeMinutes: 10,
      salePrice: 1,
      extraCost: 1,
      heroCopy: "x",
      buyerProfile: "y",
      categoryId: null,
      filamentClientId: null,
    });
    const camel = Object.keys(patch).filter((k) => /[A-Z]/.test(k));
    expect(camel, `chaves não traduzidas: ${camel.join(", ")}`).toEqual([]);
  });
});

describe("salePriceCentsAfter", () => {
  it("devolve undefined quando o patch não toca no preço", () => {
    // undefined significa "consulte o valor atual da linha", e é diferente de
    // null ("o preço está sendo apagado"). Confundir os dois deixaria publicar
    // peça sem preço.
    expect(salePriceCentsAfter({ name: "x" })).toBeUndefined();
  });

  it("resolve os dois formatos", () => {
    expect(salePriceCentsAfter({ salePriceCents: 4990 })).toBe(4990);
    expect(salePriceCentsAfter({ salePrice: 49.9 })).toBe(4990);
    expect(salePriceCentsAfter({ salePrice: null })).toBeNull();
  });
});

describe("leitura do jsonb", () => {
  it("sumExtraCostCents soma a lista e ignora lixo", () => {
    expect(sumExtraCostCents([{ label: "a", cost_cents: 250 }, { label: "b", cost_cents: 80 }])).toBe(330);
    expect(sumExtraCostCents([{ cost_cents: "abc" }, null, 42])).toBe(0);
    expect(sumExtraCostCents(null)).toBe(0);
    expect(sumExtraCostCents("[]")).toBe(0);
  });

  it("extraCostsFromRow devolve o formato do editor", () => {
    expect(extraCostsFromRow([{ label: "Embalagem", cost_cents: 250 }])).toEqual([
      { label: "Embalagem", costCents: 250 },
    ]);
    // Linha semeada sem rótulo não pode virar `undefined` no input controlado.
    expect(extraCostsFromRow([{ cost_cents: 100 }])).toEqual([{ label: "", costCents: 100 }]);
    expect(extraCostsFromRow(undefined)).toEqual([]);
  });

  it("ida e volta preserva os valores", () => {
    const original = [{ label: "Embalagem", costCents: 250 }, { label: "", costCents: 80 }];
    const row = toProductRowPatch({ extraCosts: original }).extra_costs;
    expect(extraCostsFromRow(row)).toEqual(original);
    expect(sumExtraCostCents(row)).toBe(330);
  });
});
