/**
 * Ordenação das peças na vitrine — lógica pura.
 *
 * Fica separada da UI porque é aritmética de índice fracionário, e errar aqui
 * embaralha a loja em silêncio. Testável sem montar um `DragDropContext`, no
 * mesmo espírito de `app/app/sales/_lib/kanban.ts`.
 *
 * `products.sort_order` é `numeric` justamente para permitir índice fracionário:
 * arrastar uma peça grava UMA linha, não renumera a lista inteira. Reusa
 * `midpoint()` de `lib/kanban/fractional-indexing.ts`, o mesmo do kanban.
 */

import { midpoint } from "@/lib/kanban/fractional-indexing";

const STEP = 1000;

export interface OrderableProduct {
  id: string;
  sortOrder: number | null;
}

export interface ReorderResult<T extends OrderableProduct> {
  /** Lista já na ordem nova, com os `sortOrder` atualizados. */
  items: T[];
  /** Só o que precisa ir ao banco. Um item no caso normal. */
  writes: Array<{ id: string; sortOrder: number }>;
}

/**
 * Ordem de exibição: `sort_order` crescente, nulos por último — o mesmo critério
 * de `lib/landing/repository.ts` e `buildDraftCatalog`. Empate desempata por id
 * para a ordem ser estável entre renders.
 */
export function sortForDisplay<T extends OrderableProduct>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.sortOrder == null && b.sortOrder == null) return a.id.localeCompare(b.id);
    if (a.sortOrder == null) return 1;
    if (b.sortOrder == null) return -1;
    if (a.sortOrder === b.sortOrder) return a.id.localeCompare(b.id);
    return a.sortOrder - b.sortOrder;
  });
}

/** Renumera tudo em múltiplos de STEP. Usado quando o fracionário se esgota. */
function rebalance<T extends OrderableProduct>(ordered: readonly T[]): ReorderResult<T> {
  const items = ordered.map((item, index) => ({ ...item, sortOrder: (index + 1) * STEP }));
  return {
    items,
    writes: items.map((item) => ({ id: item.id, sortOrder: item.sortOrder })),
  };
}

/**
 * Move o item de `from` para `to` na lista JÁ ordenada para exibição.
 *
 * Devolve a lista nova e apenas as gravações necessárias — normalmente uma só.
 * Cai para renumeração completa quando os vizinhos não deixam espaço: ou porque
 * têm o mesmo valor (`midpoint` devolve `NaN`), ou porque algum vizinho ainda
 * está nulo, ou porque a precisão decimal estourou depois de muitos arrastes no
 * mesmo ponto.
 */
export function reorder<T extends OrderableProduct>(
  ordered: readonly T[],
  from: number,
  to: number,
): ReorderResult<T> {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= ordered.length ||
    to >= ordered.length
  ) {
    return { items: [...ordered], writes: [] };
  }

  const next = [...ordered];
  const [moved] = next.splice(from, 1);
  if (!moved) return { items: [...ordered], writes: [] };
  next.splice(to, 0, moved);

  const before = next[to - 1] ?? null;
  const after = next[to + 1] ?? null;
  const position = midpoint(before?.sortOrder ?? null, after?.sortOrder ?? null);

  const items = next.map((item) =>
    item.id === moved.id ? { ...item, sortOrder: position } : item,
  );

  /**
   * A gravação de uma linha só vale se a lista inteira ficar ESTRITAMENTE
   * crescente e sem nulos — aí a ordem visual é reproduzível a partir do banco.
   *
   * Checar só os vizinhos do item movido não basta: duplicatas em qualquer outro
   * ponto (herdadas de um seed, ou de uma renumeração anterior interrompida)
   * sobrevivem à checagem local e deixam a ordem dependente do desempate por id.
   * Esta verificação global cobre de uma vez o `NaN` de vizinhos iguais, o
   * vizinho ainda nulo e o esgotamento de precisão do float.
   */
  if (isStrictlyIncreasing(items)) {
    return { items, writes: [{ id: moved.id, sortOrder: position }] };
  }
  return rebalance(next);
}

function isStrictlyIncreasing(items: readonly OrderableProduct[]): boolean {
  let previous = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    const value = item.sortOrder;
    if (value == null || !Number.isFinite(value) || value <= previous) return false;
    previous = value;
  }
  return true;
}
