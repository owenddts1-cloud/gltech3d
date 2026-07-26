import type { Metadata } from "next";
import { notFound } from "next/navigation";

// A folha do preview usa a MESMA CSS da rota de impressão — sem isto o editor
// mostraria um documento sem estilo nenhum.
import "@/components/documents/document.css";

import { fetchDocumentContext } from "@/app/actions/service-orders/documents";
import { parseDocType } from "@/lib/schemas/service-order-documents";

import { DocumentBuilder } from "./_components/DocumentBuilder";

export const metadata: Metadata = { title: "Emitir documento" };
export const dynamic = "force-dynamic";

export default async function ServiceOrderDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tipo?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  const res = await fetchDocumentContext(id);
  if (!res.ok) notFound();

  return (
    <div className="p-4 md:p-6">
      <DocumentBuilder
        context={res.context}
        initialDocuments={res.documents}
        initialDocType={parseDocType(sp.tipo)}
      />
    </div>
  );
}
