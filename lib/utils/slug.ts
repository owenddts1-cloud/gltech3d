/**
 * Slug de URL a partir de texto livre.
 *
 * Vive em `lib/` e não em `scripts/` porque tem dois consumidores com regras
 * idênticas: `scripts/seed-landing-catalog.ts` (importação em lote) e
 * `createProduct` (produto criado no CRM, que sem slug caía no fallback
 * `slug ?? id` de `lib/landing/repository.ts` e virava um UUID na URL pública).
 *
 * O limite de 60 caracteres espelha a coluna `products.slug` e o Zod.
 */

/** `"Luminária Lua Cheia - Alta"` → `"luminaria-lua-cheia-alta"` */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira os diacriticos separados pelo NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, ""); // o slice pode ter deixado um hífen solto no fim
}

/**
 * Variante numerada para resolver colisão: `("lua-cheia", 2)` → `"lua-cheia-2"`.
 *
 * O sufixo entra ANTES do corte, não depois, senão um slug já com 60 caracteres
 * perderia justamente o número que o torna único.
 */
export function slugifyWithSuffix(input: string, attempt: number): string {
  if (attempt <= 1) return slugify(input);
  const suffix = `-${attempt}`;
  return `${slugify(input).slice(0, 60 - suffix.length).replace(/-+$/g, "")}${suffix}`;
}
