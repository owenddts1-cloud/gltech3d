"use client";

/**
 * Sales Kanban (stage E2) — real drag-and-drop production board.
 *
 * Native HTML5 DnD (draggable + onDragOver/onDrop, no deps). One column per
 * KANBAN_STAGES entry; moving a card sets its fulfillmentStatus and a fractional
 * boardPosition (midpoint between neighbors — same strategy as the CRM board).
 * The parent's `sales` state stays the source of truth: the board patches it
 * optimistically via `onPatch`, persists with `updateSale`, and rolls back on
 * failure. Keyboard: ←/→ move a focused card to the adjacent stage.
 */

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { updateSale } from "@/app/actions/sales/actions";
import { Badge } from "@/components/ui/badge";
import { Warning } from "@/lib/ui/icons";
import {
  FULFILLMENT_LABEL,
  KANBAN_STAGES,
  PAYMENT_LABEL,
  type SaleFulfillment,
  type SalePayment,
  type SaleRow,
} from "@/lib/sales/config";
import { brl, dateBR, orderCode, todayIso } from "../_lib/view-model";
import { computeDropPosition, sortColumnCards, staleCount } from "../_lib/kanban";

interface Props {
  rows: SaleRow[];
  /** Applies a partial patch to one sale in the parent state (optimistic move + rollback). */
  onPatch: (id: string, patch: Partial<SaleRow>) => void;
  /** Opens the sale detail drawer (E3). */
  onOpenSale: (id: string) => void;
}

/** Stage accent dot — quick visual scan of the production flow. */
const STAGE_DOT: Record<SaleFulfillment, string> = {
  confirmada: "bg-sky-500",
  produzindo: "bg-amber-500",
  pronta: "bg-violet-500",
  enviada: "bg-cyan-500",
  entregue: "bg-emerald-500",
  cancelada: "bg-zinc-500",
};

const PAYMENT_VARIANT: Record<SalePayment, "success" | "warning" | "error"> = {
  pago: "success",
  pendente: "warning",
  estornado: "error",
};

interface DropTarget {
  stage: SaleFulfillment;
  index: number;
}

