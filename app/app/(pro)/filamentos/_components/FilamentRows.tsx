"use client";

/**
 * Sortable list of filaments with the quick controls (availability, published).
 * Shared by CRM → Filamentos and the "Filamentos" tab of the Landing Edit, so
 * both screens write through the same actions with the same optimistic rules.
 *
 * Order uses the fractional index of the Landing Edit (`reorder()` from
 * landing-edit/_lib/order.ts): a drag normally writes ONE row.
 */
import { useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { ArrowDown, ArrowUp, DotsSixVertical } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PencilSimple, Trash, Sparkle } from "@/lib/ui/icons";
import { reorder } from "@/app/app/(pro)/landing-edit/_lib/order";
import {
  reorderFilaments,
  setFilamentAvailability,
  setFilamentPublished,
} from "@/app/actions/filament-catalog/actions";
import {
  FILAMENT_AVAILABILITY,
  FILAMENT_AVAILABILITY_LABEL,
  isOrderableAvailability,
  type FilamentAvailability,
} from "@/lib/filament-catalog/schemas";
import type { FilamentAdmin } from "@/lib/filament-catalog/types";
import { formatBRL } from "@/lib/pricing/pro-plans";
import { formatNetWeight } from "@/lib/filament-catalog/title";

const AVAIL_DOT: Record<FilamentAvailability, string> = {
  em_estoque: "bg-success",
  ultimas_unidades: "bg-warning",
  sob_encomenda: "bg-accent",
  esgotado: "bg-error",
};

export function FilamentThumb({ f, size = 48 }: { f: Pick<FilamentAdmin, "images" | "colorHex" | "name">; size?: number }) {
  const photo = f.images[0];
  const hex = f.colorHex && /^#[0-9a-f]{6}$/i.test(f.colorHex) ? f.colorHex : "#9c9087";
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-md border border-border bg-surface-elevated"
      style={{ width: size, height: size }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : (
        <span
          role="img"
          aria-label={`Cor de ${f.name}`}
          className="absolute inset-1.5 rounded-full border-[3px] border-[#2B2622]"
          style={{ background: `repeating-radial-gradient(circle, ${hex} 0 2px, ${hex}cc 2px 3px)` }}
        />
      )}
    </div>
  );
}

