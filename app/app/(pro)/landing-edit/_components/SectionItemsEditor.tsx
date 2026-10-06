'use client';

import { Plus, Trash2, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SECTION_ICON_LABEL,
  SECTION_ICON_NAMES,
  resolveSectionIcon,
} from '@/lib/landing/section-icons';
import type { LandingSectionItem } from '@/lib/landing/types';

/**
 * Editor das listas de uma seção: passos do "Como Funciona" e depoimentos.
 *
 * `items` ausente = a landing usa a lista padrão do código. Por isso "Restaurar
 * padrão" apaga a lista em vez de reescrever os itens: assim o site volta a
 * seguir o padrão automaticamente se ele mudar no futuro.
 */

export type ItemKind = 'step' | 'testimonial';

interface Props {
  kind: ItemKind;
  /** Undefined = seguindo a lista padrão do site. */
  items: LandingSectionItem[] | undefined;
  /** Mostrada quando `items` é undefined, para o usuário ver o que está no ar. */
  fallback: LandingSectionItem[];
  onChange: (next: LandingSectionItem[] | undefined) => void;
  onBlurFlush: () => void;
}

const EMPTY: Record<ItemKind, LandingSectionItem> = {
  step: { icon: 'Sparkles', title: '', text: '' },
  testimonial: { text: '', author: '', detail: '' },
};

export default function SectionItemsEditor({
  kind,
  items,
  fallback,
  onChange,
  onBlurFlush,
}: Props) {
  const usingDefault = items === undefined;
  const list = items ?? fallback;

  function update(index: number, patch: Partial<LandingSectionItem>) {
    // Editar enquanto está no padrão materializa a lista — a partir daí ela é sua.
    onChange(list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
    onBlurFlush();
  }

  function remove(index: number) {
    const next = list.filter((_, i) => i !== index);
    // Lista vazia vira `undefined`: seção sem item nenhum ficaria um buraco na
    // página, então o site volta ao padrão.
    onChange(next.length > 0 ? next : undefined);
    onBlurFlush();
  }

  function add() {
    onChange([...list, { ...EMPTY[kind] }]);
    onBlurFlush();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {usingDefault
            ? `${list.length} ${kind === 'step' ? 'passos padrão' : 'depoimentos de exemplo'} — edite para tornar seus`
            : `${list.length} ${list.length === 1 ? 'item' : 'itens'}`}
        </span>
        {!usingDefault && (
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              onBlurFlush();
            }}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Restaurar padrão
          </button>
        )}
      </div>

      {kind === 'testimonial' && usingDefault && (
        <p className="rounded-lg border border-warning bg-warning-bg px-3 py-2 text-[11px] leading-snug text-warning-fg">
          Estes depoimentos são <strong>exemplos fictícios</strong> que vieram com o template — e
          estão no ar agora. Troque por avaliações reais de clientes.
        </p>
      )}

      {list.map((item, i) => {
        const Icon = resolveSectionIcon(item.icon);
        return (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center gap-1.5">
              {kind === 'step' && (
                <span className="rounded-md bg-accent-soft p-1.5 text-accent">
                  <Icon className="h-3.5 w-3.5" />
                </span>
              )}
              <span className="flex-1 text-[11px] font-medium text-muted-foreground">
                {kind === 'step' ? `Passo ${i + 1}` : `Depoimento ${i + 1}`}
              </span>
              <button
                type="button"
                title="Subir"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Descer"
                disabled={i === list.length - 1}
                onClick={() => move(i, 1)}
                className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Remover"
                onClick={() => remove(i)}
                className="rounded p-1 text-muted-foreground hover:text-error"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {kind === 'step' ? (
                <>
                  <Select
                    value={item.icon ?? 'Sparkles'}
                    onValueChange={(v) => {
                      update(i, { icon: v });
                      onBlurFlush();
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTION_ICON_NAMES.map((name) => (
                        <SelectItem key={name} value={name}>
                          {SECTION_ICON_LABEL[name]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Título do passo"
                    value={item.title ?? ''}
                    onChange={(e) => update(i, { title: e.target.value })}
                    onBlur={onBlurFlush}
                    className="h-8 text-xs"
                  />
                  <Textarea
                    placeholder="Descrição"
                    rows={2}
                    value={item.text ?? ''}
                    onChange={(e) => update(i, { text: e.target.value })}
                    onBlur={onBlurFlush}
                    className="text-xs"
                  />
                </>
              ) : (
                <>
                  <Textarea
                    placeholder="O que o cliente disse"
                    rows={2}
                    value={item.text ?? ''}
                    onChange={(e) => update(i, { text: e.target.value })}
                    onBlur={onBlurFlush}
                    className="text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Nome"
                      value={item.author ?? ''}
                      onChange={(e) => update(i, { author: e.target.value })}
                      onBlur={onBlurFlush}
                      className="h-8 text-xs"
                    />
                    <Input
                      placeholder="Cidade · UF"
                      value={item.detail ?? ''}
                      onChange={(e) => update(i, { detail: e.target.value })}
                      onBlur={onBlurFlush}
                      className="h-8 text-xs"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}

      {list.length < 12 && (
        <Button variant="outline" size="sm" onClick={add} className="w-full">
          <Plus className="mr-1 h-3.5 w-3.5" />
          {kind === 'step' ? 'Novo passo' : 'Novo depoimento'}
        </Button>
      )}
    </div>
  );
}
