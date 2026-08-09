/**
 * Casamento pasta-de-mídia → peça do catálogo.
 *
 * Módulo PURO (sem I/O), para o importador em lote poder ser testado com os
 * nomes de pasta reais em vez de com o banco.
 *
 * O PROBLEMA: as pastas existentes são nomeadas pelo apelido da peça
 * (`Batman`, `Lua Cheia`, `Astronauta`), enquanto o slug é o nome completo
 * (`batman-action-figure`, `luminaria-lua-cheia-alta-qualidade`,
 * `porta-celular-astronauta`). Exigir igualdade exata deixava 5 de 10 pastas
 * sem casar.
 *
 * A REGRA, em ordem:
 *   1. igualdade exata com o slug, ou com o slug derivado do nome;
 *   2. os tokens da pasta aparecendo como sequência CONTÍGUA nos tokens da peça
 *      (ou vice-versa) — e apenas se houver UM único candidato.
 *
 * Casar por token contíguo, e não por substring solta, evita o falso positivo
 * clássico: "ana" não casa com "banana". E a exigência de unicidade preserva a
 * doutrina do importador — na dúvida ele reporta, não adivinha.
 */

import { slugify } from "@/lib/utils/slug";

export interface MatchableProduct {
  id: string;
  slug: string | null;
  name: string;
}

export type MediaMatch =
  | { kind: "exact"; product: MatchableProduct }
  | { kind: "contained"; product: MatchableProduct }
  | { kind: "none" }
  | { kind: "ambiguous"; candidates: MatchableProduct[] };

const tokens = (slug: string): string[] => slug.split("-").filter(Boolean);

/** `["lua","cheia"]` aparece em `["luminaria","lua","cheia","alta"]`? */
function hasContiguous(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let all = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        all = false;
        break;
      }
    }
    if (all) return true;
  }
  return false;
}

/** Slug efetivo da peça: o gravado, ou o derivado do nome. */
export function effectiveSlug(product: MatchableProduct): string {
  return product.slug ?? slugify(product.name);
}

/**
 * Resolve uma pasta para uma peça. `folderName` é o nome cru da pasta
 * ("Lua Cheia", "Action Figure/Batman" já quebrado pelo chamador).
 */
export function matchProductByFolder(
  folderName: string,
  products: readonly MatchableProduct[],
): MediaMatch {
  const key = slugify(folderName);
  if (!key) return { kind: "none" };

  const exact = products.find((p) => p.slug === key || slugify(p.name) === key);
  if (exact) return { kind: "exact", product: exact };

  const needle = tokens(key);
  const contained = products.filter((p) => {
    const hay = tokens(effectiveSlug(p));
    return hasContiguous(hay, needle) || hasContiguous(needle, hay);
  });

  if (contained.length === 1) return { kind: "contained", product: contained[0]! };
  if (contained.length > 1) return { kind: "ambiguous", candidates: contained };
  return { kind: "none" };
}

/** Distância de edição — só para sugerir "você quis dizer X?" em pasta órfã. */
export function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i]![j] = Math.min(
        rows[i - 1]![j]! + 1,
        rows[i]![j - 1]! + 1,
        rows[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return rows[a.length]![b.length]!;
}

/**
 * Os N slugs mais próximos, para a mensagem de pasta órfã.
 *
 * A distância é o MENOR valor entre comparar com o slug inteiro e comparar com
 * cada token dele. Sem isso, comparar só com o slug inteiro premia slug curto:
 * "Batmam" ficava mais perto de `chibi-naruto` (12 chars) do que de
 * `batman-action-figure` (20), e a sugestão saía inútil justamente no caso em
 * que ela existe para ajudar — o apelido da peça.
 */
export function nearestSlugs(
  folderName: string,
  products: readonly MatchableProduct[],
  limit = 3,
): string[] {
  const key = slugify(folderName);
  const distanceTo = (slug: string): number =>
    Math.min(editDistance(key, slug), ...tokens(slug).map((t) => editDistance(key, t)));

  return products
    .map((p) => ({ slug: effectiveSlug(p), distance: distanceTo(effectiveSlug(p)) }))
    .sort((a, b) => a.distance - b.distance || a.slug.localeCompare(b.slug))
    .slice(0, limit)
    .map((c) => c.slug);
}