export function FilamentRows({
  items,
  onItemsChange,
  onEdit,
  onDelete,
  compact = false,
  sortable = true,
}: {
  /** Already in display order (sortForDisplay). */
  items: FilamentAdmin[];
  onItemsChange: (next: FilamentAdmin[]) => void;
  onEdit?: (f: FilamentAdmin) => void;
  onDelete?: (f: FilamentAdmin) => void;
  compact?: boolean;
  /** false = filtered view: no drag / arrows (neighbors would be wrong). */
  sortable?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function move(from: number, to: number) {
    const result = reorder(items, from, to);
    if (result.writes.length === 0) return;
    const previous = items;
    onItemsChange(result.items);
    setBusy("__order");
    const r = await reorderFilaments({ writes: result.writes });
    setBusy(null);
    if (!r.ok) {
      toast.error(r.error);
      onItemsChange(previous);
      return;
    }
    toast.success(result.writes.length === 1 ? "Ordem salva." : `Ordem salva (${result.writes.length} itens renumerados).`);
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    void move(result.source.index, result.destination.index);
  }

  async function changeAvailability(f: FilamentAdmin, availability: FilamentAvailability) {
    const previous = items;
    onItemsChange(
      items.map((x) =>
        x.id === f.id
          ? { ...x, availability, availabilityLabel: FILAMENT_AVAILABILITY_LABEL[availability], orderable: isOrderableAvailability(availability) }
          : x,
      ),
    );
    setBusy(f.id);
    const r = await setFilamentAvailability({ id: f.id, availability });
    setBusy(null);
    if (!r.ok) {
      toast.error(r.error);
      onItemsChange(previous);
    }
  }

  async function changePublished(f: FilamentAdmin, isPublished: boolean) {
    if (isPublished && (f.salePriceCents == null || f.salePriceCents <= 0)) {
      toast.error("Defina o valor de venda antes de publicar.");
      return;
    }
    const previous = items;
    onItemsChange(items.map((x) => (x.id === f.id ? { ...x, isPublished } : x)));
    setBusy(f.id);
    const r = await setFilamentPublished({ id: f.id, isPublished });
    setBusy(null);
    if (!r.ok) {
      toast.error(r.error);
      onItemsChange(previous);
      return;
    }
    toast.success(isPublished ? `“${f.name}” está no site.` : `“${f.name}” saiu do site.`);
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="filaments-order">
        {(provided) => (
          <ul ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
            {items.map((f, index) => {
              const meta = [f.materialName, f.line, f.brand, formatNetWeight(f.netWeightG)].filter(Boolean).join(" · ");
              const rowBusy = busy === f.id || busy === "__order";
              return (
                <Draggable key={f.id} draggableId={f.id} index={index} isDragDisabled={!sortable}>
                  {(drag, snapshot) => (
                    <li
                      ref={drag.innerRef}
                      {...drag.draggableProps}
                      className={`flex flex-wrap items-center gap-3 rounded-lg border bg-surface p-2.5 transition-shadow sm:flex-nowrap ${
                        snapshot.isDragging ? "border-accent shadow-lg" : "border-border hover:border-accent/40"
                      }`}
                    >
                      <span
                        {...drag.dragHandleProps}
                        className={`flex h-8 w-5 items-center justify-center text-text-muted hover:text-text ${sortable ? "cursor-grab active:cursor-grabbing" : "invisible"}`}
                        title="Arrastar para reordenar"
                        aria-label={`Reordenar ${f.name}`}
                      >
                        <DotsSixVertical size={18} weight="bold" />
                      </span>
                      <span className="w-6 text-center text-xs font-semibold tabular-nums text-text-muted">{index + 1}</span>
                      <FilamentThumb f={f} size={compact ? 40 : 52} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onEdit?.(f)}
                            disabled={!onEdit}
                            className="truncate text-left text-sm font-semibold hover:text-accent disabled:hover:text-text"
                          >
                            {f.name}
                          </button>
                          {f.nameIsAuto && !compact ? (
                            <span title="Título automático: acompanha a ficha técnica" className="text-accent">
                              <Sparkle size={12} aria-label="Título automático" />
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-text-muted">{meta || "Ficha técnica incompleta"}</p>
                      </div>

                      <span className={`w-24 shrink-0 text-right text-sm font-semibold tabular-nums ${f.salePriceCents ? "" : "text-warning-fg"}`}>
                        {f.salePriceCents ? formatBRL(f.salePriceCents) : "Sem preço"}
                      </span>

                      <Select value={f.availability} onValueChange={(v) => void changeAvailability(f, v as FilamentAvailability)} disabled={rowBusy}>
                        <SelectTrigger className="h-8 w-[10.5rem] shrink-0 text-xs" aria-label={`Disponibilidade de ${f.name}`}>
                          <span className="flex items-center gap-2">
                            <span aria-hidden className={`h-2 w-2 rounded-full ${AVAIL_DOT[f.availability]}`} />
                            <SelectValue />
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {FILAMENT_AVAILABILITY.map((a) => (
                            <SelectItem key={a} value={a}>
                              {FILAMENT_AVAILABILITY_LABEL[a]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <label className="flex shrink-0 items-center gap-2 text-xs text-text-muted">
                        <Switch
                          checked={f.isPublished}
                          onCheckedChange={(v) => void changePublished(f, v)}
                          disabled={rowBusy}
                          aria-label={`Publicar ${f.name} no site`}
                        />
                        {f.isPublished ? <Badge variant="success">No site</Badge> : <span className="w-12">Oculto</span>}
                      </label>

                      <div className="flex shrink-0 items-center">
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!sortable || index === 0 || rowBusy} onClick={() => void move(index, index - 1)} aria-label="Mover para cima">
                          <ArrowUp size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={!sortable || index === items.length - 1 || rowBusy}
                          onClick={() => void move(index, index + 1)}
                          aria-label="Mover para baixo"
                        >
                          <ArrowDown size={14} />
                        </Button>
                        {onEdit ? (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(f)} aria-label={`Editar ${f.name}`}>
                            <PencilSimple size={14} />
                          </Button>
                        ) : null}
                        {onDelete ? (
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-error" onClick={() => onDelete(f)} aria-label={`Excluir ${f.name}`}>
                            <Trash size={14} />
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </ul>
        )}
      </Droppable>
    </DragDropContext>
  );
}
