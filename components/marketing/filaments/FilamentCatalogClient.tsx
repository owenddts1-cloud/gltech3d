'use client';

import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { PublicFilament } from '@/lib/filament-catalog/types';
import { FILAMENT_AVAILABILITY_LABEL, type FilamentAvailability } from '@/lib/filament-catalog/schemas';
import {
  EMPTY_FILAMENT_FILTERS,
  FILAMENT_SORT_LABEL,
  filamentFilterOptions,
  filterFilaments,
  type FilamentFilters,
  type FilamentSort,
} from '@/lib/storefront/filaments';
import { FilamentCard } from './FilamentCard';
import { SpoolSwatch } from './FilamentVisuals';

const SELECT =
  'w-full appearance-none rounded-xl border border-[#E8E2D9] bg-white px-3.5 py-2.5 pr-8 text-sm font-semibold text-[#2B2622] outline-none transition-colors focus:border-[#A6815C] focus:ring-2 focus:ring-[#A6815C]/25';

function FilterSelect(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  allLabel: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#7A5C3E]">
        {props.label}
      </span>
      <span className="relative block">
        <select value={props.value} onChange={(e) => props.onChange(e.target.value)} className={SELECT}>
          <option value="">{props.allLabel}</option>
          {props.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#A6815C]">
          ▼
        </span>
      </span>
    </label>
  );
}

export default function FilamentCatalogClient({
  filaments,
  storeWhatsapp,
}: {
  filaments: PublicFilament[];
  storeWhatsapp: string;
}) {
  const [filters, setFilters] = useState<FilamentFilters>(EMPTY_FILAMENT_FILTERS);
  const options = useMemo(() => filamentFilterOptions(filaments), [filaments]);
  const result = useMemo(() => filterFilaments(filaments, filters), [filaments, filters]);
  const colorHex = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const f of filaments) if (f.colorName && !m.has(f.colorName)) m.set(f.colorName, f.colorHex);
    return m;
  }, [filaments]);

  const set = <K extends keyof FilamentFilters>(key: K, value: FilamentFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const active =
    filters.material || filters.line || filters.color || filters.availability || filters.query.trim();

  return (
    <div>
      <div className="sticky top-20 z-30 -mx-6 mb-8 border-y border-[#E8E2D9] bg-[#FAF9F6]/90 px-6 py-4 backdrop-blur-xl md:top-24">
        <div className="grid gap-3 md:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))_minmax(0,1fr)] md:items-end">
          <label className="block">
            <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#7A5C3E]">
              Buscar
            </span>
            <span className="relative block">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A6815C]" />
              <input
                type="search"
                value={filters.query}
                onChange={(e) => set('query', e.target.value)}
                placeholder="PLA preto, PETG, Voolt…"
                className={`${SELECT} pl-9`}
              />
            </span>
          </label>
          <FilterSelect
            label="Material"
            value={filters.material}
            onChange={(v) => set('material', v)}
            allLabel="Todos"
            options={options.materials.map((m) => ({ value: m, label: m }))}
          />
          <FilterSelect
            label="Linha"
            value={filters.line}
            onChange={(v) => set('line', v)}
            allLabel="Todas"
            options={options.lines.map((m) => ({ value: m, label: m }))}
          />
          <FilterSelect
            label="Cor"
            value={filters.color}
            onChange={(v) => set('color', v)}
            allLabel="Todas"
            options={options.colors.map((m) => ({ value: m, label: m }))}
          />
          <FilterSelect
            label="Disponibilidade"
            value={filters.availability}
            onChange={(v) => set('availability', v as FilamentAvailability | '')}
            allLabel="Qualquer"
            options={options.availabilities.map((a) => ({ value: a, label: FILAMENT_AVAILABILITY_LABEL[a] }))}
          />
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#7A5C3E]">
              <SlidersHorizontal className="h-3 w-3" /> Ordenar
            </span>
            <span className="relative block">
              <select
                value={filters.sort}
                onChange={(e) => set('sort', e.target.value as FilamentSort)}
                className={SELECT}
              >
                {(Object.keys(FILAMENT_SORT_LABEL) as FilamentSort[]).map((k) => (
                  <option key={k} value={k}>
                    {FILAMENT_SORT_LABEL[k]}
                  </option>
                ))}
              </select>
              <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#A6815C]">
                ▼
              </span>
            </span>
          </label>
        </div>

        {options.colors.length > 1 ? (
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filtrar por cor">
            {options.colors.map((c) => {
              const on = filters.color === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('color', on ? '' : c)}
                  aria-pressed={on}
                  title={c}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[11px] font-bold transition-colors ${
                    on ? 'border-[#7A5C3E] bg-[#7A5C3E] text-white' : 'border-[#E8E2D9] bg-white text-[#6B5E55] hover:border-[#A6815C]'
                  }`}
                >
                  <SpoolSwatch hex={colorHex.get(c) ?? null} label="" size={18} />
                  {c}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="mb-5 flex items-center justify-between text-sm text-[#6B5E55]" aria-live="polite">
        <span>
          <strong className="text-[#2B2622]">{result.length}</strong> de {filaments.length}{' '}
          {filaments.length === 1 ? 'filamento' : 'filamentos'}
        </span>
        {active ? (
          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...EMPTY_FILAMENT_FILTERS, sort: f.sort }))}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#7A5C3E] hover:text-[#2B2622]"
          >
            <X className="h-3.5 w-3.5" /> Limpar filtros
          </button>
        ) : null}
      </div>

      {result.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#D5CBBF] bg-white/60 px-6 py-16 text-center">
          <p className="font-sora text-lg font-black text-[#2B2622]">Nenhum filamento com esses filtros.</p>
          <p className="mt-1 text-sm text-[#6B5E55]">Tente outra cor ou material — ou pergunte pelo WhatsApp.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.map((f) => (
            <FilamentCard key={f.id} f={f} storeWhatsapp={storeWhatsapp} origem="catalogo_filamentos" />
          ))}
        </div>
      )}
    </div>
  );
}
