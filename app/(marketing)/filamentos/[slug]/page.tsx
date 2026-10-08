import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import ProductGallery from '@/components/marketing/ProductGallery';
import FilamentBuyBox from '@/components/marketing/filaments/FilamentBuyBox';
import { FilamentCard, FilamentMedia } from '@/components/marketing/filaments/FilamentCard';
import { SpoolSwatch } from '@/components/marketing/filaments/FilamentVisuals';
import { getFilamentBySlug, getFilamentCatalog } from '@/lib/landing/repository';
import { getStoreWhatsapp } from '@/lib/landing/whatsapp';
import { formatNetWeight } from '@/lib/filament-catalog/title';
import { siteUrl } from '@/lib/marketing/site-url';
import { SCHEMA_ORG_AVAILABILITY, filamentSpecLine, formatTempRange } from '@/lib/storefront/filaments';

type Params = { params: Promise<{ slug: string }> };

function describe(f: { name: string; description: string; materialName: string | null; diameterMm: number }): string {
  if (f.description.trim()) return f.description.trim().slice(0, 300);
  const material = f.materialName ? `${f.materialName} ` : '';
  return `${f.name}: filamento ${material}${f.diameterMm.toLocaleString('pt-BR')} mm testado na produção da GLTech3D. Pedido pelo WhatsApp, envio para todo o Brasil.`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const f = await getFilamentBySlug(decodeURIComponent(slug));
  if (!f) return { title: 'Filamento não encontrado', robots: { index: false } };
  const canonical = `/filamentos/${encodeURIComponent(f.slug)}`;
  const description = describe(f);
  return {
    title: f.name,
    description,
    alternates: { canonical },
    openGraph: {
      title: f.name,
      description,
      url: canonical,
      images: f.images[0] ? [{ url: f.images[0], alt: f.name }] : undefined,
    },
  };
}

export default async function FilamentPage({ params }: Params) {
  const { slug } = await params;
  const [f, storeWhatsapp, catalog] = await Promise.all([
    getFilamentBySlug(decodeURIComponent(slug)),
    getStoreWhatsapp(),
    getFilamentCatalog(),
  ]);
  if (!f) notFound();

  const url = `${siteUrl()}/filamentos/${encodeURIComponent(f.slug)}`;
  const related = catalog
    .filter((x) => x.id !== f.id && x.materialName === f.materialName)
    .slice(0, 4);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: f.name,
    description: describe(f),
    ...(f.images.length > 0 ? { image: f.images } : {}),
    ...(f.brand ? { brand: { '@type': 'Brand', name: f.brand } } : {}),
    ...(f.materialName ? { material: f.materialName } : {}),
    ...(f.colorName ? { color: f.colorName } : {}),
    category: 'Filamento para impressora 3D',
    ...(f.priceCents != null && f.priceCents > 0
      ? {
          offers: {
            '@type': 'Offer',
            priceCurrency: 'BRL',
            price: (f.priceCents / 100).toFixed(2),
            availability: SCHEMA_ORG_AVAILABILITY[f.availability],
            url,
            seller: { '@type': 'Organization', name: 'GLTech3D' },
          },
        }
      : {}),
  };

  const specs: Array<[string, string | null]> = [
    ['Material', f.materialName],
    ['Linha', f.line],
    ['Marca', f.brand],
    ['Cor', f.colorName],
    ['Diâmetro', `${f.diameterMm.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} mm`],
    ['Peso líquido', formatNetWeight(f.netWeightG)],
    ['Temperatura do bico', formatTempRange(f.nozzleTempMin, f.nozzleTempMax)],
    ['Temperatura da mesa', formatTempRange(f.bedTempMin, f.bedTempMax)],
  ];

  return (
    <main className="min-h-screen bg-[#FAF9F6] pt-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Navbar />

      <div className="mx-auto max-w-7xl px-6 py-10">
        <nav aria-label="Trilha" className="mb-6 text-xs font-semibold text-[#6B5E55]">
          <Link href="/" className="hover:text-[#2B2622]">Início</Link>
          <span className="mx-2 text-[#C8BEB2]">/</span>
          <Link href="/filamentos" className="hover:text-[#2B2622]">Filamentos</Link>
          <span className="mx-2 text-[#C8BEB2]">/</span>
          <span className="text-[#2B2622]">{f.name}</span>
        </nav>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-14">
          {f.images.length > 0 ? (
            <ProductGallery images={f.images} productName={f.name} />
          ) : (
            <div className="group relative aspect-square overflow-hidden rounded-[2.5rem] border border-[#E8E2D9]">
              <FilamentMedia f={f} sizes="hero" />
            </div>
          )}

          <div className="flex flex-col justify-center">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#7A5C3E]">
              {[f.materialName, f.line].filter(Boolean).join(' · ') || 'Filamento'}
            </span>
            <h1 className="mt-2 font-sora text-3xl font-black leading-tight tracking-tight text-[#2B2622] md:text-5xl">
              {f.name}
            </h1>
            <p className="mt-3 flex items-center gap-2 text-sm text-[#6B5E55]">
              <SpoolSwatch hex={f.colorHex} label={f.colorName ?? 'Cor'} size={20} />
              {f.brand ? <span className="font-semibold text-[#4E443C]">{f.brand}</span> : null}
              <span>{filamentSpecLine(f)}</span>
            </p>
            {f.description ? (
              <p className="mt-5 whitespace-pre-line leading-relaxed text-[#4E443C]">{f.description}</p>
            ) : null}

            <div className="mt-7">
              <FilamentBuyBox f={f} storeWhatsapp={storeWhatsapp} />
            </div>

            <section aria-labelledby="ficha" className="mt-8 overflow-hidden rounded-[1.75rem] border border-[#E8E2D9] bg-white">
              <h2 id="ficha" className="border-b border-[#E8E2D9] px-6 py-4 font-sora text-sm font-black uppercase tracking-[0.14em] text-[#2B2622]">
                Ficha técnica
              </h2>
              <dl className="divide-y divide-[#F0EBE3]">
                {specs
                  .filter((row): row is [string, string] => row[1] != null && row[1] !== '')
                  .map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 px-6 py-3 text-sm">
                      <dt className="font-semibold text-[#6B5E55]">{k}</dt>
                      <dd className="font-bold text-[#2B2622]">{v}</dd>
                    </div>
                  ))}
              </dl>
              {f.tdsUrl ? (
                <a
                  href={f.tdsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between border-t border-[#E8E2D9] px-6 py-3.5 text-sm font-bold text-[#7A5C3E] hover:bg-[#F9F7F2]"
                >
                  Ficha técnica do fabricante (TDS)
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </section>

            <Link
              href="/calc3d-pro#calculadora"
              className="mt-5 text-center text-xs font-bold text-[#7A5C3E] underline underline-offset-4 hover:text-[#2B2622]"
            >
              Quanto custa a sua peça com este filamento? Calcule grátis no Calc3D →
            </Link>
          </div>
        </div>

        {related.length > 0 ? (
          <section className="mt-24">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#7A5C3E]">
              Mesmo material
            </span>
            <h2 className="mb-8 mt-2 font-sora text-2xl font-black text-[#2B2622]">Outras cores e linhas</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((r) => (
                <FilamentCard key={r.id} f={r} storeWhatsapp={storeWhatsapp} origem="pagina_filamento_relacionados" />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <Footer whatsapp={storeWhatsapp} />
    </main>
  );
}
