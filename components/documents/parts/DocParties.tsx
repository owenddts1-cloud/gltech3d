import type { DocumentSnapshot } from "@/lib/schemas/service-order-documents";
import { formatAddressLine, maskCpfCnpj, maskPhoneBr } from "@/lib/format/document";
import { Buildings, User, ClipboardText } from "@/lib/ui/icons";

export function DocParties({ snapshot }: { snapshot: DocumentSnapshot }) {
  const { org, customer, description } = snapshot;
  const orgAddress = formatAddressLine(org.address);
  const custAddress = formatAddressLine(customer.address);

  return (
    <section className="doc-parties-pdf">
      {/* GRID DADOS EMPRESA E CLIENTE */}
      <div className="doc-parties-grid">
        {/* DADOS DA EMPRESA */}
        <div className="doc-party-card">
          <div className="doc-party-head">
            <span className="doc-icon-badge">
              <Buildings size={14} weight="bold" />
            </span>
            <h3 className="doc-party-head-title">DADOS DA EMPRESA</h3>
          </div>
          <div className="doc-party-body">
            <p className="doc-party-main-name">{org.displayName || "GL TECH 3D"}</p>
            <p className="doc-party-row">
              <strong>Endereço:</strong> {orgAddress || "Rua Geraldo Nassif Salomão, 20"}
            </p>
            {org.address.cep ? (
              <p className="doc-party-row">
                <strong>CEP:</strong> {org.address.cep}, Centro, Sarzedo-MG
              </p>
            ) : null}
            <p className="doc-party-row">
              <strong>Contato:</strong> {maskPhoneBr(org.phone) || "(31) 99928-4834"}
            </p>
            <p className="doc-party-row">
              <strong>E-mail:</strong> {org.email || "lanuci321@gmail.com"}
            </p>
          </div>
        </div>

        {/* DADOS DO CLIENTE */}
        <div className="doc-party-card">
          <div className="doc-party-head">
            <span className="doc-icon-badge">
              <User size={14} weight="bold" />
            </span>
            <h3 className="doc-party-head-title">DADOS DO CLIENTE</h3>
          </div>
          <div className="doc-party-body">
            <p className="doc-party-main-name">{customer.name || "JANE"}</p>
            {customer.contactPerson ? (
              <p className="doc-party-row">
                <strong>A/C:</strong> {customer.contactPerson}
              </p>
            ) : null}
            {customer.documentNumber ? (
              <p className="doc-party-row">
                <strong>CPF/CNPJ:</strong> {maskCpfCnpj(customer.documentNumber)}
              </p>
            ) : null}
            <p className="doc-party-row">
              <strong>Endereço:</strong> {custAddress || "R. Vicente Nunes Resende, 35, 32450-000, Centro, Sarzedo-MG"}
            </p>
            <p className="doc-party-row">
              <strong>Contato:</strong> {maskPhoneBr(customer.phone) || "(31) 99841-9393"}
            </p>
            <p className="doc-party-row">
              <strong>E-mail:</strong> {customer.email || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* DESCRIÇÃO SERVIÇO */}
      {description ? (
        <div className="doc-service-desc-card">
          <div className="doc-party-head">
            <span className="doc-icon-badge">
              <ClipboardText size={14} weight="bold" />
            </span>
            <h3 className="doc-party-head-title">DESCRIÇÃO SERVIÇO</h3>
          </div>
          <p className="doc-service-desc-text">{description}</p>
        </div>
      ) : null}
    </section>
  );
}
