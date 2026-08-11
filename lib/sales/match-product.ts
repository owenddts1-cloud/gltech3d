/**
 * Sugestão de produto para uma venda antiga, por semelhança de nome.
 *
 * O PROBLEMA. Nenhuma das 26 vendas do histórico tem `product_id`. Sem esse
 * vínculo o gatilho da migration 0072 não tem o que contar: `sold_qty` fica em
 * zero para todas as peças, o "ranking de mais vendidos" vira curadoria manual, e
 * o COGS por venda não existe — que é de onde vem a margem de 95,5% da tela de
 * Vendas.
 *
 * Vincular 26 vendas à mão é chato o suficiente para não ser feito. A sugestão
 * automática existe para transformar isso em conferir e confirmar.
 *
 * NÃO VINCULA SOZINHA, de propósito. A função pontua e ordena; quem decide é o
 * operador. Vínculo errado é PIOR que vínculo ausente: contamina `sold_qty` e o
 * custo de uma peça que não foi vendida, e o erro fica invisível.
 *
 * Módulo puro e testado — a heurística é o tipo de coisa que se acha errada só
 * com caso de borda na mão.
 */

/** Tira acento, pontuação e caixa. "Luminária Lua Cheia!" → "luminaria lua cheia". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Palavras que não distinguem nada neste catálogo.
 *
 * Sem isto, "Kit Vasos" casa com "Kit Ímãs" por causa do "kit", e a sugestão
 * fica pior que nenhuma.
 */
const VAZIAS = new Set([
  "de", "da", "do", "com", "para", "e", "a", "o", "em", "kit", "un", "und",
  "peca", "pecas", "3d", "impressao", "alta", "qualidade",
]);

function tokens(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length >= 3 && !VAZIAS.has(t));
}

export interface ProductCandidate {
  id: string;
  name: string;
}

export interface ProductSuggestion {
  productId: string;
  productName: string;
  /** 0 a 1. Fração dos termos da venda que aparecem no nome da peça. */
  score: number;
}

/**
 * Ordena os produtos por semelhança com o texto da venda.
 *
 * A pontuação é a fração dos termos DA VENDA cobertos pelo nome da peça, com
 * bônus para termo que aparece inteiro. Dividir pelos termos da venda (e não
 * pelos da peça) evita que um nome de peça muito longo seja penalizado: "Vaso"
 * na venda deve casar com "Vaso Geométrico Moderno Grande".
 */
export function suggestProducts(
  saleText: string,
  products: readonly ProductCandidate[],
  limit = 3,
): ProductSuggestion[] {
  const alvo = tokens(saleText);
  if (alvo.length === 0) return [];

  const pontuados = products.map((p) => {
    const nome = normalize(p.name);
    const doProduto = new Set(tokens(p.name));

    let acertos = 0;
    for (const t of alvo) {
      if (doProduto.has(t)) acertos += 1;
      // Casamento parcial vale menos: "lumin" dentro de "luminaria" ajuda, mas
      // não pode valer o mesmo que a palavra inteira.
      else if (nome.includes(t)) acertos += 0.5;
    }

    return {
      productId: p.id,
      productName: p.name,
      score: Math.min(1, acertos / alvo.length),
    };
  });

  return pontuados
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.productName.localeCompare(b.productName))
    .slice(0, limit);
}

/**
 * Confiança suficiente para marcar previamente na tela.
 *
 * 0,6 é deliberadamente alto: marcar errado por padrão faz o operador confirmar
 * no automático, e aí o vínculo ruim entra sem ninguém ter olhado.
 */
export const LIMIAR_SUGESTAO = 0.6;

export function isConfident(s: ProductSuggestion): boolean {
  return s.score >= LIMIAR_SUGESTAO;
}
