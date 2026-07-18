/**
 * Gera o mapa de CSS custom properties para uma paleta + modo (light/dark).
 * Fonte única de verdade: PALETTES em app/design/lib/tokens.ts.
 *
 * Usado em dois lugares:
 *  - runtime (ThemeProvider) ao trocar de paleta/tema;
 *  - inline no <head> (app/layout) pra aplicar a paleta antes do primeiro paint
 *    (evita flash de cor ao recarregar com paleta != default).
 */

import { PALETTES, type PaletteId } from "@/app/design/lib/tokens";

export type ResolvedMode = "light" | "dark";

export const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];
export const DEFAULT_PALETTE: PaletteId = "electric";
export const PALETTE_STORAGE_KEY = "gltech-palette";

const SCALE_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

export function paletteVars(id: PaletteId, mode: ResolvedMode): Record<string, string> {
  const p = PALETTES[id] ?? PALETTES[DEFAULT_PALETTE];
  const n = mode === "light" ? p.neutralLight : p.neutralDark;
  const s = mode === "light" ? p.surfaces.light : p.surfaces.dark;
  const st = mode === "light" ? p.states.light : p.states.dark;
  // Acento pode variar por modo (ex.: Elétrico = roxo no claro, ciano no escuro).
  const a = mode === "dark" ? (p.accentDark ?? p.accent) : p.accent;

  const vars: Record<string, string> = {
    "--color-bg": s.bg,
    "--color-surface": s.surface,
    "--color-surface-elevated": s.surfaceElevated,
    "--color-text": s.text,
    "--color-text-muted": s.textMuted,
    // n[500] (não n[400]) no light: n[400] dava ~2.3:1 sobre branco (ilegível).
    // n[500] sobe para ~4.6:1 mantendo a hierarquia (mais claro que o muted).
    "--color-text-subtle": mode === "light" ? n[500] : n[300],
    "--color-border": s.border,
    "--color-border-strong": mode === "light" ? n[300] : n[600],
    "--color-accent": mode === "light" ? a[600] : a[500],
    "--color-accent-fg": "#ffffff",
    "--color-accent-soft": mode === "light" ? a[100] : a[900],
    "--color-accent-hover": mode === "light" ? a[700] : a[400],
    "--color-success": st.success,
    "--color-success-bg": `color-mix(in srgb, ${st.success} 14%, transparent)`,
    "--color-success-fg": st.success,
    "--color-warning": st.warning,
    "--color-warning-bg": `color-mix(in srgb, ${st.warning} 14%, transparent)`,
    "--color-warning-fg": st.warning,
    "--color-error": st.error,
    "--color-error-bg": `color-mix(in srgb, ${st.error} 14%, transparent)`,
    "--color-error-fg": st.error,
    "--color-info": st.info,
    "--color-info-bg": `color-mix(in srgb, ${st.info} 14%, transparent)`,
    "--color-info-fg": st.info,
  };

  for (const k of SCALE_STOPS) {
    vars[`--color-accent-${k}`] = a[k];
    vars[`--color-neutral-${k}`] = n[k];
  }
  return vars;
}

/** Aplica o mapa de vars no <html> (client-side). */
export function applyPaletteVars(id: PaletteId, mode: ResolvedMode): void {
  if (typeof document === "undefined") return;
  const vars = paletteVars(id, mode);
  const style = document.documentElement.style;
  for (const [k, v] of Object.entries(vars)) style.setProperty(k, v);
  document.documentElement.setAttribute("data-palette", id);
}

/** Metadados leves p/ a UI do trocador (nome + swatch). */
export function paletteMeta(): { id: PaletteId; name: string; description: string; swatch: string }[] {
  return PALETTE_IDS.map((id) => ({
    id,
    name: PALETTES[id].name,
    description: PALETTES[id].description,
    swatch: PALETTES[id].accent[600],
  }));
}

/** Mapa completo (todas as paletas × light/dark) — serializado no inline script. */
export function allPaletteVars(): Record<string, { light: Record<string, string>; dark: Record<string, string> }> {
  const out: Record<string, { light: Record<string, string>; dark: Record<string, string> }> = {};
  for (const id of PALETTE_IDS) {
    out[id] = { light: paletteVars(id, "light"), dark: paletteVars(id, "dark") };
  }
  return out;
}
