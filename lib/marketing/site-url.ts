/**
 * Endereço público do site — fonte única.
 *
 * POR QUE ISTO EXISTE, com o defeito que o motivou. O domínio estava chumbado em
 * seis arquivos (`sitemap.ts`, `robots.ts`, layout de marketing, página de
 * produto, formatador de WhatsApp, recuperação de carrinho) e ALÉM disso vinha
 * de `NEXT_PUBLIC_APP_URL` no feed da Meta. Sete fontes para o mesmo endereço.
 *
 * O resultado, medido no ar em 11/08/2026: `gltech3d.com.br` **não tem registro
 * DNS** (`Resolve-DnsName` devolve "o nome DNS não existe"), e o feed publicado
 * em `/api/v1/public/feed/products.csv` estava entregando **29 links** para esse
 * domínio — todo link de produto e de imagem do catálogo do Instagram, do
 * WhatsApp e do Facebook apontando para o nada.
 *
 * Com uma fonte só, corrigir vira trocar UMA variável de ambiente. Com sete,
 * vira caçar string.
 *
 * LÊ `process.env` DIRETO, sem passar por `lib/env.ts`, de propósito: este
 * módulo é usado em componente de cliente, e `lib/env.ts` valida segredos de
 * servidor. Variável `NEXT_PUBLIC_` é embutida no bundle em tempo de build, então
 * a leitura direta funciona nos dois lados.
 */

/**
 * Usado quando `NEXT_PUBLIC_APP_URL` está ausente ou é local.
 *
 * O domínio da Vercel, não o próprio, porque é o que comprovadamente resolve. Um
 * sitemap com `localhost` seria pior que um sitemap com o domínio errado.
 */
const FALLBACK = "https://gltech3d.vercel.app";

/** Base do site, sem barra no fim. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return FALLBACK;

  // `localhost` vazando para sitemap, feed ou Open Graph publicaria endereço que
  // ninguém fora da máquina do desenvolvedor consegue abrir.
  if (!/^https:\/\//i.test(raw) || /localhost|127\.0\.0\.1/i.test(raw)) return FALLBACK;

  return raw.replace(/\/+$/, "");
}

/** Junta um caminho à base. Aceita caminho já absoluto e o devolve intacto. */
export function absoluteSiteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
