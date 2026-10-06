/**
 * Pure helpers for the Timeline view (stage E3).
 *
 * Framework-free on purpose (same doctrine as view-model.ts): day grouping and
 * relative-day labels are unit-testable without React. All date math happens on
 * YYYY-MM-DD strings compared lexicographically.
 */

import type { SaleRow } from "@/lib/sales/config";
import { addDays } from "./view-model";

export interface DayGroup {
  /** YYYY-MM-DD of the group. */
  date: string;
  /** Sales sold on that day, in the relative order they arrived. */
  rows: SaleRow[];
}

/** Deterministic pt-BR month abbreviations (locale-independent → testable). */
const MONTH_ABBR = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

/** "Hoje" / "Ontem" / "18 jul 2026" for a day heading. */
export function dayLabel(iso: string, today: string): string {
  if (iso === today) return "Hoje";
  if (iso === addDays(today, -1)) return "Ontem";
  const [y = "", m = "", d = ""] = iso.split("-");
  const month = MONTH_ABBR[Number(m) - 1] ?? m;
  return `${Number(d)} ${month} ${y}`;
}

/**
 * Groups sales by soldAt day, newest day first. Rows have no time-of-day, so
 * within a day the incoming relative order is preserved (stable sort).
 */
export function groupByDay(rows: SaleRow[]): DayGroup[] {
  const sorted = [...rows].sort((a, b) =>
    a.soldAt < b.soldAt ? 1 : a.soldAt > b.soldAt ? -1 : 0,
  );
  const groups: DayGroup[] = [];
  for (const row of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === row.soldAt) {
      last.rows.push(row);
    } else {
      groups.push({ date: row.soldAt, rows: [row] });
    }
  }
  return groups;
}
