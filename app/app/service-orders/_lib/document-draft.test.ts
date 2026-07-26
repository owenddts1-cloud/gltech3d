import { describe, it, expect } from "vitest";

import { emptyDocumentBranding } from "@/lib/schemas/settings";
import {
  buildDraftSnapshot,
  itemFromProduct,
  lineTotalCents,
  recomputeTotals,
  seedItemFromOrder,
  snapshotDiffersFromOrderTotal,
  validUntil,
  withDerivedFields,
  type DocumentContext,
  type DraftOrder,
  type DraftProduct,
} from "./document-draft";

const ORDER: DraftOrder = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "OS-300",
  title: "Troféu personalizado",
  contactId: null,
  contactName: "Paróquia Santa Rosa",
  status: "aprovado",
  material: "PLA",
  qty: 4,
  totalCents: 8800,
  slaDueAt: null,
  createdAt: "2026-07-20T12:00:00.000Z",
  notes: "Arte enviada pelo cliente",
};

function makeContext(overrides: Partial<DocumentContext> = {}): DocumentContext {
  return {
    order: ORDER,
    items: [],
    contact: null,
    products: [],
    org: {
      displayName: "GL TECH 3D",
      legalName: "GL Tech 3D LTDA",
      cnpj: "00.000.000/0001-00",
      branding: emptyDocumentBranding(),
    },
    issuedBy: { userId: null, name: "Guilherme" },
    nowIso: "2026-07-26T12:00:00.000Z",
    ...overrides,
  };
}

describe("lineTotalCents", () => {
  it("arredonda por linha, não no total", () => {
    // 1,5 × R$ 3,33 = R$ 4,995 → a linha impressa mostra 5,00 e o total precisa bater.
    expect(lineTotalCents({ qty: 1.5, unitPriceCents: 333 })).toBe(500);
  });
});

describe("recomputeTotals", () => {
  it("soma qty × unitário de cada item", () => {
    const totals = recomputeTotals([
      { qty: 60, unitPriceCents: 2200 },
      { qty: 30, unitPriceCents: 1900 },
    ]);
    expect(totals.subtotalCents).toBe(132000 + 57000);
    expect(totals.totalCents).toBe(189000);
  });

  it("aplica desconto e frete", () => {
    const totals = recomputeTotals([{ qty: 2, unitPriceCents: 5000 }], {
      discountCents: 1000,
      shippingCents: 2500,
    });
    expect(totals.subtotalCents).toBe(10000);
    expect(totals.shippingCents).toBe(2500);
    expect(totals.discountCents).toBe(1000);
    expect(totals.totalCents).toBe(11500);
  });

  it("nunca deixa o total ficar negativo", () => {
    // O CHECK total_cents >= 0 da tabela rejeitaria a emissão; a trava é aqui.
    const totals = recomputeTotals([{ qty: 1, unitPriceCents: 1000 }], { discountCents: 99999 });
    expect(totals.discountCents).toBe(1000);
    expect(totals.totalCents).toBe(0);
  });

  it("trata lista vazia", () => {
    expect(recomputeTotals([]).totalCents).toBe(0);
  });
});

describe("snapshotDiffersFromOrderTotal", () => {
  const items = [{ qty: 2, unitPriceCents: 5000 }];

  it("acusa quando o header da O.S. divergiu da soma dos itens", () => {
    expect(snapshotDiffersFromOrderTotal(items, 9999)).toBe(true);
  });

  it("fica quieto quando bate", () => {
    expect(snapshotDiffersFromOrderTotal(items, 10000)).toBe(false);
  });

  it("não acusa nada quando não há itens", () => {
    expect(snapshotDiffersFromOrderTotal([], 5000)).toBe(false);
  });
});

