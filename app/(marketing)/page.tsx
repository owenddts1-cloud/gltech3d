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

/**
 * Server Component: o catálogo vem do Postgres (migration 0041), não mais do
 * arquivo estático. A leitura é cacheada por tag; o Landing Edit invalida a tag
 * ao gravar, e a mudança vai ao ar sem redeploy.
 */
export default async function Home() {
  const [catalog, filaments, storeWhatsapp] = await Promise.all([
    getLandingCatalog(),
    filamentsOrEmpty(),
    getStoreWhatsapp(),
  ]);
  return <HomeClient catalog={catalog} filaments={filaments} storeWhatsapp={storeWhatsapp} />;
}
