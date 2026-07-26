import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { emptyDocumentBranding } from "@/lib/schemas/settings";
import {
  buildDraftSnapshot,
  type DocumentContext,
} from "@/app/app/service-orders/_lib/document-draft";
import type { DocType, RenderableDocument } from "@/lib/schemas/service-order-documents";

import { DocumentSheet } from "./DocumentSheet";

/**
 * Compilar não é renderizar: a folha é composta por 7 partes que leem o snapshot
 * por caminhos diferentes conforme o tipo do documento. Este teste percorre os três
 * tipos de ponta a ponta para pegar erro de runtime e conteúdo trocado.
 */

const CONTEXT: DocumentContext = {
  order: {
    id: "11111111-1111-4111-8111-111111111111",
    code: "OS-342",
    title: "Troféu patrocinador",
    contactId: "22222222-2222-4222-8222-222222222222",
    contactName: "Paróquia Santa Rosa de Lima",
    status: "em_producao",
    material: "PLA",
    qty: 2,
    totalCents: 0,
    slaDueAt: "2026-09-24T00:00:00.000Z",
    createdAt: "2026-07-20T12:00:00.000Z",
    notes: "Serviço de modelagem e prototipagem para a Festa de Santa Rosa",
  },
  items: [
    {
      id: "i1",
      productId: null,
      name: "Troféu Patrocinador com Base e Arte",
      description: "Dourado metalizado",
      qty: 60,
      unitPriceCents: 2200,
      imageUrl: "https://cdn.exemplo/trofeu.png",
    },
    {
      id: "i2",
      productId: null,
      name: "Rosa Dourada Realista com Base",
      description: "",
      qty: 30,
      unitPriceCents: 1900,
      imageUrl: null,
    },
  ],
  contact: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Paróquia Santa Rosa de Lima",
    email: "jane@paroquia.com",
    phone: "+5531998419393",
    documentNumber: "12345678000199",
    address: "R. Vicente Nunes Resende",
    addressNumber: "35",
    addressComplement: "",
    district: "Centro",
    city: "Sarzedo",
    state: "MG",
    cep: "32450000",
  },
  products: [],
  org: {
    displayName: "GL TECH 3D",
    legalName: "GL Tech 3D LTDA",
    cnpj: "00.000.000/0001-00",
    branding: { ...emptyDocumentBranding(), phone: "31999284834", signer_name: "Guilherme" },
  },
  issuedBy: { userId: null, name: "Guilherme" },
  nowIso: "2026-07-26T12:00:00.000Z",
};

function renderDoc(docType: DocType, overrides: Partial<RenderableDocument> = {}) {
  const doc: RenderableDocument = {
    snapshot: buildDraftSnapshot(CONTEXT, docType),
    number: "ORC-2026-0001",
    voidedAt: null,
    voidReason: null,
    ...overrides,
  };
  return render(<DocumentSheet document={doc} />);
}

describe("DocumentSheet", () => {
  it.each(["orcamento", "ordem_servico", "recibo"] as const)(
    "renderiza o documento do tipo %s com cabeçalho, itens e total",
    (docType) => {
      const { container } = renderDoc(docType);

      expect(screen.getAllByText("GL TECH 3D").length).toBeGreaterThan(0);
      expect(screen.getByText("ORC-2026-0001")).toBeInTheDocument();
      expect(screen.getAllByText("Paróquia Santa Rosa de Lima").length).toBeGreaterThan(0);
      expect(screen.getByText("Troféu Patrocinador com Base e Arte")).toBeInTheDocument();

      // 60×22,00 + 30×19,00 = 1.320,00 + 570,00 = 1.890,00
      const totals = container.querySelector(".doc-summary-table-pdf");
      expect(totals?.textContent).toContain("1.890,00");

      // A paleta da folha é literal: nenhuma classe de cor do tema pode vazar.
      expect(container.querySelector(".doc-sheet")).toBeTruthy();
      expect(container.innerHTML).not.toMatch(/bg-surface|text-foreground|border-border/);
    },
  );

  it("mostra a declaração de quitação e o valor por extenso só no recibo", () => {
    const { container } = renderDoc("recibo");
    const statement = container.querySelector(".doc-statement");
    expect(statement?.textContent).toContain("Recebemos de");
    expect(statement?.textContent).toContain("mil oitocentos e noventa reais");
  });

  it("não mostra a declaração de quitação no orçamento", () => {
    const { container } = renderDoc("orcamento");
    expect(container.querySelector(".doc-statement")).toBeNull();
  });

  it("mostra a coluna de foto quando há foto e o tipo permite", () => {
    const { container } = renderDoc("orcamento");
    const head = container.querySelector(".doc-items-pdf thead");
    expect(within(head as HTMLElement).getByText("Foto")).toBeInTheDocument();
    expect(container.querySelector("img.doc-item-photo")).toBeTruthy();
  });

  it("esconde a coluna de foto no recibo", () => {
    const { container } = renderDoc("recibo");
    const head = container.querySelector(".doc-items-pdf thead");
    expect(within(head as HTMLElement).queryByText("Foto")).toBeNull();
  });

  it("formata CNPJ, CEP e telefone do cliente", () => {
    const { container } = renderDoc("orcamento");
    const parties = container.querySelector(".doc-parties-pdf");
    expect(parties?.textContent).toContain("12.345.678/0001-99");
    expect(parties?.textContent).toContain("32450-000");
    expect(parties?.textContent).toContain("(31) 99841-9393");
  });

  it("estampa a tarja quando o documento foi cancelado", () => {
    renderDoc("recibo", { voidedAt: "2026-07-27T10:00:00.000Z", voidReason: "Valor errado" });
    expect(screen.getByText("CANCELADO")).toBeInTheDocument();
  });

  it("repete o cabeçalho da tabela em documentos de várias páginas", () => {
    // `display: table-header-group` vem da CSS; aqui garante-se que o <thead>
    // existe como elemento próprio, que é a pré-condição para a regra funcionar.
    const { container } = renderDoc("orcamento");
    expect(container.querySelector(".doc-items-pdf > thead")).toBeTruthy();
  });
});
