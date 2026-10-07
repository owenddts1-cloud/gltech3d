'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { PublicFilament } from '@/lib/filament-catalog/types';
import { FALLBACK_FILAMENTS } from '@/lib/filament-catalog/fallback-filaments';
import { filamentFilterOptions } from '@/lib/storefront/filaments';
import { track } from '@/lib/analytics/track';
import { FilamentCarousel } from './FilamentCarousel';

const MAX_CARDS = 8;

/**
 * `#filamentos` on the home, right below the products and above the slicer reveal.
 * Uses FALLBACK_FILAMENTS if no filament is returned from the database to guarantee
 * the section is never empty.
 */
export default function FilamentsHomeSection({
  filaments,
  storeWhatsapp,
}: {
  filaments: PublicFilament[];
  storeWhatsapp: string;
}) {
  const [material, setMaterial] = useState('');
  
  // Garantir fallback técnico para que o carrossel nunca fique vazio
  const effectiveFilaments = filaments.length > 0 ? filaments : FALLBACK_FILAMENTS;

  const { materials } = useMemo(() => filamentFilterOptions(effectiveFilaments), [effectiveFilaments]);
  const visible = useMemo(
    () => effectiveFilaments.filter((f) => !material || f.materialName === material).slice(0, MAX_CARDS),
    [effectiveFilaments, material],
  );

  return (
    <section id="filamentos" className="relative scroll-mt-24 overflow-hidden px-6 py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 50% at 85% 0%, rgba(166,129,92,0.14) 0%, transparent 70%), linear-gradient(#FAF9F6, #F4F1EA)',
        }}
      />
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-end">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-brand-bronze-ink font-sora">
              Filamentos · testados na nossa produção
            </span>
            <h2 className="mt-3 font-sora text-3xl font-black leading-[1.05] tracking-tight text-brand-espresso md:text-5xl">
              O mesmo rolo que roda
              <br />
              <em className="font-serif font-normal italic text-brand-bronze-deep">nas nossas máquinas.</em>
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-brand-taupe md:text-base">
            Escolha a cor, monte o carrinho e finalize pelo WhatsApp. A loja confirma estoque e frete
            antes de qualquer pagamento.
          </p>
        </header>

        {materials.length > 1 ? (
          <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filtrar por material">
            {['', ...materials].map((m) => {
              const active = material === m;
              return (
                <button
                  key={m || 'todos'}
                  type="button"
                  onClick={() => setMaterial(m)}
                  aria-pressed={active}
                  className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors font-sora ${
                    active
                      ? 'border-[#7A5C3E] bg-[#7A5C3E] text-white shadow-sm'
                      : 'border-[#E8E2D9] bg-white text-[#6B5E55] hover:border-[#A6815C] hover:text-[#2B2622]'
                  }`}
                >
                  {m || 'Todos'}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Carrossel Horizontal Interativo */}
        <FilamentCarousel filaments={visible} storeWhatsapp={storeWhatsapp} />

        <div className="mt-12 flex justify-center">
          <Link
            href="/filamentos"
            onClick={() => track('click_filamento', { origem: 'home_ver_mais' })}
            className="inline-flex items-center gap-3 rounded-full bg-brand-espresso px-8 py-4 text-sm font-extrabold font-sora text-white shadow-xl shadow-brand-espresso/20 transition-all duration-300 hover:bg-brand-taupe hover:scale-[1.02] active:scale-[0.98] border border-white/10 group"
          >
            <span>Ver catálogo de filamentos</span>
            <ArrowRight className="h-4 w-4 text-brand-bronze transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
