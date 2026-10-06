/**
 * Keyed leading+trailing throttle for realtime-triggered refetches.
 *
 * Realtime channels are public, so anyone who knows an org id can flood one
 * with fake "changed" signals. Each signal only triggers a refetch through the
 * authenticated API (no data comes from the payload), but an unthrottled flood
 * would turn every open tab into a refetch storm. This caps it at one run per
 * key per `intervalMs`: the first signal runs immediately, the burst after it
 * collapses into ONE trailing run at the end of the window (so the last real
 * change is never lost).
 */
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

export const REALTIME_INVALIDATE_INTERVAL_MS = 2_000;

export interface KeyedThrottle {
  run: (key: string, fn: () => void) => void;
  cancelAll: () => void;
}

interface Slot {
  lastRun: number;
  timer: ReturnType<typeof setTimeout> | null;
  pending: (() => void) | null;
}

export function createKeyedThrottle(
  intervalMs: number,
  now: () => number = () => Date.now(),
): KeyedThrottle {
  const slots = new Map<string, Slot>();

  const run = (key: string, fn: () => void): void => {
    let slot = slots.get(key);
    if (!slot) {
      slot = { lastRun: Number.NEGATIVE_INFINITY, timer: null, pending: null };
      slots.set(key, slot);
    }
    const elapsed = now() - slot.lastRun;
    if (!slot.timer && elapsed >= intervalMs) {
      slot.lastRun = now();
      fn();
      return;
    }
    slot.pending = fn;
    if (slot.timer) return;
    const owned = slot;
    owned.timer = setTimeout(() => {
      owned.timer = null;
      const pending = owned.pending;
      owned.pending = null;
      if (pending) {
        owned.lastRun = now();
        pending();
      }
    }, Math.max(0, intervalMs - elapsed));
  };

  const cancelAll = (): void => {
    for (const slot of slots.values()) {
      if (slot.timer) clearTimeout(slot.timer);
    }
    slots.clear();
  };

  return { run, cancelAll };
}

/**
 * `invalidate(queryKey)` throttled per query key (default: once per 2s).
 * Timers are cleared on unmount.
 */
export function useThrottledInvalidate(
  intervalMs: number = REALTIME_INVALIDATE_INTERVAL_MS,
): (queryKey: QueryKey) => void {
  const qc = useQueryClient();
  const throttle = useMemo(() => createKeyedThrottle(intervalMs), [intervalMs]);

  useEffect(() => () => throttle.cancelAll(), [throttle]);

  return useMemo(
    () => (queryKey: QueryKey) => {
      throttle.run(JSON.stringify(queryKey), () => {
        void qc.invalidateQueries({ queryKey });
      });
    },
    [qc, throttle],
  );
}
