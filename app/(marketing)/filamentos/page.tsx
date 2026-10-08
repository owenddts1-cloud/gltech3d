import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import FilamentCatalogClient from '@/components/marketing/filaments/FilamentCatalogClient';
import { SpoolSwatch } from '@/components/marketing/filaments/FilamentVisuals';
import { getFilamentCatalog } from '@/lib/landing/repository';
import { getStoreWhatsapp } from '@/lib/landing/whatsapp';
import { storeWhatsappUrl } from '@/lib/landing/whatsapp-number';
import { filamentFilterOptions } from '@/lib/storefront/filaments';
import { siteUrl } from '@/lib/marketing/site-url';

/** Raw title: the (marketing) layout template appends "| GLTech3D". */
export const metadata: Metadata = {
  title: 'Filamento para Impressora 3D: PLA, PETG, TPU e PLA+',
  description:
    'Filamentos testados na nossa produção: PLA, PETG, TPU e PLA+ em várias cores, com ficha técnica e temperaturas. Monte o carrinho e finalize pelo WhatsApp.',
  alternates: { canonical: '/filamentos' },
  keywords: [
    'filamentos para impressora 3D',
    'comprar filamento 3D',
    'filamento PLA',
    'filamento PETG',
    'filamento TPU flexivel',
    'bobina de filamento',
    'GLTech3D',
  ],
  openGraph: {
    title: 'Filamento para Impressora 3D: PLA, PETG, TPU | GLTech3D',
    description:
      'Filamentos de alta precisão testados na nossa oficina de impressão 3D. Qualidade industrial e envio para todo o Brasil.',
    url: `${siteUrl()}/filamentos`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Filamentos Técnicos para Impressão 3D | GLTech3D',
    description: 'Catálogo de filamentos testados em produção: PLA, PETG, TPU e mais.',
  },
  robots: { index: true, follow: true },
};

export default async function FilamentosPage() {
  const [filaments, storeWhatsapp] = await Promise.all([getFilamentCatalog(), getStoreWhatsapp()]);
  const { materials, colors } = filamentFilterOptions(filaments);
  const swatches = filaments.filter((f) => f.colorHex).slice(0, 7);

  return (
    <main className="min-h-screen bg-[#FAF9F6] pt-24">
      <Navbar />

      <section className="relative overflow-hidden px-6 pb-10 pt-12 md:pt-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: 'radial-gradient(50% 70% at 90% 10%, rgba(166,129,92,0.16) 0%, transparent 70%)' }}
        />
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.3fr_1fr] md:items-end">
          <div>
            <nav aria-label="Trilha" className="mb-4 text-xs font-semibold text-[#6B5E55]">
              <Link href="/" className="hover:text-[#2B2622]">Início</Link>
              <span className="mx-2 text-[#C8BEB2]">/</span>
              <span className="text-[#2B2622]">Filamentos</span>
            </nav>
            <h1 className="font-sora text-4xl font-black leading-[1.02] tracking-tight text-[#2B2622] md:text-6xl">
              Filamentos que já
              <br />
              <em className="font-serif font-normal italic text-[#8E6D4D]">passaram no nosso teste.</em>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#6B5E55]">
              Cada rolo daqui roda nas impressoras da GLTech3D antes de entrar no catálogo. Escolha cor e material,
              monte o carrinho e finalize pelo WhatsApp — a loja confirma estoque, frete e pagamento por lá.
            </p>
          </div>

          <div className="rounded-[2rem] border border-[#E8E2D9] bg-white p-6 shadow-[0_24px_60px_-30px_rgba(43,38,34,0.35)]">
            <div className="flex -space-x-3">
              {swatches.map((f) => (
                <SpoolSwatch key={f.id} hex={f.colorHex} label={f.colorName ?? f.name} size={44} />
              ))}
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7A5C3E]">Itens</dt>
                <dd className="font-sora text-2xl font-black text-[#2B2622]">{filaments.length}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7A5C3E]">Materiais</dt>
                <dd className="font-sora text-2xl font-black text-[#2B2622]">{materials.length}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7A5C3E]">Cores</dt>
                <dd className="font-sora text-2xl font-black text-[#2B2622]">{colors.length}</dd>
              </div>
            </dl>
            <a
              href={storeWhatsappUrl(storeWhatsapp, 'Olá! Tenho uma dúvida sobre os filamentos do site.')}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 block text-center text-xs font-bold text-[#7A5C3E] underline underline-offset-4 hover:text-[#2B2622]"
            >
              Compra para farm? Peça a tabela de atacado no WhatsApp
            </a>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto max-w-7xl">
          {filaments.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#D5CBBF] bg-white/60 px-6 py-20 text-center">
              <p className="font-sora text-xl font-black text-[#2B2622]">O catálogo de filamentos está sendo montado.</p>
              <p className="mt-2 text-sm text-[#6B5E55]">Enquanto isso, pergunte as cores disponíveis pelo WhatsApp.</p>
            </div>
          ) : (
            <FilamentCatalogClient filaments={filaments} storeWhatsapp={storeWhatsapp} />
          )}
        </div>
      </section>

      <Footer whatsapp={storeWhatsapp} />
    </main>
  );
}
