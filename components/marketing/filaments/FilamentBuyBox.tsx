'use client';

import { useState } from 'react';
import { Minus, Plus, ShoppingBag, Check, BellRing, MessageCircle } from 'lucide-react';
import type { PublicFilament } from '@/lib/filament-catalog/types';
import { formatBRL } from '@/lib/pricing/pro-plans';
import { storeWhatsappUrl } from '@/lib/landing/whatsapp-number';
import { clampQty, CART_MAX_QTY } from '@/lib/storefront/cart';
import { notifyBackMessage, pricePerKgCents } from '@/lib/storefront/filaments';
import { track } from '@/lib/analytics/track';
import { useOptionalCart } from '@/components/marketing/cart/CartProvider';
import { toCartItem } from './FilamentCard';
import { AvailabilityBadge } from './FilamentVisuals';

/** Price, availability, quantity stepper and "Adicionar ao carrinho" of a filament page. */
export default function FilamentBuyBox({ f, storeWhatsapp }: { f: PublicFilament; storeWhatsapp: string }) {
  const cart = useOptionalCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const hasPrice = f.priceCents != null && f.priceCents > 0;
  const perKg = pricePerKgCents(f);
  const canBuy = f.orderable && hasPrice && cart !== null;

  function add() {
    if (!cart) return;
    cart.add(toCartItem(f), qty, 'pagina_filamento');
    setAdded(true);
    window.setTimeout(() => {
      setAdded(false);
      cart.setOpen(true);
    }, 600);
  }

  return (
    <div className="rounded-[2rem] border border-[#E8E2D9] bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#7A5C3E]">Preço</span>
          {hasPrice ? (
            <>
              <p className="font-sora text-4xl font-black tracking-tight text-[#2B2622]">{formatBRL(f.priceCents ?? 0)}</p>
              {perKg != null && f.netWeightG !== 1000 ? (
                <p className="mt-1 text-xs text-[#6B5E55]">{formatBRL(perKg)} por kg</p>
              ) : null}
            </>
          ) : (
            <p className="mt-1 font-sora text-xl font-black text-[#2B2622]">Sob consulta</p>
          )}
        </div>
        <AvailabilityBadge availability={f.availability} label={f.availabilityLabel} />
      </div>

      {f.availability === 'esgotado' ? (
        <a
          href={storeWhatsappUrl(storeWhatsapp, notifyBackMessage(f.name))}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('click_whatsapp', { origem: 'filamento_me_avise', produto: f.name })}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#E8E2D9] py-4 text-sm font-bold text-[#7A5C3E] transition-colors hover:border-[#A6815C] hover:bg-[#F9F7F2]"
        >
          <BellRing className="h-5 w-5" />
          Volta em breve · Me avise no WhatsApp
        </a>
      ) : canBuy ? (
        <div className="mt-6 flex gap-3">
          <div className="inline-flex items-center rounded-2xl border border-[#E8E2D9]">
            <button
              type="button"
              onClick={() => setQty((q) => clampQty(q - 1))}
              disabled={qty <= 1}
              aria-label="Diminuir quantidade"
              className="p-3.5 text-[#6B5E55] disabled:opacity-30"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center font-bold tabular-nums" aria-live="polite" aria-label={`Quantidade ${qty}`}>
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => clampQty(q + 1))}
              disabled={qty >= CART_MAX_QTY}
              aria-label="Aumentar quantidade"
              className="p-3.5 text-[#6B5E55] disabled:opacity-30"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={add}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white shadow-md transition-colors ${
              added ? 'bg-[#6F7F52]' : 'bg-[#7A5C3E] hover:bg-[#2B2622]'
            }`}
          >
            {added ? <Check className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
            {added ? 'Adicionado' : 'Adicionar ao carrinho'}
          </button>
        </div>
      ) : (
        <a
          href={storeWhatsappUrl(storeWhatsapp, `Olá! Quero saber o preço do ${f.name}.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-4 text-sm font-bold text-white hover:bg-[#1EBE5A]"
        >
          <MessageCircle className="h-5 w-5" />
          Consultar no WhatsApp
        </a>
      )}

      <p className="mt-4 text-center text-[11px] leading-relaxed text-[#6B5E55]">
        {f.availability === 'sob_encomenda'
          ? 'Sob encomenda: a loja confirma o prazo pelo WhatsApp antes do pagamento.'
          : 'Você finaliza pelo WhatsApp: estoque, frete e pagamento são confirmados por lá.'}
      </p>
    </div>
  );
}
