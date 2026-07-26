import { describe, it, expect } from "vitest";

import { isPublicPath } from "@/lib/auth/public-paths";
import {
  docItemSchema,
  documentSnapshotSchema,
  parseDocType,
} from "./service-order-documents";

/** Snapshot mínimo válido, para variar um campo por vez. */
function minimalSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    docType: "orcamento",
    issuedAt: "2026-07-26T12:00:00.000Z",
    org: {},
    customer: {},
    serviceOrder: { id: "11111111-1111-4111-8111-111111111111" },
    items: [{ name: "Peça", qty: 1, unitPriceCents: 1000 }],
    totals: { subtotalCents: 1000, totalCents: 1000 },
    payment: {},
    terms: {},
    signature: {},
    options: {},
    meta: {},
    ...overrides,
  };
}

describe("documentSnapshotSchema", () => {
  it("aceita o snapshot mínimo e aplica os defaults", () => {
    const parsed = documentSnapshotSchema.parse(minimalSnapshot());
    expect(parsed.options.showItemPhotos).toBe(true);
    expect(parsed.payment.method).toBe("pix");
    expect(parsed.terms.validityDays).toBe(15);
    expect(parsed.customer.contactId).toBeNull();
  });

  it("rejeita versão de snapshot desconhecida", () => {
    // Se um dia o formato mudar, um documento antigo não pode ser renderizado
    // meio-torto: tem que falhar alto.
    expect(documentSnapshotSchema.safeParse(minimalSnapshot({ version: 2 })).success).toBe(false);
  });

  it("rejeita docType fora do contrato", () => {
    expect(documentSnapshotSchema.safeParse(minimalSnapshot({ docType: "nota_fiscal" })).success).toBe(
      false,
    );
  });

  it("exige ao menos um item", () => {
    expect(documentSnapshotSchema.safeParse(minimalSnapshot({ items: [] })).success).toBe(false);
  });
});

describe("docItemSchema", () => {
  it("rejeita quantidade zero ou negativa", () => {
    expect(docItemSchema.safeParse({ name: "x", qty: 0, unitPriceCents: 100 }).success).toBe(false);
    expect(docItemSchema.safeParse({ name: "x", qty: -1, unitPriceCents: 100 }).success).toBe(false);
  });

  it("rejeita preço negativo", () => {
    expect(docItemSchema.safeParse({ name: "x", qty: 1, unitPriceCents: -1 }).success).toBe(false);
  });

  it("rejeita item sem descrição", () => {
    expect(docItemSchema.safeParse({ name: "  ", qty: 1, unitPriceCents: 100 }).success).toBe(false);
  });
});

describe("parseDocType", () => {
  it("traduz o atalho 'os' da querystring", () => {
    expect(parseDocType("os")).toBe("ordem_servico");
  });

  it("aceita os valores canônicos", () => {
    expect(parseDocType("recibo")).toBe("recibo");
    expect(parseDocType("ordem_servico")).toBe("ordem_servico");
  });

  it("cai para orçamento em entrada ausente ou inválida", () => {
    expect(parseDocType(undefined)).toBe("orcamento");
    expect(parseDocType("nota")).toBe("orcamento");
  });
});

describe("rota de impressão", () => {
  it("NÃO é pública — a folha contém PII do cliente", () => {
    expect(isPublicPath("/documentos/9f3e1b2c-0000-4000-8000-000000000000")).toBe(false);
    expect(isPublicPath("/documentos")).toBe(false);
  });
});
