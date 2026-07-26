"use client";

/**
 * CRUD dos itens do documento.
 *
 * Escolher um produto pré-preenche nome, descrição, preço de venda e a primeira
 * foto do catálogo — a partir daí tudo é editável, inclusive trocar ou remover a
 * foto. Item sem produto (`productId: null`) é serviço avulso digitado na hora.
 */

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash } from "@/lib/ui/icons";
import { brlFromCents, brlNumberFromCents, centsFromInput } from "@/lib/format/money";
import type { DocItemInput } from "@/lib/schemas/service-order-documents";
import {
  itemFromProduct,
  lineTotalCents,
  type DraftProduct,
} from "@/app/app/service-orders/_lib/document-draft";

import { ItemPhotoField } from "./ItemPhotoField";

interface Props {
  items: DocItemInput[];
  products: DraftProduct[];
  showPhotos: boolean;
  onChange: (next: DocItemInput[]) => void;
}

/**
 * Campo de dinheiro que mantém o texto do usuário enquanto ele digita.
 *
 * Reformatar a cada tecla ("12" → "R$ 0,12") tira o cursor do lugar e enlouquece
 * quem está digitando; a normalização acontece só no blur.
 */
function MoneyInput({
  valueCents,
  onChangeCents,
  ...rest
}: {
  valueCents: number;
  onChangeCents: (cents: number) => void;
  id?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Input
      {...rest}
      inputMode="decimal"
      value={draft ?? brlNumberFromCents(valueCents)}
      onChange={(e) => {
        setDraft(e.target.value);
        onChangeCents(centsFromInput(e.target.value));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

export function ItemsEditor({ items, products, showPhotos, onChange }: Props) {
  function patch(index: number, next: Partial<DocItemInput>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...next } : item)));
  }

  function addBlank() {
    onChange([
      ...items,
      { productId: null, name: "", description: "", qty: 1, unitPriceCents: 0, imageUrl: null },
    ]);
  }

  function addFromProduct(productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const { id: _id, ...item } = itemFromProduct(product);
    onChange([...items, item]);
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((acc, item) => acc + lineTotalCents(item), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1 space-y-1.5">
          <Label htmlFor="doc-add-product">Adicionar do catálogo</Label>
          <Combobox
            id="doc-add-product"
            className="h-9 rounded-lg text-xs"
            value=""
            onChange={(v) => addFromProduct(v)}
            options={products.map((p) => ({
              value: p.id,
              label: p.name,
              hint: p.salePriceCents ? brlFromCents(p.salePriceCents) : "sem preço",
            }))}
            placeholder="Buscar produto…"
            searchPlaceholder="Buscar produto…"
            emptyText="Nenhum produto no catálogo."
          />
        </div>
        <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg text-xs" onClick={addBlank}>
          <Plus size={14} className="mr-1" /> Item avulso
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-text-muted">
          Nenhum item. Adicione do catálogo ou crie um item avulso.
        </p>
      ) : null}

      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="rounded-lg border border-border bg-surface p-3">
            <div className="flex gap-3">
              {showPhotos ? (
                <ItemPhotoField
                  value={item.imageUrl}
                  onChange={(imageUrl) => patch(index, { imageUrl })}
                />
              ) : null}

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start gap-2">
                  <Input
                    aria-label={`Descrição do item ${index + 1}`}
                    value={item.name}
                    placeholder="Descrição do item ou serviço"
                    onChange={(e) => patch(index, { name: e.target.value })}
                    className="h-9 rounded-lg text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remover item ${index + 1}`}
                    className="h-9 shrink-0 rounded-lg px-2 text-error"
                    onClick={() => remove(index)}
                  >
                    <Trash size={14} />
                  </Button>
                </div>

                <Input
                  aria-label={`Detalhe do item ${index + 1}`}
                  value={item.description}
                  placeholder="Detalhe (opcional) — cor, acabamento, medidas…"
                  onChange={(e) => patch(index, { description: e.target.value })}
                  className="h-8 rounded-lg text-[11px]"
                />

                <div className="grid grid-cols-3 items-center gap-2">
                  <Input
                    aria-label={`Quantidade do item ${index + 1}`}
                    inputMode="decimal"
                    value={item.qty}
                    onChange={(e) =>
                      patch(index, { qty: Math.max(0.001, Number(e.target.value.replace(",", ".")) || 0) })
                    }
                    className="h-9 rounded-lg text-xs"
                  />
                  <MoneyInput
                    aria-label={`Valor unitário do item ${index + 1}`}
                    valueCents={item.unitPriceCents}
                    onChangeCents={(unitPriceCents) => patch(index, { unitPriceCents })}
                    className="h-9 rounded-lg text-right text-xs"
                  />
                  <p className="text-right text-xs font-semibold text-foreground">
                    {brlFromCents(lineTotalCents(item))}
                  </p>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {items.length > 0 ? (
        <p className="text-right text-xs text-text-muted">
          Subtotal dos itens: <strong className="text-foreground">{brlFromCents(subtotal)}</strong>
        </p>
      ) : null}
    </div>
  );
}
