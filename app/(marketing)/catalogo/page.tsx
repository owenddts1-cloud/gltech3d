import Link from "next/link";
import { getLandingCatalog } from "@/lib/landing/repository";
import WhatsAppFloat from "@/components/marketing/WhatsAppFloat";
import { PublicCatalogClient } from "./PublicCatalogClient";

export const metadata = {
  title: "Catálogo de Produtos 3D — GLTECH3D",
  description: "Explore o catálogo completo de peças e produtos impressos em 3D da GLTECH3D. Envio para todo o Brasil.",
};
export const dynamic = "force-dynamic";

export default async function PublicCatalogPage() {
  const catalog = await getLandingCatalog();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-amber-500 selection:text-slate-950">
      {/* Header Público */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-amber-400">
            <span>GLTECH3D</span>
            <span className="rounded bg-amber-400/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
              CATÁLOGO
            </span>
          </Link>
          <div className="flex items-center gap-4 text-xs text-slate-300">
            <Link href="/" className="hover:text-amber-400 transition-colors">
              Início
            </Link>
            <a
              href="https://wa.me/5531999284834?text=Olá!%20Gostaria%20de%20tirar%20uma%20dúvida%20sobre%20o%20catálogo"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-green-600 px-3.5 py-1.5 font-medium text-white hover:bg-green-500 transition-colors"
            >
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10 text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-100">
            Catálogo Oficial de Peças <span className="text-amber-400">GLTECH3D</span>
          </h1>
          <p className="max-w-2xl mx-auto text-sm text-slate-400">
            Peças exclusivas e colecionáveis feitas em impressão 3D de alta precisão. Selecione os itens de seu interesse e solicite um orçamento direto pelo WhatsApp.
          </p>
        </div>

        <PublicCatalogClient catalog={catalog} />
      </main>

      {/* Footer Público */}
      <footer className="border-t border-slate-800 bg-slate-900/40 py-8 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} GLTECH3D · Todos os direitos reservados. Envio para todo o Brasil.</p>
      </footer>

      <WhatsAppFloat />
    </div>
  );
}
