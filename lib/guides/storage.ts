/**
 * Persistence of "which guides this user has already seen".
 *
 * Stored per user in `localStorage` (`guides:v1:<userId>`) as a JSON array of
 * guide ids. Storage can be unavailable (private window, blocked cookies,
 * quota): every function reports failure instead of throwing, and the provider
 * keeps an in-memory set so a guide never auto-opens twice in the same session.
 */

export const GUIDES_STORAGE_PREFIX = "guides:v1:";

/** Minimal storage surface, so tests can inject a fake. */
export type GuideStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function storageKey(userId: string): string {
  return `${GUIDES_STORAGE_PREFIX}${userId}`;
}

/** Accessing `window.localStorage` itself can throw (Safari with storage blocked). */
function defaultStorage(): GuideStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Storage blocked by the browser: the caller falls back to memory.
    return null;
  }
}

/** Validates the stored value. Anything unexpected becomes an empty list. */
export function parseSeen(raw: string | null): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupted value (manual edit, old format): start over instead of crashing.
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
}

/**
 * Reads the seen ids. Returns `null` when storage is unavailable, so the caller
 * can tell "nothing seen yet" apart from "cannot know".
 */
export function readSeen(
  userId: string,
  storage: GuideStorage | null = defaultStorage(),
): Set<string> | null {
  if (!storage) return null;
  try {
    return new Set(parseSeen(storage.getItem(storageKey(userId))));
  } catch {
    // getItem can throw on some locked-down browsers: report "unknown".
    return null;
  }
}

/** Writes the seen ids. Returns `false` when the write failed. */
export function writeSeen(
  userId: string,
  ids: Iterable<string>,
  storage: GuideStorage | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(storageKey(userId), JSON.stringify([...new Set(ids)].sort()));
    return true;
  } catch {
    // Quota exceeded or storage blocked: the in-memory set still holds the state.
    return false;
  }
}

/** Forgets every seen guide for the user. Returns `false` when it failed. */
export function clearSeen(
  userId: string,
  storage: GuideStorage | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(storageKey(userId));
    return true;
  } catch {
    // Same as writeSeen: memory is reset by the caller regardless.
    return false;
  }
}
