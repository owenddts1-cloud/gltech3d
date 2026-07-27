import type { DocumentSnapshot } from "@/lib/schemas/service-order-documents";
import { formatCityDateBr } from "@/lib/format/document";

export function DocSignature({ snapshot }: { snapshot: DocumentSnapshot }) {
  const { signature, org, customer, docType, payment, issuedAt } = snapshot;
  if (!signature.showLines) return null;

  const dateIso = docType === "recibo" ? (payment.paidAt ?? issuedAt) : issuedAt;
  const cityDate = formatCityDateBr(signature.city, dateIso);

  const contractedName = signature.signerName || org.displayName;
  const contractedRole = signature.signerRole || "CONTRATADA";

  return (
    <section className="doc-signatures-wrap">
      {/* Linha horizontal com a Data no centro exato da página */}
      <div className="doc-signature-line-container">
        <div className="doc-sig-border-line" />
        {cityDate ? <span className="doc-city-date-center">{cityDate}</span> : null}
      </div>

      <div className="doc-signatures-pdf">
        <div className="doc-signature-col doc-sig-left">
          {contractedName ? <p className="doc-signature-title">{contractedName}</p> : null}
          <p className="doc-signature-role">{contractedRole}</p>
        </div>

        <div className="doc-signature-col doc-sig-right">
          {customer.name ? <p className="doc-signature-title">{customer.name}</p> : null}
          <p className="doc-signature-role">CONTRATANTE</p>
        </div>
      </div>
    </section>
  );
}
