import type { DocumentSnapshot } from "@/lib/schemas/service-order-documents";

export function DocSignature({ snapshot }: { snapshot: DocumentSnapshot }) {
  const { signature, org } = snapshot;
  if (!signature.showLines) return null;

  return (
    <section className="doc-signatures-pdf">
      {/* Assinatura GL TECH 3D */}
      <div className="doc-signature-line">
        <div className="doc-sig-border" />
        <p className="doc-signature-title">{org.displayName || "GL TECH 3D"}</p>
      </div>

      {/* Assinatura Contratante */}
      <div className="doc-signature-line">
        <div className="doc-sig-border" />
        <p className="doc-signature-title">CONTRATANTE</p>
      </div>
    </section>
  );
}
