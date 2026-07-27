import type { DocumentSnapshot } from "@/lib/schemas/service-order-documents";
import { validUntil } from "@/app/app/service-orders/_lib/document-draft";
import { formatDateBr } from "@/lib/format/document";
import { FileText, CalendarBlank, Clock } from "@/lib/ui/icons";

export function DocMetaCard({ snapshot, number }: { snapshot: DocumentSnapshot; number: string }) {
  const { issuedAt, docType, serviceOrder } = snapshot;
  const until = validUntil(snapshot);

  return (
    <div className="doc-meta-card-pdf">
      <div className="doc-meta-card-item">
        <div className="doc-meta-card-icon-box">
          <FileText size={18} weight="bold" />
        </div>
        <div className="doc-meta-card-content">
          <span className="doc-meta-card-label">Nº DOCUMENTO:</span>
          <span className="doc-meta-card-value font-bold">{number}</span>
        </div>
      </div>

      <div className="doc-meta-card-divider" />

      <div className="doc-meta-card-item">
        <div className="doc-meta-card-icon-box">
          <CalendarBlank size={18} weight="bold" />
        </div>
        <div className="doc-meta-card-content">
          <span className="doc-meta-card-label">EMITIDO EM:</span>
          <span className="doc-meta-card-value">{formatDateBr(issuedAt)}</span>
        </div>
      </div>

      <div className="doc-meta-card-divider" />

      <div className="doc-meta-card-item">
        <div className="doc-meta-card-icon-box">
          <Clock size={18} weight="bold" />
        </div>
        <div className="doc-meta-card-content">
          {docType === "orcamento" ? (
            <>
              <span className="doc-meta-card-label">VÁLIDO ATÉ:</span>
              <span className="doc-meta-card-value">{until ? formatDateBr(until) : "—"}</span>
            </>
          ) : docType === "ordem_servico" ? (
            <>
              <span className="doc-meta-card-label">PREVISÃO CONCLUSÃO:</span>
              <span className="doc-meta-card-value">
                {serviceOrder.slaDueAt ? formatDateBr(serviceOrder.slaDueAt) : "—"}
              </span>
            </>
          ) : (
            <>
              <span className="doc-meta-card-label">SITUAÇÃO:</span>
              <span className="doc-meta-card-value text-emerald-600 font-bold">QUITADO</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
