import { notFound } from "next/navigation";

import { DocumentSheet } from "@/components/documents/DocumentSheet";
import { fetchServiceOrderDocument } from "@/app/actions/service-orders/documents";
import { DOC_TYPE_SHORT } from "@/lib/schemas/service-order-documents";

import { PrintBar } from "./PrintBar";

export const dynamic = "force-dynamic";

/**
 * A folha pronta para impressão. Fora do `app/app/` de propósito: aqui não há
 * sidebar nem topbar para o papel capturar.
 *
 * A rota NÃO está em `PUBLIC_PATHS`, então o middleware já exige sessão, e a
 * action filtra por `organization_id` — documento de outro tenant não abre.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetchServiceOrderDocument(id);
  if (!res.ok) return { title: "Documento" };
  return { title: `${DOC_TYPE_SHORT[res.document.snapshot.docType]} ${res.document.number}` };
}

export default async function DocumentPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  const res = await fetchServiceOrderDocument(id);
  if (!res.ok) notFound();

  return (
    <div className="doc-viewport">
      <DocumentSheet document={res.document} />
      <PrintBar number={res.document.number} auto={sp.auto === "1"} />
    </div>
  );
}
