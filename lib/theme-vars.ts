/**
 * Gera o mapa de CSS custom properties para uma paleta + modo (light/dark).
 * Fonte única de verdade: PALETTES em app/design/lib/tokens.ts.
 *
 * Usado em dois lugares:
 *  - runtime (ThemeProvider) ao trocar de paleta/tema;
 *  - inline no <head> (app/layout) pra aplicar a paleta antes do primeiro paint
 *    (evita flash de cor ao recarregar com paleta != default).
 */

import { PALETTES, type ColorScale, type PaletteId } from "@/app/design/lib/tokens";

export type ResolvedMode = "light" | "dark";

export const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];
/**
 * Padrão: neutro de alto contraste com o laranja da marca.
 *
 * Era `electric` (off-white azulado + roxo), que produzia a interface "cinza sem
 * contorno" — e cujo acento roxo não tem nada a ver com a GL TECH. `clay` usa
 * escala Zinc com laranja, era o padrão antes do commit 3374695, e é a que dá o
 * contraste mais alto entre as oito.
 */
export const DEFAULT_PALETTE: PaletteId = "clay";
export const PALETTE_STORAGE_KEY = "gltech-palette";

const SCALE_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/**
 * Estados semânticos, compartilhados por todas as paletas.
 *
 * Antes cada paleta trazia o seu par claro/escuro, e nenhum passava 4,5:1 no
 * modo claro (success e warning ficavam em ~3,1:1). Verde é verde: variar o tom
 * de "sucesso" por paleta não agrega significado e só multiplica por oito a
 * chance de errar o contraste. Os stops 700 no claro e 400 no escuro passam com
 * folga em qualquer superfície do sistema.
 */
const STATES_LIGHT = {
  success: "#166534",
  warning: "#854d0e",
  error: "#991b1b",
  info: "#1e40af",
} as const;

const STATES_DARK = {
  success: "#4ade80",
  warning: "#fbbf24",
  error: "#f87171",
  info: "#60a5fa",
} as const;

/** Luminância relativa (WCAG 2.1) de um hex `#rrggbb`. */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const ch = (i: number) => {
    const s = Number.parseInt(h.slice(i, i + 2), 16) / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
}

/**
 * Escolhe entre texto claro e escuro para ficar por cima de `bg`.
 *
 * Fixar `#ffffff` como cor do texto sobre o acento reprovava em qualquer paleta
 * de acento claro — branco sobre o laranja do modo escuro dava 2,9:1, e os
 * botões ficavam ilegíveis. Medir e escolher resolve para as 8 paletas de uma
 * vez, e continua correto se alguém adicionar a nona.
 */
function readableOn(bg: string, lightFg: string, darkFg: string): string {
  const l = luminance(bg);
  const withLight = (Math.max(l, luminance(lightFg)) + 0.05) / (Math.min(l, luminance(lightFg)) + 0.05);
  const withDark = (Math.max(l, luminance(darkFg)) + 0.05) / (Math.min(l, luminance(darkFg)) + 0.05);
  return withLight >= withDark ? lightFg : darkFg;
}

