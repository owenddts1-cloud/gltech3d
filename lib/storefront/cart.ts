/**
 * Public cart of the filament catalog: state, persistence parsing and the
 * POST /api/v1/public/filament-orders contract (body + error interpretation).
 *
 * Pure. The prices kept here are DISPLAY ONLY: the body never carries a price
 * and the server recomputes everything (lib/site-orders/core.ts).
 *
 * Limits are duplicated from lib/site-orders/core.ts on purpose (that module
 * pulls Zod into the client bundle of every marketing page); a unit test keeps
 * them equal.
 */

export const CART_STORAGE_KEY = "gl_cart_v1";
export const CART_MAX_ITEMS = 30;
export const CART_MAX_QTY = 99;

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  /** Snapshot for display; the server prices the order. */
  priceCents: number | null;
  image: string | null;
  colorHex: string | null;
  qty: number;
}

export interface CartState {
  items: CartItem[];
}

export const EMPTY_CART: CartState = { items: [] };

export type CartAction =
  | { type: "add"; item: Omit<CartItem, "qty">; qty?: number }
  | { type: "setQty"; productId: string; qty: number }
  | { type: "remove"; productId: string }
  | { type: "clear" }
  | { type: "hydrate"; state: CartState };

export function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return 1;
  return Math.min(CART_MAX_QTY, Math.max(1, Math.round(qty)));
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "add": {
      const qty = clampQty(action.qty ?? 1);
      const existing = state.items.find((i) => i.productId === action.item.productId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === action.item.productId
              ? { ...i, ...action.item, qty: clampQty(i.qty + qty) }
              : i,
          ),
        };
      }
      if (state.items.length >= CART_MAX_ITEMS) return state;
      return { items: [...state.items, { ...action.item, qty }] };
    }
    case "setQty":
      return {
        items: state.items.map((i) =>
          i.productId === action.productId ? { ...i, qty: clampQty(action.qty) } : i,
        ),
      };
    case "remove":
      return { items: state.items.filter((i) => i.productId !== action.productId) };
    case "clear":
      return EMPTY_CART;
    case "hydrate":
      return action.state;
  }
}

export function cartCount(state: CartState): number {
  return state.items.reduce((s, i) => s + i.qty, 0);
}

/** Display subtotal. Items without a price are left out (`hasUnpriced` tells the UI). */
export function cartSubtotal(state: CartState): { cents: number; hasUnpriced: boolean } {
  let cents = 0;
  let hasUnpriced = false;
  for (const i of state.items) {
    if (i.priceCents == null || i.priceCents <= 0) hasUnpriced = true;
    else cents += i.priceCents * i.qty;
  }
  return { cents, hasUnpriced };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/**
 * localStorage → state. Anything malformed (old version, hand-edited, another
 * site's key) is dropped item by item instead of crashing the page.
 */
export function parseStoredCart(raw: string | null): CartState {
  if (!raw) return EMPTY_CART;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupted storage is not an error for the visitor: start with an empty cart.
    return EMPTY_CART;
  }
  if (!isObj(parsed) || !Array.isArray(parsed.items)) return EMPTY_CART;
  const seen = new Set<string>();
  const items: CartItem[] = [];
  for (const it of parsed.items) {
    if (!isObj(it)) continue;
    const productId = strOrNull(it.productId);
    const name = strOrNull(it.name);
    if (!productId || !name || seen.has(productId)) continue;
    seen.add(productId);
    const price = typeof it.priceCents === "number" && Number.isFinite(it.priceCents) ? it.priceCents : null;
    items.push({
      productId,
      slug: strOrNull(it.slug) ?? productId,
      name,
      priceCents: price,
      image: strOrNull(it.image),
      colorHex: strOrNull(it.colorHex),
      qty: clampQty(typeof it.qty === "number" ? it.qty : 1),
    });
    if (items.length >= CART_MAX_ITEMS) break;
  }
  return { items };
}

