import type { DocumentSnapshot } from "@/lib/schemas/service-order-documents";
import { formatAddressLine, maskCpfCnpj, maskPhoneBr } from "@/lib/format/document";
import { Buildings, User, ClipboardText } from "@/lib/ui/icons";

/**
 * Cartões de empresa e cliente.
 *
 * Regra: campo vazio não aparece. Este bloco já teve o telefone, o e-mail e o
 * endereço da GL TECH 3D — e o nome e o endereço de uma cliente real — embutidos
 * como fallback. Num CRM multi-tenant isso imprime os dados de um cliente no
 * documento de outro. Nada aqui inventa dado: ou vem do snapshot, ou some.
 */

/** Uma linha rotulada que desaparece quando não há valor. */
function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <p className="doc-party-row">
      <strong>{label}:</strong> {value}
    </p>
  );
}

export function DocParties({ snapshot }: { snapshot: DocumentSnapshot }) {
  const { org, customer, description } = snapshot;
  // formatAddressLine já monta rua/número/complemento — bairro, cidade/UF e CEP,
  // pulando o que estiver vazio. Não há nada a concatenar por fora.
  const orgAddress = formatAddressLine(org.address);
  const custAddress = formatAddressLine(customer.address);

  return (
    <section className="doc-parties-pdf">
      <div className="doc-parties-grid">
        <div className="doc-party-card">
          <div className="doc-party-head">
            <span className="doc-icon-badge">
              <Buildings size={14} weight="bold" />
            </span>
            <h3 className="doc-party-head-title">DADOS DA EMPRESA</h3>
          </div>
          <div className="doc-party-body">
            {org.displayName ? <p className="doc-party-main-name">{org.displayName}</p> : null}
            <Row label="CNPJ" value={maskCpfCnpj(org.cnpj)} />
            <Row label="Endereço" value={orgAddress} />
            <Row label="Contato" value={maskPhoneBr(org.phone)} />
            <Row label="E-mail" value={org.email} />
            <Row label="Site" value={org.site} />
          </div>
        </div>

        <div className="doc-party-card">
          <div className="doc-party-head">
            <span className="doc-icon-badge">
              <User size={14} weight="bold" />
            </span>
            <h3 className="doc-party-head-title">DADOS DO CLIENTE</h3>
          </div>
          <div className="doc-party-body">
            {customer.name ? <p className="doc-party-main-name">{customer.name}</p> : null}
            <Row label="A/C" value={customer.contactPerson} />
            <Row label="CPF/CNPJ" value={maskCpfCnpj(customer.documentNumber)} />
            <Row label="Endereço" value={custAddress} />
            <Row label="Contato" value={maskPhoneBr(customer.phone)} />
            <Row label="E-mail" value={customer.email} />
          </div>
        </div>
      </div>

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
