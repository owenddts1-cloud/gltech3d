import type { DocumentSnapshot } from "@/lib/schemas/service-order-documents";
import { formatCityDateBr } from "@/lib/format/document";

/**
 * Linhas de assinatura.
 *
 * `signature.signerName`, `signerRole` e `city` são editáveis no gerador de
 * documentos mas eram ignorados aqui — três campos mortos. Agora aparecem, com
 * a linha de local e data acima das assinaturas.
 */
export function DocSignature({ snapshot }: { snapshot: DocumentSnapshot }) {
  const { signature, org, customer, docType, payment, issuedAt } = snapshot;
  if (!signature.showLines) return null;

  // No recibo o que importa é a data do recebimento, não a da emissão.
  const dateIso = docType === "recibo" ? (payment.paidAt ?? issuedAt) : issuedAt;
  const cityDate = formatCityDateBr(signature.city, dateIso);

  const contractedName = signature.signerName || org.displayName;
  const contractedRole = signature.signerRole || "CONTRATADA";

  return (
    <section className="doc-signatures-wrap">
      {cityDate ? <p className="doc-city-date">{cityDate}</p> : null}

      <div className="doc-signatures-pdf">
        <div className="doc-signature-line">
          <div className="doc-sig-border" />
          {contractedName ? <p className="doc-signature-title">{contractedName}</p> : null}
          <p className="doc-signature-role">{contractedRole}</p>
        </div>

        <div className="doc-signature-line">
          <div className="doc-sig-border" />
          {customer.name ? <p className="doc-signature-title">{customer.name}</p> : null}
          <p className="doc-signature-role">CONTRATANTE</p>
        </div>
      </div>
    </section>
  );
}
