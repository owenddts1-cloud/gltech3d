import type { Metadata } from 'next';
import { getLandingCatalog } from '@/lib/landing/repository';
import { ProdutosClient } from './ProdutosClient';
import { siteUrl } from '@/lib/marketing/site-url';

export const metadata: Metadata = {
  title: 'Catálogo de Modelos 3D & Peças Personalizadas',
  description:
    'Explore todo o catálogo de peças, colecionáveis, itens decorativos e modelos 3D exclusivos da GLTech3D com acabamento premium e envio para todo o Brasil.',
  alternates: { canonical: '/produtos' },
  openGraph: {
    title: 'Catálogo de Modelos 3D & Peças Personalizadas | GLTech3D',
    description:
      'Catálogo completo de impressões 3D sob demanda da GLTech3D. Filtros por nicho, busca em tempo real e orçamentos.',
    url: `${siteUrl()}/produtos`,
    type: 'website',
  },
};

export const dynamic = 'force-dynamic';

export default async function ProdutosPage() {
  const catalog = await getLandingCatalog();

  return <ProdutosClient products={catalog.products} />;
}
