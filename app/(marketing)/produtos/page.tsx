import type { Metadata } from 'next';
import { getLandingCatalog } from '@/lib/landing/repository';
import { ProdutosClient } from './ProdutosClient';
import { siteUrl } from '@/lib/marketing/site-url';

export const metadata: Metadata = {
  title: 'Catálogo de Modelos 3D & Peças Personalizadas',
  description:
    'Explore todo o catálogo de peças, colecionáveis, itens decorativos e modelos 3D exclusivos da GLTech3D com acabamento premium e envio para todo o Brasil.',
  alternates: { canonical: '/produtos' },
  keywords: [
    'impressão 3D sob demanda',
    'modelos 3D',
    'peças personalizadas 3D',
    'catálogo 3D',
    'action figures',
    'decoração 3D',
    'prototipagem rápida',
  ],
  openGraph: {
    title: 'Catálogo de Modelos 3D & Peças Personalizadas | GLTech3D',
    description:
      'Catálogo completo de impressões 3D sob demanda da GLTech3D. Filtros por nicho, busca em tempo real e orçamentos.',
    url: `${siteUrl()}/produtos`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Catálogo de Modelos 3D & Peças Personalizadas | GLTech3D',
    description: 'Explore todo o catálogo de peças e modelos 3D exclusivos da GLTech3D.',
  },
};

export const dynamic = 'force-dynamic';

export default async function ProdutosPage() {
  const catalog = await getLandingCatalog();

  return <ProdutosClient products={catalog.products} />;
}
