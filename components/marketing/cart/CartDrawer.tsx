'use client';

/**
 * Floating cart button + drawer with the WhatsApp checkout.
 *
 * Flow: items → name + WhatsApp → POST /api/v1/public/filament-orders → the
 * server prices the cart, stores the order and returns a wa.me link with the
 * order message → the drawer clears the cart and opens that link.
 * Prices shown here are a preview; the server never reads them.
 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ShoppingBag, X, Minus, Plus, Trash2, Loader2, CheckCircle2, MessageCircle, QrCode, CreditCard, Copy, Check } from 'lucide-react';
import { formatBRL } from '@/lib/pricing/pro-plans';
import { PIX_KEY } from '@/lib/pix/config';
import {
  buildOrderBody,
  cartSubtotal,
  interpretOrderError,
  parseOrderSuccess,
  validateCheckout,
  CART_MAX_QTY,
} from '@/lib/storefront/cart';
import { track } from '@/lib/analytics/track';
import { useCart } from './CartProvider';
import { SpoolSwatch } from '@/components/marketing/filaments/FilamentVisuals';

type Phase = 'cart' | 'sending' | 'done';

const INPUT =
  'mt-1.5 w-full rounded-xl border border-[#E8E2D9] bg-white px-3.5 py-2.5 text-sm font-medium text-[#2B2622] outline-none transition-colors placeholder:text-[#B5AA9D] focus:border-[#A6815C] focus:ring-2 focus:ring-[#A6815C]/25';

export default function CartDrawer() {
  const cart = useCart();
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('cart');
  const [error, setError] = useState<string | null>(null);
  const [badIds, setBadIds] = useState<string[]>([]);
  const [done, setDone] = useState<{ shortId: string; whatsappUrl: string; totalCents: number } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'whatsapp'>('pix');
  const [copiedPix, setCopiedPix] = useState(false);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [notes, setNotes] = useState('');
  const startedAt = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const { isOpen, setOpen, state, count } = cart;
  const subtotal = cartSubtotal(state);


  // Opening the drawer with items = the checkout started (fill time starts here).
  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    if (state.items.length > 0 && startedAt.current === null) {
      startedAt.current = performance.now();
      track('start_checkout', { itens: state.items.length });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, state.items.length, setOpen]);

  function close() {
    setOpen(false);
    if (phase === 'done') {
      setPhase('cart');
      setDone(null);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const website = String(form.get('website') ?? '');
    const invalid = validateCheckout(state, { name, whatsapp });
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setBadIds([]);
    setPhase('sending');
    const elapsedMs = startedAt.current === null ? 0 : performance.now() - startedAt.current;

    const paymentTag =
      paymentMethod === 'pix'
        ? '[Pagamento: Pix Imediato]'
        : paymentMethod === 'card'
        ? '[Pagamento: Cartão de Crédito]'
        : '[Pagamento: A Combinar no WhatsApp]';
    const orderNotes = notes.trim() ? `${paymentTag} ${notes.trim()}` : paymentTag;

    try {
      const res = await fetch('/api/v1/public/filament-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildOrderBody(state, { name, whatsapp, notes: orderNotes, website, elapsedMs })),
      });
      const body: unknown = await res.json().catch((): null => null);
      if (res.status !== 201) {
        const view = interpretOrderError(res.status, body, res.headers.get('Retry-After'));
        setError(view.message);
        setBadIds(view.productIds);
        setPhase('cart');
        return;
      }
      const okBody = parseOrderSuccess(body);
      if (!okBody) {
        setError('Pedido enviado, mas a resposta veio incompleta. Fale com a loja pelo WhatsApp.');
        setPhase('cart');
        return;
      }
      track('submit_filament_order', { itens: state.items.length, total_centavos: okBody.totalCents });
      cart.clear();
      startedAt.current = null;
      setNotes('');
      setDone(okBody);
      setPhase('done');
      // May be blocked as a popup (it runs after an await); the button below stays as the way out.
      window.open(okBody.whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? `Sem conexão: ${err.message}` : 'Sem conexão. Tente de novo.');
      setPhase('cart');
    }
  }

  return (
    <>


      <AnimatePresence>
        {isOpen ? (
          <div className="fixed inset-0 z-[70]" key="cart-drawer">
            <motion.div
              className="absolute inset-0 bg-[#2B2622]/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              aria-hidden
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="cart-title"
              className="marketing-root absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-[#FAF9F6] shadow-2xl"
              initial={reduced ? { opacity: 0 } : { x: '100%' }}
              animate={reduced ? { opacity: 1 } : { x: 0 }}
              exit={reduced ? { opacity: 0 } : { x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            >
              <header className="flex items-center justify-between border-b border-[#E8E2D9] px-6 py-5">
                <div>
                  <span className="block text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#7A5C3E]">
                    Pedido pelo WhatsApp
                  </span>
                  <h2 id="cart-title" className="font-sora text-xl font-black text-[#2B2622]">
                    Seu carrinho
                  </h2>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={close}
                  aria-label="Fechar carrinho"
                  className="rounded-full p-2 text-[#6B5E55] transition-colors hover:bg-[#E8E2D9]/70 hover:text-[#2B2622]"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              {phase === 'done' && done ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-8 py-6 text-center">
                  <CheckCircle2 className="h-14 w-14 text-[#6F7F52]" />
                  <h3 className="font-sora text-2xl font-black text-[#2B2622]">Pedido #{done.shortId} registrado</h3>
                  <p className="text-sm leading-relaxed text-[#6B5E55]">
                    Seu pedido foi registrado no sistema com sucesso. A loja confirma os detalhes pelo WhatsApp.
                  </p>

                  {paymentMethod === 'pix' ? (
                    <div className="w-full rounded-2xl border border-[#E8E2D9] bg-white p-4 text-left shadow-sm">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#7A5C3E]">
                        <QrCode className="h-4 w-4" /> Pagamento Pix Imediato
                      </div>
                      <p className="mt-1 text-xs text-[#6B5E55]">
                        Total do pedido: <strong className="text-[#2B2622]">{formatBRL(done.totalCents)}</strong>
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[#E8E2D9] bg-[#FAF9F6] p-2.5">
                        <span className="truncate font-mono text-xs font-semibold text-[#2B2622]">
                          {PIX_KEY || 'contato@gltech3d.com.br'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(PIX_KEY || 'contato@gltech3d.com.br');
                            setCopiedPix(true);
                            setTimeout(() => setCopiedPix(false), 2500);
                          }}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2B2622] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#7A5C3E]"
                        >
                          {copiedPix ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedPix ? 'Copiado!' : 'Copiar Chave'}
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-[#6B5E55]">
                        Ao abrir o WhatsApp, envie o comprovante de pagamento para liberação ágil.
                      </p>
                    </div>
                  ) : paymentMethod === 'card' ? (
                    <div className="w-full rounded-2xl border border-[#E8E2D9] bg-white p-4 text-left shadow-sm">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#7A5C3E]">
                        <CreditCard className="h-4 w-4" /> Pagamento com Cartão
                      </div>
                      <p className="mt-1 text-xs text-[#6B5E55]">
                        A loja fornecerá o link seguro para pagamento via cartão de crédito diretamente na conversa do WhatsApp.
                      </p>
                    </div>
                  ) : null}

                  <a
                    href={done.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-6 py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#1EBE5A]"
                  >
                    <MessageCircle className="h-5 w-5" />
                    Abrir conversa no WhatsApp
                  </a>
                </div>
              ) : state.items.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
                  <SpoolSwatch hex="#E8E2D9" label="Carrinho vazio" size={72} />
                  <p className="text-sm text-[#6B5E55]">Seu carrinho está vazio.</p>
                  <Link
                    href="/filamentos"
                    onClick={close}
                    className="rounded-xl bg-[#7A5C3E] px-5 py-3 text-sm font-bold text-white hover:bg-[#2B2622]"
                  >
                    Ver filamentos
                  </Link>
                </div>
              ) : (
                <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
                  <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
                    {state.items.map((i) => {
                      const bad = badIds.includes(i.productId);
                      return (
                        <li
                          key={i.productId}
                          className={`flex gap-3 rounded-2xl border bg-white p-3 ${
                            bad ? 'border-[#B4553F] ring-2 ring-[#B4553F]/20' : 'border-[#E8E2D9]'
                          }`}
                        >
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#F4F1EA]">
                            {i.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={i.image} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center">
                                <SpoolSwatch hex={i.colorHex} label={i.name} size={44} />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/filamentos/${encodeURIComponent(i.slug)}`}
                              onClick={close}
                              className="line-clamp-2 text-sm font-bold leading-snug text-[#2B2622] hover:text-[#7A5C3E]"
                            >
                              {i.name}
                            </Link>
                            <p className="mt-0.5 text-xs text-[#6B5E55]">
                              {i.priceCents ? `${formatBRL(i.priceCents)} cada` : 'Preço sob consulta'}
                            </p>
                            {bad ? (
                              <p className="mt-1 text-[11px] font-bold text-[#8A3B2B]">Indisponível — remova para continuar.</p>
                            ) : null}
                            <div className="mt-2 flex items-center justify-between">
                              <div className="inline-flex items-center rounded-lg border border-[#E8E2D9]">
                                <button
                                  type="button"
                                  onClick={() => cart.setQty(i.productId, i.qty - 1)}
                                  disabled={i.qty <= 1}
                                  aria-label={`Diminuir ${i.name}`}
                                  className="p-1.5 text-[#6B5E55] disabled:opacity-30"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-8 text-center text-sm font-bold tabular-nums" aria-live="polite">
                                  {i.qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => cart.setQty(i.productId, i.qty + 1)}
                                  disabled={i.qty >= CART_MAX_QTY}
                                  aria-label={`Aumentar ${i.name}`}
                                  className="p-1.5 text-[#6B5E55] disabled:opacity-30"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  cart.remove(i.productId);
                                  setBadIds((ids) => ids.filter((x) => x !== i.productId));
                                }}
                                aria-label={`Remover ${i.name}`}
                                className="rounded-lg p-1.5 text-[#B5AA9D] transition-colors hover:bg-[#F3E6E2] hover:text-[#8A3B2B]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="space-y-4 border-t border-[#E8E2D9] bg-white px-6 py-5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-bold text-[#2B2622]">Subtotal</span>
                      <span className="font-sora text-2xl font-black text-[#2B2622]">{formatBRL(subtotal.cents)}</span>
                    </div>
                    <p className="-mt-2 text-[11px] leading-relaxed text-[#6B5E55]">
                      Estimativa. A loja confirma o valor final{subtotal.hasUnpriced ? ' (há item sem preço)' : ''} e
                      combina o frete pelo WhatsApp.
                    </p>

                    <div>
                      <span className="mb-1.5 block text-xs font-bold text-[#2B2622]">Forma de pagamento</span>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('pix')}
                          className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2 text-xs font-bold transition-all ${
                            paymentMethod === 'pix'
                              ? 'border-[#7A5C3E] bg-[#7A5C3E]/10 text-[#7A5C3E] shadow-sm'
                              : 'border-[#E8E2D9] bg-white text-[#6B5E55] hover:border-[#7A5C3E]/40'
                          }`}
                        >
                          <QrCode className="h-4 w-4" />
                          <span>Pix</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('card')}
                          className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2 text-xs font-bold transition-all ${
                            paymentMethod === 'card'
                              ? 'border-[#7A5C3E] bg-[#7A5C3E]/10 text-[#7A5C3E] shadow-sm'
                              : 'border-[#E8E2D9] bg-white text-[#6B5E55] hover:border-[#7A5C3E]/40'
                          }`}
                        >
                          <CreditCard className="h-4 w-4" />
                          <span>Cartão</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('whatsapp')}
                          className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2 text-xs font-bold transition-all ${
                            paymentMethod === 'whatsapp'
                              ? 'border-[#7A5C3E] bg-[#7A5C3E]/10 text-[#7A5C3E] shadow-sm'
                              : 'border-[#E8E2D9] bg-white text-[#6B5E55] hover:border-[#7A5C3E]/40'
                          }`}
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span>WhatsApp</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs font-bold text-[#2B2622]">
                        Seu nome
                        <input
                          name="customer_name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          autoComplete="name"
                          required
                          maxLength={120}
                          className={INPUT}
                        />
                      </label>
                      <label className="block text-xs font-bold text-[#2B2622]">
                        WhatsApp
                        <input
                          name="customer_whatsapp"
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(e.target.value)}
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="(31) 99999-9999"
                          required
                          maxLength={40}
                          className={INPUT}
                        />
                      </label>
                    </div>
                    <label className="block text-xs font-bold text-[#2B2622]">
                      Observações <span className="font-medium text-[#6B5E55]">(opcional)</span>
                      <textarea
                        name="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        maxLength={1000}
                        placeholder="CEP para o frete, retirada em BH…"
                        className={`${INPUT} resize-none`}
                      />
                    </label>
                    {/* Honeypot: invisible for people, filled by bots. */}
                    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                      <label>
                        Site
                        <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
                      </label>
                    </div>

                    {error ? (
                      <p role="alert" className="rounded-xl border border-[#E7CFC8] bg-[#F3E6E2] px-3.5 py-2.5 text-xs font-semibold text-[#8A3B2B]">
                        {error}
                      </p>
                    ) : null}

                    <button
                      type="submit"
                      disabled={phase === 'sending'}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-4 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#1EBE5A] disabled:opacity-70"
                    >
                      {phase === 'sending' ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-5 w-5" />}
                      {phase === 'sending' ? 'Registrando pedido…' : 'Finalizar pelo WhatsApp'}
                    </button>
                  </div>
                </form>
              )}
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
