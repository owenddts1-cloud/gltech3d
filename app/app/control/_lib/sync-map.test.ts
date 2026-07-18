import { describe, it, expect } from "vitest";
import { planControlSync, type SyncSourceRow } from "./sync-map";

const row = (over: Partial<SyncSourceRow>): SyncSourceRow => ({
  id: "1", date: "2026-07-01", description: "X", type: "Receita", category: "Venda",
  platform: "", revenue_cents: 0, expense_cents: 0, quantity: 1, ...over,
});

describe("planControlSync", () => {
  it("separa 'Produto - Cliente': produto vira título da O.S., cliente vira contato", () => {
    const p = planControlSync([
      row({ id: "a", description: "Letreiro - Taís Porfírio", category: "Venda", platform: "B2B", revenue_cents: 3900 }),
      row({ id: "b", description: "Maxilar 3D - Wellington Denise", category: "Venda", platform: "B2B", revenue_cents: 7000 }),
    ]);
    expect(p.sales[0]).toMatchObject({
      key: "ctrl:a", productName: "Letreiro", customerName: "Taís Porfírio", platform: "B2B", totalCents: 3900, osTitle: "Letreiro",
    });
    // produto com hífen: usa o ÚLTIMO " - " para separar o cliente.
    expect(p.sales[1]).toMatchObject({ productName: "Maxilar 3D", customerName: "Wellington Denise" });
    expect(p.contactNames).toEqual(["Taís Porfírio", "Wellington Denise"]);
  });

  it("plataforma desconhecida/vazia vira 'Outro'", () => {
    const p = planControlSync([row({ category: "Venda", platform: "Instagram", revenue_cents: 500 })]);
    expect(p.sales[0]!.platform).toBe("Outro");
  });

  it("ignora venda sem receita e não cria contato sem nome", () => {
    const p = planControlSync([
      row({ id: "z", category: "Venda", revenue_cents: 0 }),                       // sem receita → ignora
      row({ id: "y", description: "", category: "Venda", revenue_cents: 300 }),     // sem nome → venda sim, contato não
    ]);
    expect(p.sales).toHaveLength(1);
    expect(p.sales[0]!.customerName).toBe("Cliente sem nome");
    expect(p.contactNames).toEqual([]);
  });

  it("mapeia ferramentas, insumos e peças para inventário com purpose, deduplicando por nome", () => {
    const p = planControlSync([
      row({ id: "t1", description: "Alicate", category: "Ferramentas", type: "Despesa", expense_cents: 4500, quantity: 2 }),
      row({ id: "t2", description: "alicate", category: "Ferramentas", type: "Despesa", expense_cents: 9999, quantity: 1 }), // dup
      row({ id: "i1", description: "Cola epóxi", category: "Insumo", type: "Despesa", expense_cents: 3000, quantity: 1 }),
      row({ id: "p1", description: "Rolamento 608", category: "Peças", type: "Despesa", expense_cents: 800, quantity: 4 }),
    ]);
    expect(p.inventory).toEqual([
      { name: "Alicate", purchaseValueCents: 4500, quantity: 2, purchaseDate: "2026-07-01", category: "ferramenta", purpose: "Ferramenta" },
      { name: "Cola epóxi", purchaseValueCents: 3000, quantity: 1, purchaseDate: "2026-07-01", category: "outro", purpose: "Insumo" },
      { name: "Rolamento 608", purchaseValueCents: 800, quantity: 4, purchaseDate: "2026-07-01", category: "outro", purpose: "Peça" },
    ]);
  });

  it("mapeia filamentos para a tabela `filaments` (bobina de 1kg, client_id estável)", () => {
    const p = planControlSync([
      row({ id: "f1", description: "PLA Preto", category: "Filamentos", type: "Despesa", expense_cents: 16000, quantity: 2 }),
    ]);
    // 2 bobinas → 2000g ; custo total R$160 ÷ 2000g = 0,08/g
    expect(p.filaments).toEqual([
      { clientId: "ctrl:pla preto", name: "PLA Preto", weightGrams: 2000, costPerGram: 0.08, minWeightAlert: 0 },
    ]);
  });

  it("não cria contato para o dono (Gui), mas cria a venda normalmente", () => {
    const p = planControlSync([
      row({ id: "g1", description: "Peça teste - Gui", category: "Venda", platform: "B2B", revenue_cents: 5000 }),
      row({ id: "c1", description: "Letreiro - Jane Neneco", category: "Venda", platform: "B2B", revenue_cents: 7000 }),
    ]);
    expect(p.sales).toHaveLength(2);
    expect(p.contactNames).toEqual(["Jane Neneco"]); // "Gui" foi excluído
  });

  it("não quebra com entrada vazia", () => {
    const p = planControlSync([]);
    expect(p).toEqual({ sales: [], contactNames: [], inventory: [], filaments: [] });
  });
});
