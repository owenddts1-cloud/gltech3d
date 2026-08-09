import { describe, it, expect } from "vitest";

import { paletteVars, PALETTE_IDS } from "./theme-vars";

/**
 * Contraste de TODAS as paletas × modos.
 *
 * O tema claro chegou a produção com as bordas em 1,14:1 (invisíveis) e com
 * `text-subtle` na MESMA cor de `text-muted` — sem hierarquia. Nada media isso,
 * então nada barrou. Estas asserções são a trava: 8 paletas × 2 modos, a cada
 * `npm run test:unit`.
 *
 * Os limiares seguem a WCAG 2.1 onde ela se aplica (texto 4,5:1; componente de
 * interface 3:1) e usam um piso próprio, mais baixo, para divisória decorativa —
 * exigir 3:1 de um filete deixaria a interface pesada, e nenhum design system
 * faz isso. O que importa é ser perceptível.
 */

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Luminância relativa (WCAG 2.1). */
export function luminance(hex: string): number {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** Razão de contraste entre duas cores hex. Sempre ≥ 1. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const MODES = ["light", "dark"] as const;

/** Só compara o que é hex — `color-mix()` e rgba não entram. */
const isHex = (v: string | undefined): v is string => Boolean(v && /^#[0-9a-f]{3,8}$/i.test(v.trim()));

describe("contraste (util)", () => {
  it("calcula os extremos conhecidos", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    // Par de referência do próprio sistema: texto sobre card no tema claro.
    expect(contrast("#18181b", "#ffffff")).toBeGreaterThan(15);
  });

  it("é simétrico", () => {
    expect(contrast("#123456", "#abcdef")).toBeCloseTo(contrast("#abcdef", "#123456"), 10);
  });
});

describe("classes de cor inexistentes", () => {
  it("nenhum componente usa text-text-*-foreground", async () => {
    /**
     * `text-text-muted-foreground` não existe: no `tailwind.config.ts` o grupo
     * `colors.text` só tem `DEFAULT/muted/subtle`, e `foreground` mora em
     * `colors.muted`. A classe não gera CSS nenhum, então o texto herda a cor do
     * pai — 15 ocorrências (14 só no Dashboard) matavam a hierarquia sem que
     * nada acusasse, porque Tailwind não reclama de classe desconhecida.
     */
    const { readFileSync, readdirSync } = await import("node:fs");
    const roots = ["app", "components"];
    const offenders: string[] = [];
    let scanned = 0;

    for (const root of roots) {
      const files = readdirSync(root, { recursive: true, encoding: "utf-8" })
        .filter((f) => (f.endsWith(".tsx") || f.endsWith(".ts")) && !f.includes(".test."))
        .map((f) => `${root}/${f.replace(/\\/g, "/")}`);
      for (const file of files) {
        scanned++;
        const src = readFileSync(file, "utf-8");
        if (/text-text-[a-z-]+-foreground/.test(src)) offenders.push(file);
      }
    }

    expect(scanned, "a varredura não achou arquivo — teste inútil").toBeGreaterThan(100);
    expect(offenders).toEqual([]);
  });
});

describe.each(PALETTE_IDS)("paleta %s", (id) => {
  describe.each(MODES)("modo %s", (mode) => {
    const v = paletteVars(id, mode);
    const bg = v["--color-bg"]!;
    const surface = v["--color-surface"]!;
    const elevated = v["--color-surface-elevated"]!;

    /** Falha citando a razão medida — sem isso, depurar exige recalcular à mão. */
    function assertMin(fg: string, bgc: string, min: number, label: string) {
      const ratio = contrast(fg, bgc);
      expect(ratio, `${label}: ${fg} sobre ${bgc} = ${ratio.toFixed(2)}:1 (mínimo ${min}:1)`).toBeGreaterThanOrEqual(min);
    }

    it("texto principal ≥ 7:1 nas três superfícies", () => {
      const text = v["--color-text"]!;
      assertMin(text, bg, 7, "text/bg");
      assertMin(text, surface, 7, "text/surface");
      assertMin(text, elevated, 7, "text/elevated");
    });

    it("texto secundário ≥ 4.5:1 nas três superfícies", () => {
      const muted = v["--color-text-muted"]!;
      assertMin(muted, bg, 4.5, "text-muted/bg");
      assertMin(muted, surface, 4.5, "text-muted/surface");
      assertMin(muted, elevated, 4.5, "text-muted/elevated");
    });

    it("texto sutil ≥ 4.5:1 e DIFERENTE do secundário", () => {
      const muted = v["--color-text-muted"]!;
      const subtle = v["--color-text-subtle"]!;
      // A regressão real: subtle e muted eram a mesma cor, matando a hierarquia.
      expect(subtle.toLowerCase(), "text-subtle não pode ser igual a text-muted").not.toBe(
        muted.toLowerCase(),
      );
      assertMin(subtle, bg, 4.5, "text-subtle/bg");
      assertMin(subtle, surface, 4.5, "text-subtle/surface");
    });

    it("acento legível e com texto legível por cima", () => {
      const accent = v["--color-accent"]!;
      assertMin(accent, bg, 3, "accent/bg");
      assertMin(v["--color-accent-fg"]!, accent, 4.5, "accent-fg/accent");
    });

    it("estados ≥ 4.5:1 sobre o fundo", () => {
      for (const state of ["success", "warning", "error", "info"] as const) {
        assertMin(v[`--color-${state}`]!, bg, 4.5, `${state}/bg`);
      }
    });

    it("bordas perceptíveis; a forte serve a controles", () => {
      // Piso de percepção para filete decorativo (1,14:1 era invisível).
      assertMin(v["--color-border"]!, surface, 1.35, "border/surface");
      // border-strong veste input, select e botão outline — WCAG 1.4.11 vale aqui.
      assertMin(v["--color-border-strong"]!, surface, 2.5, "border-strong/surface");
    });

    it("sidebar emitida pela paleta e legível", () => {
      // Se a paleta parar de emitir estes tokens, a sidebar volta a ignorar o
      // seletor de tema — que foi exatamente o bug relatado.
      for (const k of [
        "--color-sidebar",
        "--color-sidebar-elevated",
        "--color-sidebar-border",
        "--color-sidebar-text",
        "--color-sidebar-text-active",
        "--color-sidebar-accent",
        "--color-sidebar-hover",
      ]) {
        expect(v[k], `${k} não foi emitido por paletteVars`).toBeDefined();
      }

      const sb = v["--color-sidebar"]!;
      assertMin(v["--color-sidebar-text"]!, sb, 4.5, "sidebar-text/sidebar");
      assertMin(v["--color-sidebar-text-active"]!, sb, 4.5, "sidebar-text-active/sidebar");
      assertMin(v["--color-sidebar-accent"]!, sb, 3, "sidebar-accent/sidebar");
      // A rail se separa da página pela BORDA, não pela luminância — no tema
      // claro ela é a superfície branca sobre o fundo cinza, como em qualquer
      // app de painel. Então o que precisa ser perceptível é o filete.
      assertMin(v["--color-sidebar-border"]!, sb, 1.35, "sidebar-border/sidebar");
      // A rail não pode encostar no fundo da página. No tema escuro isso chegou
      // a 1,09:1 — sidebar e conteúdo viravam um bloco só, que foi a queixa.
      assertMin(sb, bg, 1.18, "sidebar/bg");
      // Hover tem que ser perceptível contra o próprio fundo da sidebar.
      expect(v["--color-sidebar-hover"]!.toLowerCase()).not.toBe(sb.toLowerCase());
    });

    it("todo token de cor emitido é hex válido", () => {
      for (const [k, val] of Object.entries(v)) {
        if (k.endsWith("-bg") || val.startsWith("color-mix") || val.startsWith("rgba")) continue;
        expect(isHex(val), `${k} = "${val}" não é hex`).toBe(true);
      }
    });
  });
});