describe("itemFromProduct", () => {
  const base: DraftProduct = {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Rosa dourada",
    description: "Com base",
    imageUrl: "https://cdn/rosa.png",
    salePriceCents: 1900,
    material: "PLA",
  };

  it("traz nome, descrição, preço e foto do catálogo", () => {
    const item = itemFromProduct(base);
    expect(item).toMatchObject({
      productId: base.id,
      name: "Rosa dourada",
      description: "Com base",
      qty: 1,
      unitPriceCents: 1900,
      imageUrl: "https://cdn/rosa.png",
    });
  });

  it("aceita produto sem preço e sem foto", () => {
    const item = itemFromProduct({ ...base, salePriceCents: null, imageUrl: null });
    expect(item.unitPriceCents).toBe(0);
    expect(item.imageUrl).toBeNull();
  });
});

describe("seedItemFromOrder", () => {
  it("deriva o unitário do total da O.S. legada", () => {
    const item = seedItemFromOrder(ORDER);
    expect(item.name).toBe("Troféu personalizado");
    expect(item.qty).toBe(4);
    expect(item.unitPriceCents).toBe(2200);
  });

  it("não divide por zero quando a O.S. tem qty inválida", () => {
    const item = seedItemFromOrder({ ...ORDER, qty: 0, totalCents: 5000 });
    expect(item.qty).toBe(1);
    expect(item.unitPriceCents).toBe(5000);
  });
});

describe("buildDraftSnapshot", () => {
  it("semeia um item a partir do cabeçalho quando a O.S. não tem itens", () => {
    const snap = buildDraftSnapshot(makeContext(), "orcamento");
    expect(snap.items).toHaveLength(1);
    expect(snap.items[0]!.name).toBe("Troféu personalizado");
    expect(snap.totals.totalCents).toBe(8800);
  });

  it("usa os itens reais e ignora o total do cabeçalho quando eles existem", () => {
    const snap = buildDraftSnapshot(
      makeContext({
        items: [
          { id: "a", productId: null, name: "Peça A", description: "", qty: 2, unitPriceCents: 5000, imageUrl: null },
          { id: "b", productId: null, name: "Peça B", description: "", qty: 1, unitPriceCents: 3000, imageUrl: null },
        ],
      }),
      "orcamento",
    );
    expect(snap.items).toHaveLength(2);
    expect(snap.totals.totalCents).toBe(13000);
  });

  it("cai para o nome do contato da O.S. quando não há contato cadastrado", () => {
    const snap = buildDraftSnapshot(makeContext(), "orcamento");
    expect(snap.customer.name).toBe("Paróquia Santa Rosa");
    expect(snap.customer.contactId).toBeNull();
  });

  it("esconde foto no recibo e mostra nos demais", () => {
    expect(buildDraftSnapshot(makeContext(), "recibo").options.showItemPhotos).toBe(false);
    expect(buildDraftSnapshot(makeContext(), "orcamento").options.showItemPhotos).toBe(true);
  });

  it("preenche o valor por extenso do recibo", () => {
    const snap = buildDraftSnapshot(makeContext(), "recibo");
    expect(snap.payment.amountInWords).toBe("oitenta e oito reais");
    expect(snap.payment.paidAt).toBe("2026-07-26");
  });
});

describe("withDerivedFields", () => {
  it("recalcula total e extenso após editar um item", () => {
    const snap = buildDraftSnapshot(makeContext(), "recibo");
    const edited = withDerivedFields({
      ...snap,
      items: [{ ...snap.items[0]!, qty: 1, unitPriceCents: 10000 }],
    });
    expect(edited.totals.totalCents).toBe(10000);
    expect(edited.payment.amountInWords).toBe("cem reais");
  });
});

describe("validUntil", () => {
  it("soma a validade à data de emissão", () => {
    const snap = buildDraftSnapshot(makeContext(), "orcamento");
    // emptyDocumentBranding() traz o default de 15 dias.
    expect(validUntil({ ...snap, terms: { ...snap.terms, validityDays: 15 } })).toBe("2026-08-10");
  });

  it("devolve vazio quando a validade é zero", () => {
    const snap = buildDraftSnapshot(makeContext(), "orcamento");
    expect(validUntil({ ...snap, terms: { ...snap.terms, validityDays: 0 } })).toBe("");
  });
});
