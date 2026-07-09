"use client";

import * as React from "react";
import { type PaletteId } from "@/app/design/lib/tokens";
import {
  applyPaletteVars,
  DEFAULT_PALETTE,
  PALETTE_STORAGE_KEY,
  PALETTE_IDS,
} from "@/lib/theme-vars";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "deskcomm-theme";

type ThemeContextValue = {
  /** User preference: light, dark, or system. */
  theme: Theme;
  /** Effective theme applied to the DOM (system collapsed to light/dark). */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  /** Accent palette (sage, clay, mist, plum, olive). */
  palette: PaletteId;
  setPalette: (palette: PaletteId) => void;
};

function readStoredPalette(): PaletteId {
  if (typeof window === "undefined") return DEFAULT_PALETTE;
  try {
    const v = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    if (v && (PALETTE_IDS as string[]).includes(v)) return v as PaletteId;
  } catch {
    // localStorage indisponível — segue com default.
  }
  return DEFAULT_PALETTE;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // localStorage indisponível (modo privado, sandbox) — segue com default.
  }
  return "system";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lê do storage no primeiro render do client (não causa hydration mismatch
  // porque o inline script no layout já setou o data-theme antes do paint).
  const [theme, setThemeState] = React.useState<Theme>(() => readStoredTheme());
  const [palette, setPaletteState] = React.useState<PaletteId>(() => readStoredPalette());
  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme>(() =>
    getSystemTheme(),
  );

  // Listener pra mudanças do prefers-color-scheme.
  React.useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme;

  // Aplica no DOM sempre que o tema efetivo muda.
  React.useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  // Reaplica as CSS vars da paleta quando paleta OU tema efetivo muda
  // (light e dark têm valores diferentes por paleta).
  React.useEffect(() => {
    applyPaletteVars(palette, resolvedTheme);
  }, [palette, resolvedTheme]);

  const setPalette = React.useCallback((next: PaletteId) => {
    setPaletteState(next);
    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, next);
    } catch {
      // Persistência opcional — falha silenciosamente.
    }
  }, []);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persistência opcional — falha silenciosamente.
    }
  }, []);

  const toggle = React.useCallback(() => {
    setThemeState((current) => {
      const currentResolved =
        current === "system" ? getSystemTheme() : current;
      const next: Theme = currentResolved === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme, toggle, palette, setPalette }),
    [theme, resolvedTheme, setTheme, toggle, palette, setPalette],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within <ThemeProvider>");
  }
  return ctx;
}