/** Mistura dois hex. `t` = quanto do segundo entra (0..1). */
function mix(base: string, tint: string, t: number): string {
  const parse = (h: string) => {
    const c = h.replace("#", "");
    return [0, 2, 4].map((i) => Number.parseInt(c.slice(i, i + 2), 16));
  };
  const [r1, g1, b1] = parse(base) as [number, number, number];
  const [r2, g2, b2] = parse(tint) as [number, number, number];
  const ch = (x: number, y: number) =>
    Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`;
}

function ratio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Escolhe, numa escala de neutros, o tom mais discreto que ainda atinge `min`
 * contra TODAS as superfícies onde ele pode cair (fundo, card e elevado).
 *
 * As escalas das 8 paletas são comprimidas e cada uma comprime num ponto
 * diferente — não existe um stop fixo (`n[500]`, `n[600]`…) que sirva para
 * todas. Escolher stop na mão foi justamente o que produziu `text-subtle` a
 * 3,76:1 numa paleta e idêntico a `text-muted` em outra. Aqui o contraste é
 * garantido por construção: percorre-se do mais discreto ao mais forte e para-se
 * no primeiro que passa. Devolve o índice para o chamador poder pedir "um tom
 * acima" e manter a hierarquia.
 */
type Stop = keyof ColorScale;

function pickStop(
  n: ColorScale,
  order: readonly Stop[],
  against: string[],
  min: number,
): { color: string; index: number } {
  for (let i = 0; i < order.length; i++) {
    const c = n[order[i]!];
    if (against.every((bg) => ratio(c, bg) >= min)) return { color: c, index: i };
  }
  // Escala sem nenhum tom suficiente: usa o extremo e deixa o teste acusar.
  const last = order.length - 1;
  return { color: n[order[last]!], index: last };
}

export function paletteVars(id: PaletteId, mode: ResolvedMode): Record<string, string> {
  const p = PALETTES[id] ?? PALETTES[DEFAULT_PALETTE];
  const light = mode === "light";
  const n = light ? p.neutralLight : p.neutralDark;
  const s = light ? p.surfaces.light : p.surfaces.dark;
  const st = light ? STATES_LIGHT : STATES_DARK;
  // Acento pode variar por modo (ex.: Elétrico = roxo no claro, ciano no escuro).
  const a = mode === "dark" ? (p.accentDark ?? p.accent) : p.accent;
  const accentBase = light ? a[700] : a[400];
  /**
   * Sidebar: escura nos dois modos e TINGIDA PELA PALETA.
   *
   * Antes usava a escala neutra escura (`neutralDark`), que no `clay` é zinc
   * puro — no tema escuro a rail ficava a 1,09:1 do fundo da página, ou seja,
   * um bloco só. Usando os tons mais profundos do ACENTO, escolher laranja dá
   * uma rail quente, escolher roxo dá uma rail roxa, e ela se separa do fundo
   * pelo matiz e não só pela luminância.
   */
  const ad = p.accentDark ?? p.accent;
  const nd = p.neutralDark;
  /**
   * Um neutro escuro TINGIDO com o acento — não o acento puro.
   *
   * `ad[950]` sozinho ficava entre 1,04:1 e 1,15:1 do fundo no tema escuro: a
   * rail encostava na página. Um neutro claro o bastante para se destacar, com
   * 16% do acento por cima, dá as duas coisas ao mesmo tempo — separação de
   * luminância e a cor da paleta visível.
   */
  const sidebarBg = mix(nd[700], ad[600], 0.16);
  const sidebarElevated = mix(nd[600], ad[600], 0.16);
  const sidebarBorder = mix(nd[500], ad[500], 0.18);
  /**
   * Texto da rail em 7:1, não nos 4,5:1 do mínimo legal. Item de menu é lido de
   * relance o dia inteiro; o piso da WCAG deixa a navegação apagada contra a
   * rail tingida. A cor ativa vem do acento, então a distância entre repouso e
   * ativo continua nítida.
   */
  const sidebarTextOrder: readonly Stop[] = [300, 200, 100, 50];
  const sidebarText = pickStop(nd, sidebarTextOrder, [sidebarBg], 7);

  // Todas as superfícies onde um texto secundário pode cair.
  const surfaces = [s.bg, s.surface, s.surfaceElevated];
  // Do mais discreto ao mais forte: no claro o texto escurece, no escuro clareia.
  const textOrder: readonly Stop[] = light ? [400, 500, 600, 700, 800, 900] : [500, 400, 300, 200, 100, 50];
  // `subtle` é o tom mais discreto que ainda passa 4,5:1; `muted` é um degrau
  // mais forte, o que garante hierarquia visível sem recair no mesmo hex.
  const subtle = pickStop(n, textOrder, surfaces, 4.5);
  const muted = n[textOrder[Math.min(subtle.index + 1, textOrder.length - 1)]!];
  // Borda de controle (input, select, outline): WCAG 1.4.11 pede 3:1, mas 2,5:1
  // já a torna claramente perceptível sem deixar os formulários pesados.
  const borderStrongOrder: readonly Stop[] = light ? [200, 300, 400, 500, 600] : [700, 600, 500, 400, 300];
  const borderStrong = pickStop(n, borderStrongOrder, [s.surface], 2.5);

  /**
   * Texto, borda e acento saem da ESCALA de neutros, não dos campos soltos de
   * `surfaces`. Cada paleta digitava `textMuted`/`border` à mão, e o resultado
   * foi borda em 1,14:1 (invisível) e `text-subtle` na mesma cor de
   * `text-muted` (sem hierarquia). Derivando da escala, o contraste passa a ser
   * propriedade do sistema e não de 16 objetos digitados um a um — e o teste em
   * `theme-vars.test.ts` cobre as 8 paletas × 2 modos.
   */
  const vars: Record<string, string> = {
    "--color-bg": s.bg,
    "--color-surface": s.surface,
    "--color-surface-elevated": s.surfaceElevated,
    "--color-text": s.text,
    "--color-text-muted": muted,
    "--color-text-subtle": subtle.color,
    "--color-border": light ? n[300] : n[500],
    "--color-border-strong": borderStrong.color,

    // 700 no claro para o texto por cima passar 4,5:1 (no 600 dava 3,4:1).
    "--color-accent": accentBase,
    // Medido, não fixo: branco sobre acento claro dava 2,9:1 nos botões do
    // modo escuro.
    "--color-accent-fg": readableOn(accentBase, "#ffffff", n[950]),
    "--color-accent-soft": light ? a[100] : a[900],
    "--color-accent-hover": light ? a[800] : a[300],

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

    /**
     * Sidebar — rail ESCURA nos dois modos, emitida pela paleta.
     *
     * É o padrão da referência que o usuário aprovou: conteúdo branco, rail
     * escura. O que estava errado nunca foi a rail ser escura — era o CONTEÚDO
     * não ficar claro no tema claro.
     *
     * Continua saindo da paleta (e não de um hex fixo no CSS) para que o acento
     * acompanhe a cor escolhida e para que o contraste seja verificado pelo
     * teste, como o resto do sistema. Os tons vêm da escala ESCURA da paleta,
     * independentemente do modo da página.
     */
    "--color-sidebar": sidebarBg,
    "--color-sidebar-elevated": sidebarElevated,
    "--color-sidebar-border": sidebarBorder,
    "--color-sidebar-text": sidebarText.color,
    "--color-sidebar-text-active": ad[300],
    "--color-sidebar-accent": ad[400],
    "--color-sidebar-hover": sidebarElevated,
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
