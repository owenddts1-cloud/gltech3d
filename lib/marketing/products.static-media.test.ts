import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { products } from "./products";

/**
 * Todo caminho de mídia servido de `/public` tem que existir no disco.
 *
 * REGRESSÃO QUE ISTO TRAVA: o Porta-Celular Astronauta apontava para
 * `/images/Pota Celular/...` — faltava o "r" de "Porta". A pasta real sempre foi
 * `public/images/Porta Celular/`. O typo passou pelo typecheck (é uma string
 * válida), pelo lint e pelo build, foi para o banco pelo seed e só apareceu como
 * imagem quebrada na loja em produção.
 *
 * Nada checava isso. Agora checa a cada `npm run test:unit`.
 */

/** `decodeURI` porque "Porta Celular" pode aparecer percent-encoded. */
function publicPathOf(entry: string): string {
  let decoded: string;
  try {
    decoded = decodeURI(entry);
  } catch {
    decoded = entry;
  }
  return join("public", decoded);
}

describe("catálogo estático — mídia local existe em public/", () => {
  const localEntries = products.flatMap((p) =>
    [p.image, ...p.images, ...(p.videos ?? [])]
      .filter((entry) => entry.startsWith("/"))
      .map((entry) => ({ produto: p.name, entry })),
  );

  it("a varredura encontrou caminhos (senão o teste é vazio)", () => {
    // Sem esta guarda, refatorar o shape do catálogo tornaria o teste verde e
    // inútil ao mesmo tempo.
    expect(localEntries.length).toBeGreaterThan(10);
  });

  it("nenhum caminho aponta para arquivo inexistente", () => {
    const missing = localEntries
      .filter(({ entry }) => !existsSync(publicPathOf(entry)))
      .map(({ produto, entry }) => `${produto}: ${entry}`);
    expect(missing, `caminhos quebrados:\n${missing.join("\n")}`).toEqual([]);
  });

  it("o placeholder de foto pendente existe", () => {
    // `/images/placeholder-model.svg` é referenciado por dois módulos como
    // constante solta; se sumir, toda peça sem foto quebra de uma vez.
    expect(existsSync(join("public", "images", "placeholder-model.svg"))).toBe(true);
  });
});

describe("catálogo estático — integridade", () => {
  it("nenhum slug colide (o seed aborta se colidir)", async () => {
    const { slugify } = await import("@/lib/utils/slug");
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const p of products) {
      const slug = slugify(p.name);
      const previous = seen.get(slug);
      if (previous) clashes.push(`"${slug}": ${previous} e ${p.name}`);
      seen.set(slug, p.name);
    }
    expect(clashes).toEqual([]);
  });

  it("peça marcada como pendingPhoto não tem galeria", () => {
    // `pendingPhoto` vira `images.length === 0` no banco; ter as duas coisas
    // gravaria uma peça que se diz sem foto mas exibe foto.
    const inconsistent = products
      .filter((p) => p.pendingPhoto && p.images.length > 0)
      .map((p) => p.name);
    expect(inconsistent).toEqual([]);
  });

  it("todo produto tem nome e categoria", () => {
    const broken = products
      .filter((p) => !p.name.trim() || !p.category.trim())
      .map((p) => p.id);
    expect(broken).toEqual([]);
  });
});
