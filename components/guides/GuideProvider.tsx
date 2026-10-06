"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { canSeeGuide } from "@/lib/guides/permissions";
import {
  WELCOME_GUIDE,
  autoGuideFor,
  guideById,
  guideForPath,
  normalizePath,
} from "@/lib/guides/registry";
import { clearSeen, readSeen, writeSeen } from "@/lib/guides/storage";
import type { GuideAction, GuideEntry } from "@/lib/guides/types";
import { GuidePanel } from "./GuidePanel";
import { GuideCenter } from "./GuideCenter";

export interface GuideContextValue {
  /** Guide shown in the panel. Kept after closing so the exit animation has content. */
  current: GuideEntry | null;
  isOpen: boolean;
  /** Guide of the current route (null when the route has none). */
  pathGuide: GuideEntry | null;
  seen: ReadonlySet<string>;
  /** `true` once the seen list was read (avoids flashing "unseen" markers). */
  ready: boolean;
  /** Opens a guide by id, or the current route's guide (welcome as fallback). */
  openGuide: (id?: string) => void;
  close: () => void;
  /** Forgets every seen guide and reopens the current screen's guide. */
  resetAll: () => void;
  centerOpen: boolean;
  openCenter: () => void;
  closeCenter: () => void;
}

const GuideContext = createContext<GuideContextValue | null>(null);

export function useGuides(): GuideContextValue {
  const ctx = useContext(GuideContext);
  if (!ctx) throw new Error("useGuides must be used inside <GuideProvider>");
  return ctx;
}

/** Same as `useGuides`, but `null` outside the provider (shell pieces reused elsewhere). */
export function useOptionalGuides(): GuideContextValue | null {
  return useContext(GuideContext);
}

/** Lets the page paint before a guide slides in on first visit. */
export const AUTO_OPEN_DELAY_MS = 600;

export function GuideProvider({
  children,
  autoOpenDelayMs = AUTO_OPEN_DELAY_MS,
}: {
  children: ReactNode;
  autoOpenDelayMs?: number;
}) {
  const pathname = usePathname();
  const { user, activeOrg } = useAuth();
  const userId = user.id;
  const role = activeOrg?.role ?? null;
  const isPlatformAdmin = user.is_platform_admin ?? false;

  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState<GuideEntry | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [centerOpen, setCenterOpen] = useState(false);

  // Refs mirror state for the delayed auto-open callback, which must see the
  // latest values without re-running the route effect.
  const seenRef = useRef<ReadonlySet<string>>(seen);
  const busyRef = useRef(false);
  const skipNextAutoOpenRef = useRef(false);

  useEffect(() => {
    busyRef.current = isOpen || centerOpen;
  }, [isOpen, centerOpen]);

  // Read after mount: storage is client-only, reading it during render would
  // make the server HTML disagree with the first client paint.
  useEffect(() => {
    // `null` = storage unavailable. Memory takes over for this session, so a
    // guide closed once is not shown again until the next full page load.
    const stored = readSeen(userId) ?? new Set<string>();
    seenRef.current = stored;
    setSeen(stored);
    setReady(true);
  }, [userId]);

  // Auto-open runs on route changes only (not when `seen` changes): closing the
  // welcome guide must not immediately stack the screen guide on top of it.
  useEffect(() => {
    if (!ready) return;
    if (skipNextAutoOpenRef.current) {
      // Navigation triggered by the guide's own "Começar" button.
      skipNextAutoOpenRef.current = false;
      return;
    }
    const target = autoGuideFor(pathname, seenRef.current);
    if (!target) return;
    const timer = window.setTimeout(() => {
      if (busyRef.current || seenRef.current.has(target.id)) return;
      setCurrent(target);
      setIsOpen(true);
    }, autoOpenDelayMs);
    return () => window.clearTimeout(timer);
  }, [pathname, ready, autoOpenDelayMs]);

  const markSeen = useCallback(
    (id: string) => {
      if (seenRef.current.has(id)) return;
      const next = new Set(seenRef.current);
      next.add(id);
      seenRef.current = next;
      setSeen(next);
      // A failed write is acceptable: the in-memory set already prevents the
      // guide from auto-opening again in this session.
      writeSeen(userId, next);
    },
    [userId],
  );

  const pathGuide = useMemo(() => guideForPath(pathname), [pathname]);

  const openGuide = useCallback(
    (id?: string) => {
      const guide = id ? guideById(id) : (guideForPath(pathname) ?? WELCOME_GUIDE);
      if (!guide) return;
      setCenterOpen(false);
      setCurrent(guide);
      setIsOpen(true);
    },
    [pathname],
  );

  const close = useCallback(() => {
    if (current) markSeen(current.id);
    setIsOpen(false);
  }, [current, markSeen]);

  const handleAction = useCallback(
    (action: GuideAction) => {
      // The link navigates by itself. Skip the auto-open on the destination so
      // another guide does not pop up right after the user chose to act.
      if (action.href && normalizePath(action.href) !== normalizePath(pathname ?? "")) {
        skipNextAutoOpenRef.current = true;
      }
      close();
    },
    [close, pathname],
  );

  const resetAll = useCallback(() => {
    // Memory is reset even if storage refuses the delete.
    clearSeen(userId);
    const empty = new Set<string>();
    seenRef.current = empty;
    setSeen(empty);
    openGuide();
  }, [openGuide, userId]);

  const openCenter = useCallback(() => setCenterOpen(true), []);
  const closeCenter = useCallback(() => setCenterOpen(false), []);

  const value = useMemo<GuideContextValue>(
    () => ({
      current,
      isOpen,
      pathGuide,
      seen,
      ready,
      openGuide,
      close,
      resetAll,
      centerOpen,
      openCenter,
      closeCenter,
    }),
    [current, isOpen, pathGuide, seen, ready, openGuide, close, resetAll, centerOpen, openCenter, closeCenter],
  );

  return (
    <GuideContext.Provider value={value}>
      {children}
      <GuidePanel guide={current} open={isOpen} onClose={close} onAction={handleAction} />
      <GuideCenter
        open={centerOpen}
        onClose={closeCenter}
        seen={seen}
        onOpenGuide={openGuide}
        currentGuideId={pathGuide?.id ?? null}
        isVisible={(g) => canSeeGuide(g, role, { isPlatformAdmin })}
      />
    </GuideContext.Provider>
  );
}
