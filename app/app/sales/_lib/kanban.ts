/**
 * Pure helpers for the Sales Kanban board (stage E2).
 *
 * Framework-free on purpose so ordering and drop-position math are unit-testable
 * without React. Fractional indexing reuses the canonical `midpoint()` from
 * lib/kanban (same strategy as the CRM pipeline board — `board_position` is
 * numeric in the DB, never int).
 */

import { midpoint } from "@/lib/kanban/fractional-indexing";
import type { SaleFulfillment, SaleRow } from "@/lib/sales/config";
import { addDays } from "./view-model";

/** Column order: boardPosition asc, nulls last, then most recent sale first. */
export function sortColumnCards(rows: SaleRow[]): SaleRow[] {
  return [...rows].sort((a, b) => {
    if (a.boardPosition != null && b.boardPosition != null) {
      return a.boardPosition - b.boardPosition;
    }
    if (a.boardPosition != null) return -1;
    if (b.boardPosition != null) return 1;
    return a.soldAt < b.soldAt ? 1 : a.soldAt > b.soldAt ? -1 : 0;
  });
}

/**
 * New fractional boardPosition for dropping card `dragId` at visual `index` of
 * an already-sorted column (the dragged card itself may still be in `cards`).
 * Neighbors without a position count as open edges; a midpoint collision falls
 * back to a timestamp so the move is never lost.
 */
export function computeDropPosition(cards: SaleRow[], dragId: string, index: number): number {
  const dragIdx = cards.findIndex((c) => c.id === dragId);
  const rest = cards.filter((c) => c.id !== dragId);
  // `index` is measured on the rendered list (drag card included): removing a
  // card that sat before the drop slot shifts the slot one position up.
  const shifted = dragIdx >= 0 && dragIdx < index ? index - 1 : index;
  const at = Math.max(0, Math.min(shifted, rest.length));
  const prev = at > 0 ? (rest[at - 1]?.boardPosition ?? null) : null;
  const next = at < rest.length ? (rest[at]?.boardPosition ?? null) : null;
  const position = midpoint(prev, next);
  return Number.isNaN(position) ? Date.now() : position;
}

/** Cards sitting in a non-final stage for more than `days` days (default 7). */
export function staleCount(
  cards: SaleRow[],
  stage: SaleFulfillment,
  today: string,
  days = 7,
): number {
  if (stage === "entregue") return 0;
  const cutoff = addDays(today, -days);
  return cards.filter((c) => c.soldAt < cutoff).length;
}
