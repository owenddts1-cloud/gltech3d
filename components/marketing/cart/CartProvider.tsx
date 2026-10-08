'use client';

/**
 * Cart of the public filament catalog. React context + localStorage
 * (`gl_cart_v1`). Mounted once in the marketing layout, so the cart survives
 * navigation between the home, /filamentos and a filament page.
 *
 * Storage is a convenience: private windows and blocked storage throw, and the
 * cart then just lives in memory for the visit.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  CART_STORAGE_KEY,
  EMPTY_CART,
  cartCount,
  cartReducer,
  parseStoredCart,
  serializeCart,
  type CartItem,
  type CartState,
} from '@/lib/storefront/cart';
import { track } from '@/lib/analytics/track';

interface CartContextValue {
  state: CartState;
  count: number;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  add: (item: Omit<CartItem, 'qty'>, qty?: number, origem?: string) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    // Storage blocked (private mode / policy): the cart stays in memory.
    return null;
  }
}

/** false = not persisted (quota / blocked storage); the order still works from memory. */
function writeStorage(value: string): boolean {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, EMPTY_CART);
  const [isOpen, setOpen] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    dispatch({ type: 'hydrate', state: parseStoredCart(readStorage()) });
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    writeStorage(serializeCart(state));
  }, [state]);

  // Another tab changed the cart: follow it.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) dispatch({ type: 'hydrate', state: parseStoredCart(e.newValue) });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback((item: Omit<CartItem, 'qty'>, qty = 1, origem = 'catalogo') => {
    dispatch({ type: 'add', item, qty });
    track('add_to_cart', { produto: item.name, qtd: qty, origem });
  }, []);
  const setQty = useCallback((productId: string, qty: number) => dispatch({ type: 'setQty', productId, qty }), []);
  const remove = useCallback((productId: string) => dispatch({ type: 'remove', productId }), []);
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);

  const value = useMemo<CartContextValue>(
    () => ({ state, count: cartCount(state), isOpen, setOpen, add, setQty, remove, clear }),
    [state, isOpen, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}

/** Same as useCart, but null outside the provider (Live Preview of the Landing Edit). */
export function useOptionalCart(): CartContextValue | null {
  return useContext(CartContext);
}
