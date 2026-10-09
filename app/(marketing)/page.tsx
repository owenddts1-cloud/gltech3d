import { getFilamentCatalog, getLandingCatalog } from '@/lib/landing/repository';
import { getStoreWhatsapp } from '@/lib/landing/whatsapp';
import { logger } from '@/lib/logger';
import type { PublicFilament } from '@/lib/filament-catalog/types';
import HomeClient from '@/app/(marketing)/_components/HomeClient';

/**
 * The filament section is optional: if its read fails (e.g. a clone without
 * migration 0087), the home still renders without it instead of erroring.
 */
async function filamentsOrEmpty(): Promise<PublicFilament[]> {
  try {
    return await getFilamentCatalog();
  } catch (err) {
    logger.warn('home_filament_catalog_failed', {
      details: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

import { siteUrl } from '@/lib/marketing/site-url';

export default async function Home() {
  const [catalog, filaments, storeWhatsapp] = await Promise.all([
    getLandingCatalog(),
    filamentsOrEmpty(),
    getStoreWhatsapp(),
  ]);

  const baseUrl = siteUrl();
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'GLTech3D',
      url: baseUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${baseUrl}/catalogo?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': `${baseUrl}/#organization`,
      name: 'GLTech3D',
      url: baseUrl,
      description:
        'Manufatura aditiva, prototipagem técnica, catálogo de filamentos e produtos exclusivos em impressão 3D de alta qualidade com acabamento premium.',
      telephone: storeWhatsapp ? `+${storeWhatsapp.replace(/\D/g, '')}` : undefined,
      priceRange: '$$',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'BR',
      },
      sameAs: [
        catalog.settings.links?.instagram,
        catalog.settings.links?.shopee,
        catalog.settings.links?.mercadoLivre,
      ].filter(Boolean),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeClient catalog={catalog} filaments={filaments} storeWhatsapp={storeWhatsapp} />
    </>
  );
}
