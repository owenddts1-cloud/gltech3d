/**
 * Lógica PURA da seção de O.S. do Dashboard (abas Em andamento / Atrasadas /
 * Concluídas + paginação numerada). Sem I/O e sem React — testável isolada.
 *
 * Regras de classificação (automáticas, por status + prazo):
 *  - concluída  → status === 'concluido'
 *  - atrasada   → NÃO concluída e sla_due_at < agora
 *  - andamento  → NÃO concluída e não atrasada
 */

import type { OrderOverviewRow } from "@/app/actions/dashboard/analytics";
export { paginate, type PageSlice } from "@/lib/pagination";

export type OrdersTab = "andamento" | "atrasadas" | "concluidas";

export const ORDERS_PER_PAGE = 5;

export interface OrderBuckets {
  andamento: OrderOverviewRow[];
  atrasadas: OrderOverviewRow[];
  concluidas: OrderOverviewRow[];
}

const time = (iso: string | null): number => (iso ? new Date(iso).getTime() : Number.NaN);

/** Classifica e ordena: atrasadas (mais vencida primeiro), andamento (prazo mais
 *  próximo primeiro, sem prazo por último), concluídas (mais recente primeiro). */
export function bucketOrders(rows: OrderOverviewRow[], now: Date): OrderBuckets {
  const nowMs = now.getTime();
  const andamento: OrderOverviewRow[] = [];
  const atrasadas: OrderOverviewRow[] = [];
  const concluidas: OrderOverviewRow[] = [];

  for (const r of rows) {
    if (r.status === "concluido") {
      concluidas.push(r);
    } else if (r.slaDueAt !== null && time(r.slaDueAt) < nowMs) {
      atrasadas.push(r);
    } else {
      andamento.push(r);
    }
  }

  atrasadas.sort((a, b) => time(a.slaDueAt) - time(b.slaDueAt));
  andamento.sort((a, b) => {
    const da = a.slaDueAt ? time(a.slaDueAt) : Infinity;
    const db = b.slaDueAt ? time(b.slaDueAt) : Infinity;
    if (da !== db) return da - db;
    return time(b.createdAt) - time(a.createdAt);
  });
  concluidas.sort(
    (a, b) => time(b.concludedAt ?? b.createdAt) - time(a.concludedAt ?? a.createdAt),
  );

  return { andamento, atrasadas, concluidas };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Rótulo relativo do prazo: "3d atrasada" (danger) · "vence hoje"/"vence em 2d"
 * (warning se ≤3d, senão neutro) · null sem prazo.
 */
export function slaLabel(
  slaDueAt: string | null,
  now: Date,
): { text: string; tone: "danger" | "warning" | "neutral" } | null {
  if (!slaDueAt) return null;
  const diff = time(slaDueAt) - now.getTime();
  if (Number.isNaN(diff)) return null;
  if (diff < 0) {
    const days = Math.max(1, Math.floor(-diff / DAY_MS));
    return { text: `${days}d atrasada`, tone: "danger" };
  }
  const days = Math.floor(diff / DAY_MS);
  if (days === 0) return { text: "vence hoje", tone: "warning" };
  return { text: `vence em ${days}d`, tone: days <= 3 ? "warning" : "neutral" };
}
