/**
 * Feed de produtos no formato do Meta Commerce Manager.
 *
 * POR QUE ISTO EXISTE: o mesmo arquivo alimenta o catálogo do **Instagram**, do
 * **WhatsApp Business** e do **Facebook**. Não há API da Meta envolvida, nem app
 * a aprovar — você cola a URL no painel e a Meta busca sozinha, de tempos em
 * tempos. Três canais, um artefato.
 *
 * Módulo PURO: recebe o catálogo já lido e devolve texto. Sem I/O, para poder
 * ser testado com produtos de mentira sem subir servidor.
 *
 * Especificação dos campos: os obrigatórios da Meta são `id`, `title`,
 * `description`, `availability`, `condition`, `price`, `link`, `image_link` e
 * `brand`. `product_type` é opcional e é onde o nicho entra — é ele que permite
 * navegar o catálogo por categoria no WhatsApp.
 */

import type { LandingProduct } from "@/lib/landing/types";

export const FEED_COLUMNS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "additional_image_link",
  "brand",
  "product_type",
] as const;

export interface FeedOptions {
  /** Base absoluta do site, sem barra no fim. Ex.: `https://gltech3d.com.br`. */
  siteUrl: string;
  /** Marca exibida no anúncio. */
  brand: string;
}

/** Motivo pelo qual uma peça ficou de fora — para o cabeçalho de diagnóstico. */
export type FeedSkipReason = "sem-preco" | "sem-foto";

export interface FeedResult {
  csv: string;
  included: number;
  skipped: Array<{ name: string; reason: FeedSkipReason }>;
}

/** Campo CSV seguro: aspas duplicadas e o campo inteiro entre aspas. */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Texto de uma linha só. Quebra de linha dentro de campo é legal em CSV, mas o
 * validador da Meta reclama com frequência — não vale o risco.
 */
function flatten(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Caminho de `/public` vira URL absoluta; URL já absoluta passa direto. */
export function absoluteUrl(pathOrUrl: string, siteUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = siteUrl.replace(/\/+$/, "");
  // O caminho pode ter espaço ("/images/Porta Celular/..."); a Meta exige URL
  // válida, então cada segmento é codificado — sem codificar as barras.
  const encoded = pathOrUrl
    .split("/")
    .map((segment) => encodeURIComponent(decodeURIComponentSafe(segment)))
    .join("/");
  return `${base}${encoded.startsWith("/") ? "" : "/"}${encoded}`;
}

/** `decodeURIComponent` que não estoura em `%` solto vindo de nome de arquivo. */
function decodeURIComponentSafe(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Disponibilidade honesta.
 *
 * A operação imprime sob demanda: sem peça pronta, o correto é
 * `available for order`, não `in stock`. Anunciar estoque que não existe gera
 * pedido que atrasa — e a Meta penaliza catálogo que não corresponde à entrega.
 */
export function availabilityOf(product: LandingProduct): string {
  return product.stockQty > 0 ? "in stock" : "available for order";
}

/** `44.9` → `"44.90 BRL"` — a Meta exige o código da moeda junto. */
export function formatFeedPrice(price: number): string {
  return `${price.toFixed(2)} BRL`;
}

export function buildProductFeed(
  products: readonly LandingProduct[],
  options: FeedOptions,
): FeedResult {
  const rows: string[] = [FEED_COLUMNS.join(",")];
  const skipped: FeedResult["skipped"] = [];

  for (const product of products) {
    // Peça sem preço vira anúncio "R$ 0,00"; peça sem foto vira anúncio quebrado.
    // Nos dois casos é melhor ficar de fora do que entrar errado.
    if (!(product.price > 0)) {
      skipped.push({ name: product.name, reason: "sem-preco" });
      continue;
    }
    if (product.pendingPhoto || product.images.length === 0) {
      skipped.push({ name: product.name, reason: "sem-foto" });
      continue;
    }

    const link = `${options.siteUrl.replace(/\/+$/, "")}/product/${product.slug}`;
    const [cover, ...rest] = product.images;

    rows.push(
      [
        product.slug,
        flatten(product.name),
        // A Meta exige descrição; cair para o nome é melhor que mandar vazio,
        // que reprova o item inteiro na validação.
        flatten(product.description || product.name),
        availabilityOf(product),
        "new",
        formatFeedPrice(product.price),
        link,
        absoluteUrl(cover!, options.siteUrl),
        // Até 20 imagens extras, separadas por vírgula, no MESMO campo.
        rest.slice(0, 20).map((img) => absoluteUrl(img, options.siteUrl)).join(","),
        options.brand,
        flatten(product.category || ""),
      ]
        .map(csvCell)
        .join(","),
    );
  }

  return { csv: `${rows.join("\n")}\n`, included: rows.length - 1, skipped };
}

/**
 * Catálogo por nicho em texto, para mandar no WhatsApp.
 *
 * O catálogo NATIVO do WhatsApp não é alcançável pelo WAHA — o client só tem
 * `sendText`, sem catálogo, sem lista e sem botões. Isto é o que dá para fazer
 * com o que existe: uma mensagem por nicho, com nome, preço e link da peça.
 */
export function buildNicheCatalogMessages(
  products: readonly LandingProduct[],
  options: FeedOptions,
): Array<{ category: string; text: string }> {
  const byCategory = new Map<string, LandingProduct[]>();
  for (const product of products) {
    if (!(product.price > 0)) continue;
    const key = product.category || "Outros";
    const list = byCategory.get(key) ?? [];
    list.push(product);
    byCategory.set(key, list);
  }

  const base = options.siteUrl.replace(/\/+$/, "");
  return [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([category, items]) => {
      const lines = items
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .map(
          (p) =>
            `• ${p.name} — ${p.priceRange ? `R$ ${p.priceRange}` : `R$ ${p.price.toFixed(2).replace(".", ",")}`}\n  ${base}/product/${p.slug}`,
        );
      return {
        category,
        text: `*${category}* (${items.length})\n\n${lines.join("\n\n")}`,
      };
    });
}
