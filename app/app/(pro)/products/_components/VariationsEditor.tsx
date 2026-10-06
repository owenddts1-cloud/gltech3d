"use client";

/**
 * Editor of storefront variation groups (migration 0059). Shared by the
 * Products page and Landing Edit — keep it dependency-light: controlled
 * `value`/`onChange`, no data fetching, no toasts.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash, X } from "@/lib/ui/icons";
import type { ProductVariationGroup } from "@/lib/schemas/products-catalog";

interface Props {
  value: ProductVariationGroup[];
  onChange: (v: ProductVariationGroup[]) => void;
}

export default function VariationsEditor({ value, onChange }: Props) {
  function addGroup() {
    onChange([...value, { name: "", options: [] }]);
  }

  function removeGroup(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function patchGroup(index: number, patch: Partial<ProductVariationGroup>) {
    onChange(value.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
          Sem variações. Ex.: grupo &quot;Tamanho&quot; com opções P, M e G.
        </p>
      )}
      {value.map((group, i) => (
        <GroupRow
          // Index key is fine: the list is short and never reordered.
          key={i}
          group={group}
          onPatch={(patch) => patchGroup(i, patch)}
          onRemove={() => removeGroup(i)}
        />
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addGroup}>
        <Plus size={14} aria-hidden /> Adicionar grupo
      </Button>
    </div>
  );
}

function GroupRow({
  group,
  onPatch,
  onRemove,
}: {
  group: ProductVariationGroup;
  onPatch: (patch: Partial<ProductVariationGroup>) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const option = draft.trim();
    if (!option) return;
    setDraft("");
    if (group.options.includes(option)) return;
    onPatch({ options: [...group.options, option] });
  }

  function removeOption(option: string) {
    onPatch({ options: group.options.filter((o) => o !== option) });
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <Input
          value={group.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Nome do grupo (ex.: Tamanho)"
          className="h-8 text-xs"
          aria-label="Nome do grupo de variação"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remover grupo de variação"
          className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:text-error"
        >
          <Trash size={14} aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {group.options.map((option) => (
          <span
            key={option}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs"
          >
            {option}
            <button
              type="button"
              onClick={() => removeOption(option)}
              aria-label={`Remover opção ${option}`}
              className="rounded-full text-muted-foreground transition-colors hover:text-error"
            >
              <X size={11} aria-hidden />
            </button>
          </span>
        ))}
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Enter adds the chip; never submit an enclosing form.
              e.preventDefault();
              commitDraft();
            }
          }}
          onBlur={commitDraft}
          placeholder="Opção + Enter"
          className="h-7 w-32 flex-none text-xs"
          aria-label={`Nova opção do grupo ${group.name || "sem nome"}`}
        />
      </div>
    </div>
  );
}
