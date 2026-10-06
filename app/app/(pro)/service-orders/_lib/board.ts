import { paginate, type PageSlice } from "@/lib/pagination";

export { paginate, type PageSlice };

export const OS_PAGE_SIZE = 5;

/** Posição real a persistir: offset da página + índice visível na página. */
export function resolveDropPosition(page: number, pageSize: number, index: number): number {
  return (page - 1) * pageSize + index;
}
