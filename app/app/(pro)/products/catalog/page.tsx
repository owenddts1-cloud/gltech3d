import Link from "next/link";
import { ArrowLeft, BookOpenText } from "@phosphor-icons/react/dist/ssr";

import { fetchCatalogProducts } from "@/app/actions/catalog/actions";
import { CatalogEditorClient } from "./_components/CatalogEditorClient";

export const metadata = { title: "Editor de Catálogos — GLTECH CRM" };
export const dynamic = "force-dynamic";

export default async function CatalogEditorPage() {
  const result = await fetchCatalogProducts();

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/app/products" className="hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Produtos
            </Link>
            <span>/</span>
            <span>Editor de Catálogo</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BookOpenText className="h-6 w-6 text-amber-500" />
            Editor & Gerador de Catálogos Visuais
          </h1>
          <p className="text-xs text-muted-foreground">
            Monte catálogos em PDF, alterne tabelas de preços (Varejo/Atacado) e copie vitrines para o WhatsApp.
          </p>
        </div>
      </header>

      {!result.ok ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Erro ao carregar produtos: {result.error}
        </div>
      ) : (
        <CatalogEditorClient
          initialProducts={result.products}
          categories={result.categories}
        />
      )}
    </div>
  );
}
