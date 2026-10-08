import type { MetadataRoute } from 'next';
import { getFilamentCatalog, getLandingCatalog } from '@/lib/landing/repository';
import { logger } from '@/lib/logger';
import type { LandingProduct } from '@/lib/landing/types';
import { siteUrl } from '@/lib/marketing/site-url';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/orcamento`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/calc3d-pro`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/filamentos`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/catalogo`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/criar-conta`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/tecnologias`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacidade`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/termos`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // Each list is independent: a failure in one (e.g. a clone without migration
  // 0087) must not drop the other from the sitemap.
  const [productRoutes, filamentRoutes] = await Promise.all([
    getLandingCatalog()
      .then((catalog): MetadataRoute.Sitemap =>
        catalog.products.map((p: LandingProduct) => ({
          url: `${baseUrl}/product/${p.slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        })),
      )
      .catch((err: unknown): MetadataRoute.Sitemap => {
        logger.warn('sitemap_products_failed', { details: err instanceof Error ? err.message : String(err) });
        return [];
      }),
    getFilamentCatalog()
      .then((filaments): MetadataRoute.Sitemap =>
        filaments.map((f) => ({
          url: `${baseUrl}/filamentos/${encodeURIComponent(f.slug)}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.7,
        })),
      )
      .catch((err: unknown): MetadataRoute.Sitemap => {
        logger.warn('sitemap_filaments_failed', { details: err instanceof Error ? err.message : String(err) });
        return [];
      }),
  ]);
  return [...staticRoutes, ...productRoutes, ...filamentRoutes];
}
