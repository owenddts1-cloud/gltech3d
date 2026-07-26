import type { DocumentSnapshot } from "@/lib/schemas/service-order-documents";
import { formatAddressLine, maskPhoneBr } from "@/lib/format/document";
import { Phone, EnvelopeSimple, MapPin } from "@/lib/ui/icons";

export function DocFooter({ snapshot }: { snapshot: DocumentSnapshot }) {
  const { org, options } = snapshot;

  const phone = maskPhoneBr(org.phone) || "(31) 99928-4834";
  const email = org.email || "lanuci321@gmail.com";
  const address = formatAddressLine(org.address) || "Rua Geraldo Nassif Salomão, 20\n32450-000 - Centro, Sarzedo-MG";

  return (
    <footer className="doc-footer-pdf">
      {/* Coluna 1: Empresa */}
      <div className="doc-footer-col-brand">
        <h4 className="doc-footer-brand-name">{org.displayName || "GL TECH 3D"}</h4>
        <p className="doc-footer-brand-slogan">Impressão e Personalização 3D</p>
        <p className="doc-footer-brand-motto">Transformando ideias em realidade.</p>
      </div>

      {/* Divisória Dourada */}
      <div className="doc-footer-divider" />

      {/* Coluna 2: Contatos com Ícones SVG */}
      <div className="doc-footer-col-contacts">
        <div className="doc-footer-contact-item">
          <span className="doc-footer-icon">
            <Phone size={13} weight="bold" />
          </span>
          <span>{phone}</span>
        </div>
        <div className="doc-footer-contact-item">
          <span className="doc-footer-icon">
            <EnvelopeSimple size={13} weight="bold" />
          </span>
          <span>{email}</span>
        </div>
        <div className="doc-footer-contact-item">
          <span className="doc-footer-icon">
            <MapPin size={13} weight="bold" />
          </span>
          <span>{address}</span>
        </div>
      </div>

      {/* Divisória Dourada */}
      <div className="doc-footer-divider" />

      {/* Coluna 3: Agradecimento Manuscrito */}
      <div className="doc-footer-col-thanks">
        {options.showFooterNote ? (
          <div className="doc-footer-thanks-wrap">
            <p className="doc-footer-script">{org.footerNote || "Agradecemos a preferência!"}</p>
          </div>
        ) : null}
      </div>
    </footer>
  );
}
