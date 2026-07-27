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

  it("usa o subtotal do snapshot, sem recalcular por fora", () => {
    // A tabela recalculava a soma localmente, o que podia divergir do VALOR FINAL
    // do resumo — dois números diferentes no mesmo papel.
    const { container } = renderDoc("orcamento");
    const table = container.querySelector(".doc-items-pdf");
    const summary = container.querySelector(".doc-summary-table-pdf");
    expect(table?.textContent).toContain("1.890,00");
    expect(summary?.textContent).toContain("1.890,00");
  });

  it("toda classe doc-* usada na folha tem CSS correspondente", async () => {
    // Regressão real: o bloco de local/data e a declaração de quitação foram
    // renderizados com classes que não existiam no document.css e saíram sem
    // estilo nenhum no papel. Compilar e renderizar não pega isso.
    const { readFileSync, readdirSync } = await import("node:fs");
    const css = readFileSync("components/documents/document.css", "utf-8");
    const defined = new Set(Array.from(css.matchAll(/\.(doc-[a-z0-9-]+)/g), (m) => m[1]!));

    const files = readdirSync("components/documents", { recursive: true, encoding: "utf-8" })
      .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
      .map((f) => `components/documents/${f.replace(/\\/g, "/")}`);
    const used = new Set<string>();
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        for (const cls of `${m[1] ?? ""} ${m[2] ?? ""}`.split(/\s+/)) {
          if (cls.startsWith("doc-")) used.add(cls);
        }
      }
    }

    // Guarda contra teste vazio: se a varredura não achar nada, ela não vale nada.
    expect(files.length).toBeGreaterThan(5);
    expect(used.size).toBeGreaterThan(50);
    expect(defined.size).toBeGreaterThan(50);
    expect([...used].filter((c) => !defined.has(c))).toEqual([]);
  });

  it("renderiza o assinante e o cargo configurados", () => {
    // signerName/signerRole/city eram editáveis no gerador e ignorados na folha.
    const { container } = renderDoc("orcamento");
    const sig = container.querySelector(".doc-signatures-wrap");
    expect(sig?.textContent).toContain("Guilherme");
    expect(sig?.textContent).toContain("CONTRATANTE");
  });
});

/**
 * A blindagem que faltava.
 *
 * O commit do redesign transformou os dados de exemplo do PDF em fallback de
 * produção: telefone, e-mail e endereço reais da GL TECH 3D, nome e endereço de
 * uma cliente, e parâmetros de impressão fabricados ("0.20 mm", "15%", "PLA").
 * Nada disso foi pego porque todo teste passava um contexto completo.
 *
 * Aqui o contexto é propositalmente VAZIO. Se algum literal voltar ao código,
 * este bloco quebra.
 */
describe("DocumentSheet — organização sem nada configurado", () => {
  const EMPTY_CONTEXT: DocumentContext = {
    order: {
      id: "33333333-3333-4333-8333-333333333333",
      code: null,
      title: "Peça avulsa",
      contactId: null,
      contactName: null,
      status: "orcamento",
      material: null,
      qty: 1,
      totalCents: 5000,
      slaDueAt: null,
      createdAt: "2026-07-20T12:00:00.000Z",
      notes: "",
    },
    items: [],
    contact: null,
    products: [],
    org: {
      displayName: "",
      legalName: "",
      cnpj: "",
      branding: emptyDocumentBranding(),
    },
    issuedBy: { userId: null, name: "" },
    nowIso: "2026-07-26T12:00:00.000Z",
  };

  /** Todo literal que já esteve embutido como fallback. Nenhum pode reaparecer. */
  const FORBIDDEN = [
    "99928-4834",
    "99841-9393",
    "lanuci321",
    "Sarzedo",
    "Vicente Nunes",
    "Geraldo Nassif",
    "JANE",
    "GL TECH 3D",
    "0.20 mm",
    "15%",
    "PLA",
    "60 dias",
    "Valor com desconto",
    "±0.1mm",
  ];

  it.each(["orcamento", "ordem_servico", "recibo"] as const)(
    "não inventa nenhum dado no documento do tipo %s",
    (docType) => {
      const { container } = render(
        <DocumentSheet
          document={{
            snapshot: buildDraftSnapshot(EMPTY_CONTEXT, docType),
            number: "ORC-2026-0001",
            voidedAt: null,
            voidReason: null,
          }}
        />,
      );

      const text = container.textContent ?? "";
      for (const literal of FORBIDDEN) {
        expect(text, `vazou o literal "${literal}"`).not.toContain(literal);
      }
    },
  );

  it("omite o bloco de especificações técnicas quando não há parâmetro algum", () => {
    const { container } = render(
      <DocumentSheet
        document={{
          snapshot: buildDraftSnapshot(EMPTY_CONTEXT, "ordem_servico"),
          number: "OSV-2026-0001",
          voidedAt: null,
          voidReason: null,
        }}
      />,
    );
    expect(container.textContent).not.toContain("ESPECIFICAÇÕES TÉCNICAS");
  });

  it("ainda imprime o valor final, que é o que define o documento", () => {
    const { container } = render(
      <DocumentSheet
        document={{
          snapshot: buildDraftSnapshot(EMPTY_CONTEXT, "orcamento"),
          number: "ORC-2026-0001",
          voidedAt: null,
          voidReason: null,
        }}
      />,
    );
    expect(container.querySelector(".doc-summary-table-pdf")?.textContent).toContain("50,00");
  });
});
