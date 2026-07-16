import { getLandingCatalog } from '@/lib/landing/repository';
import HomeClient from '@/app/(marketing)/_components/HomeClient';

/**
 * Server Component: o catálogo vem do Postgres (migration 0041), não mais do
 * arquivo estático. A leitura é cacheada por tag; o Landing Edit invalida a tag
 * ao gravar, e a mudança vai ao ar sem redeploy.
 */
export default async function Home() {
  const catalog = await getLandingCatalog();
  return <HomeClient catalog={catalog} />;
}
