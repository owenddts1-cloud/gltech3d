'use client';

import Link from 'next/link';
import { Plus, Check, BellRing } from 'lucide-react';
import { useState } from 'react';
import type { PublicFilament } from '@/lib/filament-catalog/types';
import { formatBRL } from '@/lib/pricing/pro-plans';
import { storeWhatsappUrl } from '@/lib/landing/whatsapp-number';
import { filamentSpecLine, notifyBackMessage, swatchLabel } from '@/lib/storefront/filaments';
import { track } from '@/lib/analytics/track';
import { useOptionalCart } from '@/components/marketing/cart/CartProvider';
import { AvailabilityBadge, SpoolSwatch } from './FilamentVisuals';

/** Cart line snapshot of a filament (display only — the server prices the order). */
export function toCartItem(f: PublicFilament) {
  return {
    productId: f.id,
    slug: f.slug,
    name: f.name,
    priceCents: f.priceCents,
    image: f.images[0] ?? null,
    colorHex: f.colorHex,
  };
}

/** Photo, or a large spool swatch on a "spec card" background when there is none. */
export function FilamentMedia({ f, sizes = 'card' }: { f: PublicFilament; sizes?: 'card' | 'hero' }) {
  const photo = f.images[0];
  if (photo) {
    return (
      // Storage photos of variable size: plain <img> (next/image optimizer is off in this app).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={f.name}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
      />
    );
  }
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background:
          'linear-gradient(transparent 23px, rgba(166,129,92,0.10) 24px), linear-gradient(90deg, transparent 23px, rgba(166,129,92,0.10) 24px), #F4F1EA',
        backgroundSize: '24px 24px',
      }}
    >
      <SpoolSwatch
        hex={f.colorHex}
        label={swatchLabel(f)}
        size={sizes === 'hero' ? 220 : 112}
        className="transition-transform duration-700 ease-out group-hover:rotate-[24deg]"
      />
      {f.colorHex ? (
        <span className="absolute bottom-3 right-3 rounded-md bg-white/85 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-bronze-ink">
          {f.colorHex}
        </span>
      ) : null}
    </div>
  );
}

export function FilamentCard({
  f,
  storeWhatsapp,
  origem,
}: {
  f: PublicFilament;
  storeWhatsapp: string;
  /** Where the card is rendered (analytics). */
  origem: string;
}) {
  const cart = useOptionalCart();
  const [added, setAdded] = useState(false);
  const href = `/filamentos/${encodeURIComponent(f.slug)}`;
  const eyebrow = [f.materialName, f.line].filter(Boolean).join(' · ');
  const canBuy = f.orderable && f.priceCents != null && f.priceCents > 0 && cart !== null;

  function onAdd() {
    if (!cart) return;
    cart.add(toCartItem(f), 1, origem);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[#E8E2D9] bg-white shadow-[0_1px_0_rgba(43,38,34,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-24px_rgba(43,38,34,0.35)]">
      <Link
        href={href}
        onClick={() => track('click_filamento', { origem, produto: f.name })}
        className="relative block aspect-[4/3] overflow-hidden"
        aria-label={`Ver ${f.name}`}
      >
        <FilamentMedia f={f} />
        <AvailabilityBadge
          availability={f.availability}
          label={f.availabilityLabel}
          className="absolute left-3 top-3 shadow-sm"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-1 px-5 pb-5 pt-4">
        {eyebrow ? (
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-bronze-ink">{eyebrow}</span>
        ) : null}
        <h3 className="font-sora text-base font-black leading-snug text-brand-espresso">
          <Link href={href} className="hover:text-brand-bronze-deep">
            {f.name}
          </Link>
        </h3>
        <p className="text-xs text-brand-taupe">
          {f.brand ? <span className="font-semibold text-[#4E443C]">{f.brand} · </span> : null}
          {filamentSpecLine(f)}
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            {f.priceCents != null && f.priceCents > 0 ? (
              <span className="font-sora text-xl font-black tracking-tight text-brand-espresso">
                {formatBRL(f.priceCents)}
              </span>
            ) : (
              <span className="text-xs font-bold text-brand-taupe">Preço sob consulta</span>
            )}
          </div>

          {f.availability === 'esgotado' ? (
            <a
              href={storeWhatsappUrl(storeWhatsapp, notifyBackMessage(f.name))}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('click_whatsapp', { origem: 'filamento_me_avise', produto: f.name })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8E2D9] px-3 py-2 text-[11px] font-bold text-[#7A5C3E] transition-colors hover:border-[#A6815C] hover:bg-[#F9F7F2]"
            >
              <BellRing className="h-3.5 w-3.5" />
              Volta em breve · Me avise
            </a>
          ) : canBuy ? (
            <button
              type="button"
              onClick={onAdd}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all ${
                added ? 'bg-[#6F7F52]' : 'bg-[#7A5C3E] hover:bg-[#2B2622]'
              }`}
              aria-live="polite"
            >
              {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {added ? 'Adicionado' : 'Adicionar'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
