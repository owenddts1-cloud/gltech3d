/**
 * Feed público de produtos — formato Meta Commerce Manager.
 *
 * Cole esta URL em Commerce Manager › Catálogo › Fontes de dados › Feed
 * agendado. O MESMO feed alimenta o catálogo do Instagram, do WhatsApp Business
 * e do Facebook.
 *
 * SOBRE SER PÚBLICO E SEM AUTENTICAÇÃO: é a mesma superfície que a vitrine já
 * expõe — nome, foto, preço e link das peças publicadas. A org vem de
 * `env.LANDING_ORG_SLUG` (nunca do request) e os dados saem de
 * `getLandingCatalog()`, cuja lista de colunas é explícita e fechada: gramas,
 * tempo de impressão, insumos e margem não passam por aqui nem por acidente.
 *
 * Cache: `getLandingCatalog` é `unstable_cache` com tag, e o CRM chama
 * `revalidateLanding()` ao gravar — o feed reflete a edição sem redeploy.
 */

import { getLandingCatalog } from "@/lib/landing/repository";
import { buildProductFeed } from "@/lib/landing/feed";
import { env } from "@/lib/env";

export async function GET(): Promise<Response> {
  const catalog = await getLandingCatalog();
  const feed = buildProductFeed(catalog.products, {
    siteUrl: env.NEXT_PUBLIC_APP_URL,
    brand: "GLTech3D",
  });

  return new Response(feed.csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'inline; filename="products.csv"',
      // A Meta busca de tempos em tempos; meia hora de borda evita bater no
      // banco a cada rastreamento sem deixar o catálogo velho.
      "Cache-Control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=3600",
      // Diagnóstico legível sem precisar abrir o CSV: quantas entraram e quantas
      // ficaram de fora por falta de preço ou de foto.
      "X-Feed-Items": String(feed.included),
      "X-Feed-Skipped": String(feed.skipped.length),
    },
  });
}
