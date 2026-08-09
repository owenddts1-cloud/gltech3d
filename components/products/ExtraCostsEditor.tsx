"use client";

/**
 * Insumos da peça — o BOM linha a linha (embalagem, ímã, parafuso, tag, frete
 * de material…).
 *
 * A coluna `products.extra_costs` sempre foi uma LISTA `[{label, cost_cents}]`;
 * quem colapsava tudo num único item rotulado "Insumos" era a UI antiga, que
 * expunha um campo de valor só. Discriminar aqui é o que permite responder
 * depois "quanto vai de embalagem no meu custo".
 *
 * Rótulo em branco é aceito de propósito: obrigar um nome faria o usuário
 * inventar um, e valor sem nome ainda é um custo real.
 */

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash } from "@/lib/ui/icons";
import { brlFromCents } from "@/lib/format/money";
import { parseDecimal } from "@/lib/format/decimal";

export interface ExtraCostDraft {
  label: string;
  costCents: number;
}

interface Props {
  value: ExtraCostDraft[];
  onChange: (next: ExtraCostDraft[]) => void;
}

export function ExtraCostsEditor({ value, onChange }: Props) {
  const total = value.reduce((sum, item) => sum + item.costCents, 0);

  function patchAt(index: number, patch: Partial<ExtraCostDraft>) {
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  return (
    <div className="space-y-2">
      {value.map((item, index) => (
        // O índice é a identidade real aqui: duas linhas podem ter o mesmo
        // rótulo (ou nenhum), e reordenar não é possível nesta lista.
        <div key={index} className="flex items-center gap-2">
          <Input
            aria-label={`Descrição do insumo ${index + 1}`}
            value={item.label}
            onChange={(e) => patchAt(index, { label: e.target.value })}
            placeholder="Ex.: embalagem"
            className="flex-1"
          />
          <Input
            aria-label={`Valor do insumo ${index + 1}`}
            inputMode="decimal"
            value={item.costCents === 0 ? "" : (item.costCents / 100).toFixed(2).replace(".", ",")}
            onChange={(e) =>
              patchAt(index, { costCents: Math.round(parseDecimal(e.target.value) * 100) })
            }
            placeholder="0,00"
            className="w-28 text-right tabular-nums"
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
            aria-label={`Remover insumo ${index + 1}`}
            className="shrink-0 text-muted-foreground transition-colors hover:text-error"
          >
            <Trash size={14} />
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([...value, { label: "", costCents: 0 }])}
        >
          <Plus size={14} aria-hidden /> Adicionar insumo
        </Button>
        {value.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Total <span className="font-medium tabular-nums text-text">{brlFromCents(total)}</span>
          </span>
        )}
      </div>

      {value.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Nenhum insumo. Some aqui o que não é filamento nem energia.
        </p>
      )}
    </div>
  );
}
