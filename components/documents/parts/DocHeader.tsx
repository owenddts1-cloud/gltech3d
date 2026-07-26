import type { DocumentSnapshot } from "@/lib/schemas/service-order-documents";

export function DocHeader({ snapshot, number: _number }: { snapshot: DocumentSnapshot; number: string }) {
  const { org, customer, heroImageUrl, docType } = snapshot;

  // Usa a logo das configurações ou a logo oficial de documentos fornecida pelo usuário
  const logoUrl = org.logoUrl || "/images/Logo/Logo%20Documentos.png";

  const clientName = customer.name || "CLIENTE";

  let mainTitlePrefix = "PROPOSTA";
  let mainTitleSuffix = "COMERCIAL";
  if (docType === "ordem_servico") {
    mainTitlePrefix = "ORDEM DE";
    mainTitleSuffix = "SERVIÇO";
  } else if (docType === "recibo") {
    mainTitlePrefix = "RECIBO DE";
    mainTitleSuffix = "PAGAMENTO";
  }

  const docSubtitle =
    docType === "orcamento"
      ? "A GL TECH 3D apresenta a seguinte proposta comercial referente ao fornecimento de artes e itens personalizados para a"
      : docType === "ordem_servico"
        ? "A GL TECH 3D apresenta a seguinte ordem de serviço para prototipagem e fabricação tridimensional para a"
        : "A GL TECH 3D declara o recebimento financeiro e quitação integral dos serviços e produtos para a";

  return (
    <header className="doc-header-pdf">
      {/* Lado Esquerdo: Logo GL TECH 3D */}
      <div className="doc-header-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="doc-header-logo" src={logoUrl} alt="GL TECH 3D Logo" />
      </div>

      {/* Divisória Dourada */}
      <div className="doc-header-divider" />

      {/* Centro: Título e Subtítulo */}
      <div className="doc-header-title-box">
        <h1 className="doc-header-title">
          <span>{mainTitlePrefix}</span> <span className="doc-gold-text">{mainTitleSuffix}</span>
        </h1>
        <p className="doc-header-sub">
          {docSubtitle} <strong className="doc-gold-text">{clientName}</strong>
        </p>
      </div>

      {/* Lado Direito: Apenas exibe foto se o usuário colocar explicitamente */}
      {heroImageUrl ? (
        <div className="doc-header-hero-wrap">
          <div className="doc-header-hero-bg" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroImageUrl} alt="Projeto Destaque" className="doc-header-hero-img" />
        </div>
      ) : null}

      {docType === "recibo" && (
        <div className="doc-quitado-badge" aria-hidden="true">
          QUITADO
        </div>
      )}
    </header>
  );
}
