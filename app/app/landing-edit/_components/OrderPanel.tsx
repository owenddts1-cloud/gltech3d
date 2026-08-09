'use client';

import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { GripVertical, ArrowUp, ArrowDown, EyeOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { LandingProductAdmin } from '@/app/actions/landing/actions';
import { reorderLandingProducts } from '@/app/actions/landing/actions';

interface OrderPanelProps {
  products: LandingProductAdmin[];
  onReordered: (ordered: LandingProductAdmin[]) => void;
}

export default function OrderPanel({ products, onReordered }: OrderPanelProps) {
  const [items, setItems] = useState<LandingProductAdmin[]>(() => [...products]);
  const [saving, setSaving] = useState(false);

  // Sync if length or IDs changed externally
  if (items.length !== products.length || items.some((it, i) => it.id !== products[i]?.id)) {
    setItems([...products]);
  }

  async function persistOrder(nextItems: LandingProductAdmin[]) {
    setItems(nextItems);
    onReordered(nextItems);
    setSaving(true);

    const orderedIds = nextItems.map((p) => p.id);
    const result = await reorderLandingProducts({ orderedIds });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error ?? 'Falha ao salvar ordem');
      setItems(products);
      onReordered(products);
    } else {
      toast.success('Nova sequência da vitrine salva!');
    }
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const fromIndex = result.source.index;
    const toIndex = result.destination.index;
    if (fromIndex === toIndex) return;

    const list = [...items];
    const [moved] = list.splice(fromIndex, 1);
    if (!moved) return;
    list.splice(toIndex, 0, moved);

    void persistOrder(list);
  }

  function moveItem(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const list = [...items];
    const [moved] = list.splice(index, 1);
    if (!moved) return;
    list.splice(targetIndex, 0, moved);

    void persistOrder(list);
  }

  function resetAlphabetical() {
    const list = [...items].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    void persistOrder(list);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Ordem dos Produtos na Vitrine</h3>
          <p className="text-xs text-muted-foreground">
            Arraste os cards ou use as setas para definir a sequência exata no site.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={resetAlphabetical}
          disabled={saving}
          className="h-8 shrink-0 text-xs gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Ordem A-Z
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="products-reorder">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-2 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1"
            >
              {items.map((p, index) => {
                const price = p.salePriceCents
                  ? (p.salePriceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                  : null;
                const img = p.images[0];

                return (
                  <Draggable key={p.id} draggableId={p.id} index={index}>
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={`flex items-center gap-3 rounded-lg border p-2.5 transition-shadow ${
                          snapshot.isDragging
                            ? 'border-accent bg-accent/10 shadow-lg'
                            : 'border-border bg-card hover:border-accent/40'
                        }`}
                      >
                        <div
                          {...dragProvided.dragHandleProps}
                          className="flex h-8 w-6 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
                          title="Arrastar para reordenar"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>

                        <span className="w-5 text-center text-xs font-semibold text-muted-foreground">
                          #{index + 1}
                        </span>

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                          {img ? (
                            // eslint-disable-next-next/no-img-element
                            <img src={img} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Sem foto</span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs font-medium">{p.name}</span>
                            {!p.isPublished && (
                              <Badge variant="outline" className="gap-0.5 px-1 py-0 text-[9px] text-muted-foreground">
                                <EyeOff className="h-2.5 w-2.5" />
                                Rascunho
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{p.category || 'Sem nicho'}</span>
                            {price && <span>• {price}</span>}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={index === 0 || saving}
                            onClick={() => moveItem(index, 'up')}
                            title="Mover para cima"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={index === items.length - 1 || saving}
                            onClick={() => moveItem(index, 'down')}
                            title="Mover para baixo"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
