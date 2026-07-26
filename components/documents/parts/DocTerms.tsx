import type { DocumentSnapshot } from "@/lib/schemas/service-order-documents";
import { formatDateBr } from "@/lib/format/document";
import { validUntil } from "@/app/app/service-orders/_lib/document-draft";
import { ShieldCheck, Info } from "@/lib/ui/icons";

export function DocTerms({ snapshot }: { snapshot: DocumentSnapshot }) {
  const { terms, docType, serviceOrder } = snapshot;

  return (
    <div className="doc-terms-right-col">
      {/* CARD 1: CONDIÇÕES DA PROPOSTA / ESPECIFICAÇÕES */}
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
          {docType === "orcamento" && (
            <div>
              <p className="doc-term-row">
                <strong>Validade:</strong> {formatDateBr(validUntil(snapshot))}
              </p>
              {terms.paymentConditions ? (
                <p className="doc-term-row mt-1">
                  <strong>Condições:</strong> {terms.paymentConditions}
                </p>
              ) : null}
            </div>
          )}

          {docType === "ordem_servico" && (
            <div className="doc-tech-grid-pdf">
              <p className="doc-term-row">
                <strong>Camada:</strong> {serviceOrder.layerHeight || "0.20 mm"}
              </p>
              <p className="doc-term-row">
                <strong>Infill:</strong> {serviceOrder.infill || "15%"}
              </p>
              <p className="doc-term-row">
                <strong>Suportes:</strong> {serviceOrder.supports || "Sim"}
              </p>
              <p className="doc-term-row">
                <strong>Material:</strong> {serviceOrder.material || "PLA"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CARD 2: OBSERVAÇÕES */}
      <div className="doc-term-card-pdf">
        <div className="doc-card-header">
          <div className="doc-card-icon-badge">
            <Info size={16} weight="bold" />
          </div>
          <h3 className="doc-card-title">OBSERVAÇÕES</h3>
        </div>
        <div className="doc-term-card-body">
          <p className="doc-term-notes-text">
            {terms.notes ||
              "O tom de cor da matéria-prima (filamento/resina) pode variar levemente conforme o lote do fabricante."}
          </p>
        </div>
      </div>
    </div>
  );
}
