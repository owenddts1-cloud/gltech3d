import type { DocumentSnapshot } from "@/lib/schemas/service-order-documents";
import { formatDateBr } from "@/lib/format/document";
import { validUntil } from "@/app/app/service-orders/_lib/document-draft";
import { ShieldCheck, Info } from "@/lib/ui/icons";

/**
 * Coluna direita: condições comerciais (orçamento) ou especificações de
 * produção (O.S.), mais observações.
 *
 * Este bloco imprimia "Camada: 0.20 mm / Infill: 15% / Suportes: Sim /
 * Material: PLA" sempre que os campos estivessem vazios — e estavam sempre, o
 * que fazia toda O.S. entregar ao cliente um parâmetro de produção que ninguém
 * configurou. Agora cada linha só aparece com valor real, e o cartão inteiro
 * some se não houver nenhum.
 */

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <p className="doc-term-row">
      <strong>{label}:</strong> {value}
    </p>
  );
}

export function DocTerms({ snapshot }: { snapshot: DocumentSnapshot }) {
  const { terms, docType, serviceOrder } = snapshot;

  const validity = docType === "orcamento" ? formatDateBr(validUntil(snapshot)) : "";
  const commercialRows =
    docType === "orcamento" ? [validity, terms.paymentConditions].filter(Boolean) : [];
  const techRows =
    docType === "ordem_servico"
      ? [serviceOrder.layerHeight, serviceOrder.infill, serviceOrder.supports, serviceOrder.material].filter(Boolean)
      : [];
  const warranty = docType === "ordem_servico" ? terms.warranty : "";

  const showFirstCard = commercialRows.length > 0 || techRows.length > 0 || Boolean(warranty);
  const showNotes = Boolean(terms.notes);
  if (!showFirstCard && !showNotes) return null;

  return (
    <div className="doc-terms-right-col">
      {showFirstCard ? (
        <div className="doc-term-card-pdf">
          <div className="doc-card-header">
            <div className="doc-card-icon-badge">
              <ShieldCheck size={16} weight="bold" />
            </div>
            <h3 className="doc-card-title">
              {docType === "ordem_servico" ? "ESPECIFICAÇÕES TÉCNICAS (3D)" : "CONDIÇÕES DA PROPOSTA"}
            </h3>
          </div>

          <div className="doc-term-card-body">
            {docType === "orcamento" ? (
              <div>
                <Row label="Validade" value={validity} />
                <Row label="Condições" value={terms.paymentConditions} />
              </div>
            ) : null}

            {docType === "ordem_servico" ? (
              <>
                {techRows.length > 0 ? (
                  <div className="doc-tech-grid-pdf">
                    <Row label="Camada" value={serviceOrder.layerHeight} />
                    <Row label="Infill" value={serviceOrder.infill} />
                    <Row label="Suportes" value={serviceOrder.supports} />
                    <Row label="Material" value={serviceOrder.material} />
                  </div>
                ) : null}
                <Row label="Garantia" value={warranty} />
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {showNotes ? (
        <div className="doc-term-card-pdf">
          <div className="doc-card-header">
            <div className="doc-card-icon-badge">
              <Info size={16} weight="bold" />
            </div>
            <h3 className="doc-card-title">OBSERVAÇÕES</h3>
          </div>
          <div className="doc-term-card-body">
            <p className="doc-term-notes-text">{terms.notes}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
