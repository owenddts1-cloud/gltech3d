import type { DocumentSnapshot } from "@/lib/schemas/service-order-documents";
import { formatAddressLine, maskPhoneBr } from "@/lib/format/document";
import { Phone, EnvelopeSimple, MapPin } from "@/lib/ui/icons";

/**
 * Faixa de rodapé.
 *
 * Este bloco tinha o telefone, o e-mail e o endereço reais da GL TECH 3D como
 * fallback — ou seja, qualquer organização sem branding configurado imprimia os
 * dados de contato de outra empresa. Agora cada item só aparece se existir, e a
 * coluna inteira some se não houver nenhum.
 *
 * O slogan e o mote saem de `legalName` e `footerNote` das configurações, em vez
 * de texto fixo no código.
 */
export function DocFooter({ snapshot }: { snapshot: DocumentSnapshot }) {
  const { org, options } = snapshot;

  const contacts = [
    { key: "phone", icon: <Phone size={13} weight="bold" />, value: maskPhoneBr(org.phone) },
    { key: "email", icon: <EnvelopeSimple size={13} weight="bold" />, value: org.email },
    { key: "address", icon: <MapPin size={13} weight="bold" />, value: formatAddressLine(org.address) },
  ].filter((c) => c.value);

  const hasBrand = Boolean(org.displayName || org.legalName || org.footerNote);
  if (!hasBrand && contacts.length === 0) return null;

  return (
    <footer className="doc-footer-pdf">
      <div className="doc-footer-col-brand">
        {org.displayName ? <h4 className="doc-footer-brand-name">{org.displayName}</h4> : null}
        {org.legalName && org.legalName !== org.displayName ? (
          <p className="doc-footer-brand-slogan">{org.legalName}</p>
        ) : null}
        {org.cnpj ? <p className="doc-footer-brand-motto">CNPJ {org.cnpj}</p> : null}
      </div>

      {contacts.length > 0 ? (
        <>
          <div className="doc-footer-divider" />
          <div className="doc-footer-col-contacts">
            {contacts.map((c) => (
              <div key={c.key} className="doc-footer-contact-item">
                <span className="doc-footer-icon">{c.icon}</span>
                <span>{c.value}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {options.showFooterNote && org.footerNote ? (
        <>
          <div className="doc-footer-divider" />
          <div className="doc-footer-col-thanks">
            <div className="doc-footer-thanks-wrap">
              <p className="doc-footer-script">{org.footerNote}</p>
            </div>
          </div>
        </>
      ) : null}
    </footer>
  );
}
