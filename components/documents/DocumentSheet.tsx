import type { RenderableDocument } from "@/lib/schemas/service-order-documents";
import { brlFromCents } from "@/lib/format/money";

import { DocHeader } from "./parts/DocHeader";
import { DocParties } from "./parts/DocParties";
import { DocItemsTable } from "./parts/DocItemsTable";
import { DocMetaCard } from "./parts/DocMetaCard";
import { DocTotals } from "./parts/DocTotals";
import { DocTerms } from "./parts/DocTerms";
import { DocPhotoGallery } from "./parts/DocPhotoGallery";
import { DocSignature } from "./parts/DocSignature";
import { DocFooter } from "./parts/DocFooter";

export function DocumentSheet({ document }: { document: RenderableDocument }) {
  const { snapshot, number, voidedAt } = document;

  return (
    <article className="doc-sheet">
      {voidedAt ? (
        <div className="doc-void" aria-hidden="true">
          <span>CANCELADO</span>
        </div>
      ) : null}

      {/* 1. Cabeçalho Banner */}
      <DocHeader snapshot={snapshot} number={number} />

      {/* 2. Dados da Empresa, Cliente e Descrição Serviço */}
      <DocParties snapshot={snapshot} />

      {/* 3. Recibo Statement (se for recibo) */}
      {snapshot.docType === "recibo" ? (
        <p className="doc-statement">
          Recebemos de <strong>{snapshot.customer.name || "—"}</strong> a quantia de{" "}
          <strong>{brlFromCents(snapshot.totals.totalCents)}</strong>, referente aos itens e serviços
          discriminados abaixo, dando plena e geral quitação para os devidos fins.
          <span className="doc-statement-words">
            ({snapshot.payment.amountInWords})
          </span>
        </p>
      ) : null}

      {/* 4. Tabela de Itens (Largura Total da Folha) */}
      <DocItemsTable snapshot={snapshot} />

      {/* 5. Seção em Grid de 2 Colunas: Esquerda (Resumo Financeiro) | Direita (Painel de Datas + Condições + Observações) */}
      <div className="doc-middle-grid-pdf">
        {/* Coluna Esquerda: RESUMO FINANCEIRO E PRAZOS */}
        <div className="doc-middle-left-col">
          <DocTotals snapshot={snapshot} />
        </div>

        {/* Coluna Direita: PAINEL DE DATAS DO DOCUMENTO + CONDIÇÕES DA PROPOSTA + OBSERVAÇÕES */}
        <div className="doc-middle-right-col">
          <DocMetaCard snapshot={snapshot} number={number} />
          <DocTerms snapshot={snapshot} />
        </div>
      </div>

      {/* 6. Galeria Numerada (se houver fotos de produtos) */}
      <DocPhotoGallery snapshot={snapshot} />

      {/* Empurra assinatura e rodapé para o fim da folha quando sobra espaço */}
      <div className="doc-spacer" />

      {/* 7. Assinaturas Duplas e Rodapé Banner */}
      <DocSignature snapshot={snapshot} />
      <DocFooter snapshot={snapshot} />
    </article>
  );
}