export function serializeCart(state: CartState): string {
  return JSON.stringify({ items: state.items });
}

export interface CheckoutForm {
  name: string;
  whatsapp: string;
  notes: string;
  /** Honeypot value (hidden field). */
  website: string;
  elapsedMs: number;
}

/** Body of POST /api/v1/public/filament-orders (snake_case, no prices). */
export function buildOrderBody(state: CartState, form: CheckoutForm) {
  const notes = form.notes.trim();
  return {
    customer_name: form.name.trim(),
    customer_whatsapp: form.whatsapp.trim(),
    items: state.items.map((i) => ({ product_id: i.productId, qty: i.qty })),
    ...(notes ? { notes } : {}),
    ...(form.website ? { website: form.website } : {}),
    elapsed_ms: Math.max(0, Math.round(form.elapsedMs)),
  };
}

/** Local validation before the request (the server validates again). */
export function validateCheckout(state: CartState, form: Pick<CheckoutForm, "name" | "whatsapp">): string | null {
  if (state.items.length === 0) return "O carrinho está vazio.";
  if (form.name.trim().length < 2) return "Informe seu nome.";
  const digits = form.whatsapp.replace(/\D/g, "");
  const ok =
    digits.length === 10 ||
    digits.length === 11 ||
    (digits.startsWith("55") && (digits.length === 12 || digits.length === 13));
  if (!ok) return "WhatsApp inválido. Use DDD + número.";
  return null;
}

const REFUSAL_MESSAGE: Record<string, string> = {
  item_not_found: "Um item do carrinho não está mais disponível no site. Atualize a página.",
  item_unavailable: "Um item do carrinho está esgotado. Remova-o para continuar.",
  item_without_price: "Um item do carrinho está sem preço. Fale com a loja pelo WhatsApp.",
};

export interface OrderErrorView {
  message: string;
  /** Cart items the server refused (to highlight in the drawer). */
  productIds: string[];
}

/** Error response of the order API → what the drawer shows. */
export function interpretOrderError(
  status: number,
  body: unknown,
  retryAfter: string | null,
): OrderErrorView {
  const err = isObj(body) && isObj(body.error) ? body.error : null;
  const code = typeof err?.code === "string" ? err.code : "";
  const details = isObj(err?.details) ? err.details : null;
  const ids = Array.isArray(details?.product_ids)
    ? details.product_ids.filter((x): x is string => typeof x === "string")
    : [];

  if (status === 429) {
    const secs = Number.parseInt(retryAfter ?? "", 10);
    const wait = Number.isFinite(secs) && secs > 0 ? ` Tente de novo em ${Math.ceil(secs / 60)} min.` : "";
    return { message: `Muitos pedidos seguidos deste aparelho.${wait}`, productIds: [] };
  }
  if (REFUSAL_MESSAGE[code]) return { message: REFUSAL_MESSAGE[code], productIds: ids };
  if (status === 422 || status === 400) {
    const msg = typeof err?.message === "string" && err.message ? err.message : "Confira os dados do pedido.";
    return { message: msg, productIds: ids };
  }
  if (status === 503) {
    return { message: "Pedidos pelo site estão indisponíveis agora. Fale com a loja pelo WhatsApp.", productIds: [] };
  }
  return { message: "Não consegui registrar o pedido. Tente de novo ou fale pelo WhatsApp.", productIds: [] };
}

/** `data` of a 201, validated loosely (never trust a body shape blindly). */
export function parseOrderSuccess(body: unknown): { shortId: string; whatsappUrl: string; totalCents: number } | null {
  const data = isObj(body) && isObj(body.data) ? body.data : null;
  if (!data) return null;
  const shortId = strOrNull(data.short_id);
  const whatsappUrl = strOrNull(data.whatsapp_url);
  if (!shortId || !whatsappUrl || !/^https:\/\/wa\.me\//.test(whatsappUrl)) return null;
  return { shortId, whatsappUrl, totalCents: typeof data.total_cents === "number" ? data.total_cents : 0 };
}
