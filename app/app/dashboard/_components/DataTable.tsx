'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ListFilter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Tabela com filtro e ordenação POR COLUNA.
 *
 * Genérica de propósito: Vendas e O.S. têm colunas diferentes, e duplicar a
 * tabela para cada uma faria as duas divergirem no primeiro ajuste.
 *
 * Ordena e filtra no cliente: o período já recortou os dados no servidor, e ir
 * ao servidor a cada clique de sort deixaria a interação lenta sem motivo.
 */

export interface Column<T> {
  key: string;
  header: string;
  /** Valor bruto para ordenar e filtrar (número ordena como número). */
  value: (row: T) => string | number;
  /** Renderização da célula. Sem isto, mostra `value`. */
  cell?: (row: T) => React.ReactNode;
  align?: 'left' | 'right';
  /** Coluna sem filtro (ex.: ações). */
  noFilter?: boolean;
}

type SortDir = 'asc' | 'desc';

export default function DataTable<T extends { id: string }>({
  rows,
  columns,
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  empty: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const visible = useMemo(() => {
    let out = rows;

    for (const [key, term] of Object.entries(filters)) {
      const q = term.trim().toLowerCase();
      if (!q) continue;
      const col = columns.find((c) => c.key === key);
      if (!col) continue;
      out = out.filter((r) => String(col.value(r)).toLowerCase().includes(q));
    }

    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        // Cópia antes de ordenar: sort() muta, e mutar a prop quebraria o memo.
        out = [...out].sort((a, b) => {
          const av = col.value(a);
          const bv = col.value(b);
          const cmp =
            typeof av === 'number' && typeof bv === 'number'
              ? av - bv
              : String(av).localeCompare(String(bv), 'pt-BR', { numeric: true });
          return sort.dir === 'asc' ? cmp : -cmp;
        });
      }
    }

    return out;
  }, [rows, columns, filters, sort]);

  const activeFilters = Object.values(filters).filter((v) => v.trim()).length;

  return (
    <div>
      {(activeFilters > 0 || sort) && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {visible.length} de {rows.length}
          </span>
          <button
            type="button"
            onClick={() => {
              setFilters({});
              setSort(null);
            }}
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {columns.map((col) => {
                const sorted = sort?.key === col.key;
                const filtered = Boolean(filters[col.key]?.trim());
                return (
                  <th
                    key={col.key}
                    className={cn(
                      'whitespace-nowrap px-4 py-2.5 text-xs font-medium text-muted-foreground',
                      col.align === 'right' ? 'text-right' : 'text-left',
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center gap-1.5',
                        col.align === 'right' && 'justify-end',
                      )}
                    >
                      <span>{col.header}</span>
                      {!col.noFilter && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Filtrar e ordenar por ${col.header}`}
                              className={cn(
                                'rounded p-0.5 transition-colors hover:bg-muted hover:text-foreground',
                                (sorted || filtered) && 'text-accent',
                              )}
                            >
                              {sorted ? (
                                sort?.dir === 'asc' ? (
                                  <ArrowUp className="h-3 w-3" />
                                ) : (
                                  <ArrowDown className="h-3 w-3" />
                                )
                              ) : filtered ? (
                                <ListFilter className="h-3 w-3" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-50" />
                              )}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-56 p-2">
                            <div className="space-y-1">
                              <button
                                type="button"
                                onClick={() => setSort({ key: col.key, dir: 'asc' })}
                                className={cn(
                                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted',
                                  sorted && sort?.dir === 'asc' && 'bg-accent-soft text-accent',
                                )}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                                {typeof col.value(rows[0] ?? ({} as T)) === 'number'
                                  ? 'Menor para maior'
                                  : 'Crescente (A–Z)'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSort({ key: col.key, dir: 'desc' })}
                                className={cn(
                                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted',
                                  sorted && sort?.dir === 'desc' && 'bg-accent-soft text-accent',
                                )}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                                {typeof col.value(rows[0] ?? ({} as T)) === 'number'
                                  ? 'Maior para menor'
                                  : 'Decrescente (Z–A)'}
                              </button>
                              {sorted && (
                                <button
                                  type="button"
                                  onClick={() => setSort(null)}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Remover ordenação
                                </button>
                              )}
                            </div>

                            <div className="mt-2 border-t border-border pt-2">
                              <Input
                                placeholder={`Buscar em ${col.header.toLowerCase()}…`}
                                value={filters[col.key] ?? ''}
                                onChange={(e) =>
                                  setFilters((f) => ({ ...f, [col.key]: e.target.value }))
                                }
                                className="h-8 text-xs"
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border last:border-0 transition-colors hover:bg-muted/40"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-2.5',
                      col.align === 'right' ? 'text-right' : 'text-left',
                    )}
                  >
                    {col.cell ? col.cell(row) : String(col.value(row))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {visible.length === 0 && (
          <p className="px-4 py-10 text-center text-xs text-muted-foreground">
            {rows.length === 0 ? empty : 'Nada bate com esses filtros.'}
          </p>
        )}
      </div>
    </div>
  );
}