export default function SalesKanbanView({ rows, onPatch, onOpenSale }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const today = useMemo(() => todayIso(), []);

  const byStage = useMemo(() => {
    const map = new Map<SaleFulfillment, SaleRow[]>();
    for (const stage of KANBAN_STAGES) {
      map.set(
        stage,
        sortColumnCards(rows.filter((r) => r.fulfillmentStatus === stage)),
      );
    }
    return map;
  }, [rows]);

  /** Optimistic move + persist + rollback. `index` is the visual slot in the target column. */
  const moveCard = useCallback(
    (row: SaleRow, stage: SaleFulfillment, index: number) => {
      const cards = byStage.get(stage) ?? [];
      if (row.fulfillmentStatus === stage) {
        const current = cards.findIndex((c) => c.id === row.id);
        // Dropping right where the card already sits is a no-op.
        if (current === index || current + 1 === index) return;
      }
      const position = computeDropPosition(cards, row.id, index);
      const snapshot: Partial<SaleRow> = {
        fulfillmentStatus: row.fulfillmentStatus,
        boardPosition: row.boardPosition,
      };
      const stageChanged = row.fulfillmentStatus !== stage;

      onPatch(row.id, { fulfillmentStatus: stage, boardPosition: position });
      void updateSale(row.id, { fulfillmentStatus: stage, boardPosition: position }).then(
        (res) => {
          if (!res.ok) {
            onPatch(row.id, snapshot);
            toast.error(res.error);
          } else if (stageChanged) {
            toast.success(`Pedido #${orderCode(row)} movido para ${FULFILLMENT_LABEL[stage]}.`);
          }
        },
      );
    },
    [byStage, onPatch],
  );

  // ─── HTML5 drag-and-drop handlers ──────────────────────────────────────────
  function onCardDragStart(e: React.DragEvent<HTMLDivElement>, row: SaleRow) {
    e.dataTransfer.setData("text/plain", row.id);
    e.dataTransfer.effectAllowed = "move";
    setDragId(row.id);
  }

  function onCardDragEnd() {
    setDragId(null);
    setDropTarget(null);
  }

  /** Over a card: drop before or after it depending on the pointer's half. */
  function onCardDragOver(
    e: React.DragEvent<HTMLDivElement>,
    stage: SaleFulfillment,
    cardIndex: number,
  ) {
    if (!dragId) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const index = e.clientY < rect.top + rect.height / 2 ? cardIndex : cardIndex + 1;
    setDropTarget((prev) =>
      prev && prev.stage === stage && prev.index === index ? prev : { stage, index },
    );
  }

  /** Over the column body (below the cards): drop at the end. */
  function onColumnDragOver(
    e: React.DragEvent<HTMLElement>,
    stage: SaleFulfillment,
    count: number,
  ) {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget((prev) =>
      prev && prev.stage === stage && prev.index === count ? prev : { stage, index: count },
    );
  }

  function onColumnDrop(e: React.DragEvent<HTMLElement>, stage: SaleFulfillment) {
    e.preventDefault();
    const id = dragId ?? e.dataTransfer.getData("text/plain");
    const index =
      dropTarget && dropTarget.stage === stage
        ? dropTarget.index
        : (byStage.get(stage) ?? []).length;
    setDragId(null);
    setDropTarget(null);
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    moveCard(row, stage, index);
  }

  /** Keyboard: Enter/Space opens the drawer; ←/→ send the focused card to the adjacent stage. */
  function onCardKeyDown(e: React.KeyboardEvent<HTMLDivElement>, row: SaleRow) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenSale(row.id);
      return;
    }
    const idx = KANBAN_STAGES.indexOf(row.fulfillmentStatus);
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0 || idx < 0) return;
    const stage = KANBAN_STAGES[idx + delta];
    if (!stage) return;
    e.preventDefault();
    moveCard(row, stage, (byStage.get(stage) ?? []).length);
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid auto-cols-[minmax(252px,1fr)] grid-flow-col gap-3">
        {KANBAN_STAGES.map((stage) => {
          const cards = byStage.get(stage) ?? [];
          const sumCents = cards.reduce((s, r) => s + r.totalCents, 0);
          const avgCents = cards.length ? Math.round(sumCents / cards.length) : 0;
          const stale = staleCount(cards, stage, today);
          const isOver = dragId !== null && dropTarget?.stage === stage;

          return (
            <section
              key={stage}
              aria-label={`Coluna ${FULFILLMENT_LABEL[stage]}`}
              onDragOver={(e) => onColumnDragOver(e, stage, cards.length)}
              onDrop={(e) => onColumnDrop(e, stage)}
              className={`flex min-h-[300px] flex-col rounded-2xl border bg-surface p-3 transition-colors ${
                isOver ? "border-accent/50 ring-1 ring-accent/30" : "border-border"
              }`}
            >
              <header className="mb-3 space-y-1 px-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${STAGE_DOT[stage]}`}
                      aria-hidden
                    />
                    <span className="truncate text-xs font-semibold">
                      {FULFILLMENT_LABEL[stage]}
                    </span>
                    <Badge variant="neutral" className="px-2 py-0 text-[10px]">
                      {cards.length}
                    </Badge>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] font-semibold text-muted-foreground">
                    {brl(sumCents)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span>Ticket {brl(avgCents)}</span>
                  {stale > 0 && (
                    <span className="flex items-center gap-1 font-medium text-amber-500">
                      <Warning size={11} weight="bold" aria-hidden />
                      {stale} parada{stale > 1 ? "s" : ""} há +7d
                    </span>
                  )}
                </div>
              </header>

              <div className="flex flex-1 flex-col gap-2">
                {cards.map((r, i) => (
                  <div key={r.id} className="space-y-2">
                    {isOver && dropTarget?.index === i && (
                      <div className="h-0.5 rounded-full bg-accent" aria-hidden />
                    )}
                    <div
                      draggable
                      role="button"
                      tabIndex={0}
                      aria-grabbed={dragId === r.id}
                      aria-label={`Pedido ${orderCode(r)}, ${r.customerName ?? "sem cliente"}, ${brl(
                        r.totalCents,
                      )}, ${FULFILLMENT_LABEL[stage]}. Use as setas para mover de coluna.`}
                      onDragStart={(e) => onCardDragStart(e, r)}
                      onDragEnd={onCardDragEnd}
                      onDragOver={(e) => onCardDragOver(e, stage, i)}
                      onKeyDown={(e) => onCardKeyDown(e, r)}
                      onClick={() => onOpenSale(r.id)}
                      className={`cursor-grab select-none rounded-xl border border-border bg-surface-elevated p-3 transition-[opacity,border-color] hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 active:cursor-grabbing ${
                        dragId === r.id ? "opacity-40 ring-2 ring-accent/40" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                          #{orderCode(r)}
                        </span>
                        <span className="shrink-0 font-mono text-xs font-semibold">
                          {brl(r.totalCents)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs font-medium">
                        {r.customerName ?? "Sem cliente"}
                      </p>
                      {r.notes && (
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {r.notes}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1">
                          <Badge variant="neutral" className="max-w-[110px] truncate px-1.5 py-0 text-[9px]">
                            {r.platform}
                          </Badge>
                          <Badge
                            variant={PAYMENT_VARIANT[r.paymentStatus]}
                            className="px-1.5 py-0 text-[9px]"
                          >
                            {PAYMENT_LABEL[r.paymentStatus]}
                          </Badge>
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {dateBR(r.soldAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {isOver && dropTarget?.index === cards.length && (
                  <div className="h-0.5 rounded-full bg-accent" aria-hidden />
                )}

                {cards.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/70 px-2 py-6 text-center text-[11px] text-muted-foreground/70">
                    Arraste um pedido para cá
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
