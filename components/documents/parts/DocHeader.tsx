import type { DocumentSnapshot } from "@/lib/schemas/service-order-documents";

/** Iniciais da empresa, para quando não há logo configurada. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

/**
 * Faixa preta do topo: marca, título do documento e imagem de destaque.
 *
 * A logo vem só de `org.logoUrl`. Antes havia um caminho fixo para a logo da
 * GL TECH 3D, o que estampava a marca dela no documento de qualquer outra
 * organização — configure em Ajustes → Organização → Documentos impressos.
 *
 * O texto de abertura interpola o nome da própria organização em vez de dizer
 * "A GL TECH 3D" para todo mundo.
 */
export function DocHeader({ snapshot }: { snapshot: DocumentSnapshot; number: string }) {
  const { org, customer, heroImageUrl, docType } = snapshot;

  const TITLES: Record<typeof docType, [string, string]> = {
    orcamento: ["PROPOSTA", "COMERCIAL"],
    ordem_servico: ["ORDEM DE", "SERVIÇO"],
    recibo: ["RECIBO DE", "PAGAMENTO"],
  };
  const [mainTitlePrefix, mainTitleSuffix] = TITLES[docType];

  // Sem nome da organização, a frase começa direto no verbo — em vez de abrir com
  // o nome de outra empresa.
  const subject = org.displayName ? `A ${org.displayName} ` : "";
  const ACTIONS: Record<typeof docType, string> = {
    orcamento: "apresenta a seguinte proposta comercial referente ao fornecimento de artes e itens personalizados",
    ordem_servico: "apresenta a seguinte ordem de serviço para prototipagem e fabricação tridimensional",
    recibo: "declara o recebimento financeiro e a quitação integral dos serviços e produtos",
  };
  const monogram = initials(org.displayName);

  return (
    <header className="doc-header-pdf">
      <div className="doc-header-brand">
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="doc-header-logo" src={org.logoUrl} alt={org.displayName || ""} />
        ) : monogram ? (
          <span className="doc-header-monogram" aria-hidden="true">
            {monogram}
          </span>
        ) : null}
      </div>

      <div className="doc-header-divider" />

      <div className="doc-header-title-box">
        <h1 className="doc-header-title">
          <span>{mainTitlePrefix}</span> <span className="doc-gold-text">{mainTitleSuffix}</span>
        </h1>
        <p className="doc-header-sub">
          {subject}
          {ACTIONS[docType]}
          {customer.name ? (
            <>
              {" para a "}
              <strong className="doc-gold-text">{customer.name}</strong>
            </>
          ) : (
            "."
          )}
        </p>
      </div>

      {heroImageUrl ? (
        <div className="doc-header-hero-wrap">
          <div className="doc-header-hero-bg" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroImageUrl} alt="" className="doc-header-hero-img" />
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
