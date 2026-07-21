/** Paginação numerada, pura e sem I/O — compartilhada entre Dashboard e Service Orders. */

export interface PageSlice<T> {
  items: T[];
  page: number;
  totalPages: number;
}

/** Fatia a lista para a página pedida (1-based), clampando fora do intervalo. */
export function paginate<T>(list: T[], page: number, perPage: number = 5): PageSlice<T> {
  const totalPages = Math.max(1, Math.ceil(list.length / perPage));
  const safe = Math.min(Math.max(1, page), totalPages);
  return { items: list.slice((safe - 1) * perPage, safe * perPage), page: safe, totalPages };
}
