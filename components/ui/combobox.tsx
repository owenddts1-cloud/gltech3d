"use client";

/**
 * Combobox — menu suspenso inteligente com campo de busca (padrão do CRM).
 *
 * Substitui <select> nativos: busca com filtro sem acento/caixa, navegação por
 * teclado (↑ ↓ Enter Esc), item "adicionar novo" opcional (`allowCreate`) para
 * fluxos como "Outro cliente" (cadastro pendente). Sem dependências novas —
 * construído sobre o Popover (Radix) já existente.
 */

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CaretDown, Check, MagnifyingGlass, Plus, CircleNotch } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Linha secundária opcional (ex.: "Cadastro pendente"). */
  hint?: string;
}

interface AllowCreate {
  /** Rótulo do item de criação, dado o texto buscado. Ex.: (q) => `Adicionar "${q}" como novo cliente`. */
  label: (query: string) => string;
  /** Cria e retorna a opção nova (ou null em falha — o combobox permanece aberto). */
  onCreate: (name: string) => Promise<ComboboxOption | null>;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string, option: ComboboxOption | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allowCreate?: AllowCreate;
  disabled?: boolean;
  /** Classe extra do botão-gatilho (largura etc.). */
  className?: string;
  id?: string;
}

/** Normaliza para busca: minúsculas e sem acento. */
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Selecionar…",
  searchPlaceholder = "Buscar…",
  emptyText = "Nada encontrado.",
  allowCreate,
  disabled,
  className,
  id,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlight, setHighlight] = React.useState(0);
  const [creating, setCreating] = React.useState(false);
  const listRef = React.useRef<HTMLUListElement>(null);
  const listboxId = React.useId();

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = React.useMemo(() => {
    const q = norm(query.trim());
    if (!q) return options;
    return options.filter((o) => norm(o.label).includes(q) || norm(o.hint ?? "").includes(q));
  }, [options, query]);

  // Item "criar novo" aparece quando há busca sem correspondência exata.
  const canCreate =
    !!allowCreate &&
    query.trim().length > 1 &&
    !options.some((o) => norm(o.label) === norm(query.trim()));
  const totalItems = filtered.length + (canCreate ? 1 : 0);

  React.useEffect(() => {
    // Reabre limpo e realça o selecionado (ou o primeiro).
    if (open) {
      setQuery("");
      const idx = filtered.findIndex((o) => o.value === value);
      setHighlight(idx >= 0 ? idx : 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    setHighlight(0);
  }, [query]);

  React.useEffect(() => {
    // Mantém o item realçado visível na rolagem.
    const el = listRef.current?.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  function pick(option: ComboboxOption) {
    onChange(option.value, option);
    setOpen(false);
  }

  async function create() {
    if (!allowCreate || creating) return;
    const name = query.trim();
    setCreating(true);
    const created = await allowCreate.onCreate(name);
    setCreating(false);
    if (created) {
      onChange(created.value, created);
      setOpen(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, totalItems - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight < filtered.length) {
        const opt = filtered[highlight];
        if (opt) pick(opt);
      } else if (canCreate) {
        void create();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-sm",
            "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
            {selected?.label ?? placeholder}
          </span>
          <CaretDown size={14} aria-hidden className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-56 p-0">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <MagnifyingGlass size={14} aria-hidden className="shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul ref={listRef} id={listboxId} role="listbox" className="max-h-64 overflow-y-auto p-1">
          {filtered.map((o, i) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                onClick={() => pick(o)}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  i === highlight ? "bg-accent/10 text-text" : "text-text",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && (
                    <span className="block truncate text-[11px] text-muted-foreground">{o.hint}</span>
                  )}
                </span>
                {o.value === value && <Check size={14} aria-hidden className="shrink-0 text-accent" />}
              </button>
            </li>
          ))}

          {canCreate && (
            <li role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => void create()}
                onMouseEnter={() => setHighlight(filtered.length)}
                disabled={creating}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm font-medium text-accent",
                  highlight === filtered.length && "bg-accent/10",
                )}
              >
                {creating ? (
                  <CircleNotch size={14} aria-hidden className="animate-spin" />
                ) : (
                  <Plus size={14} aria-hidden />
                )}
                <span className="truncate">{allowCreate.label(query.trim())}</span>
              </button>
            </li>
          )}

          {filtered.length === 0 && !canCreate && (
            <li className="px-2 py-4 text-center text-xs text-muted-foreground">{emptyText}</li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
