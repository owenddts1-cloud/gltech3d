/**
 * Contraste WCAG — para a paleta ser conferida por conta, não por olho.
 *
 * POR QUE ISTO EXISTE. Uma auditoria externa mediu 281 elementos de texto do
 * site e reprovou 76. O caso que importava: **branco sobre `#A6815C` dá
 * exatamente 3,55:1**, e o mínimo para texto normal é 4,5:1 — ou seja, o botão
 * principal do formulário e vários rótulos ficavam abaixo do exigido.
 *
 * O tom `#8E6D4D`, que **já existia na paleta** e era usado como cor de hover,
 * dá **4,72:1** e passa. A correção foi promover o escuro a cor de texto e botão
 * e deixar o claro para borda, ícone grande e decoração, onde 3:1 basta.
 *
 * Com a conta aqui, isso vira teste em vez de opinião — e ninguém "melhora" a
 * paleta de volta para um tom reprovado sem o CI reclamar.
 *
 * Fórmula: WCAG 2.1, relative luminance + `(L1 + 0,05) / (L2 + 0,05)`.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** `#A6815C` ou `A6815C` → componentes 0-255. Aceita a forma curta `#abc`. */
export function parseHex(hex: string): Rgb | null {
  const clean = hex.trim().replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/**
 * Luminância relativa.
 *
 * A linearização não é um gamma simples: abaixo de 0,03928 a curva é LINEAR, e
 * usar a potência no trecho todo erra justamente nos tons escuros — que é onde
 * a decisão de contraste costuma ser apertada.
 */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const linear = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Razão de contraste entre duas cores. 1 = idênticas, 21 = preto sobre branco. */
export function contrastRatio(a: string, b: string): number {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return 0;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  const [claro, escuro] = la >= lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (escuro + 0.05);
}

/** Limiares da WCAG AA. Texto grande é ≥ 18,66px em negrito ou ≥ 24px. */
export const AA_TEXTO_NORMAL = 4.5;
export const AA_TEXTO_GRANDE = 3;

export function passesAA(a: string, b: string, textoGrande = false): boolean {
  return contrastRatio(a, b) >= (textoGrande ? AA_TEXTO_GRANDE : AA_TEXTO_NORMAL);
}

/**
 * A paleta da marca, com o papel de cada tom declarado.
 *
 * `caramelo` NÃO é cor de texto sobre branco nem de fundo de botão com texto
 * branco — reprova. Está aqui nomeado para que a diferença fique explícita em
 * vez de virar hex solto (havia 136 ocorrências de `#A6815C` na landing, sem
 * token nenhum).
 */
export const BRAND = {
  /** Fundo de botão e texto sobre claro. Passa AA (4,74:1 com branco). */
  carameloTexto: "#8E6D4D",
  /** Hover do anterior, mais escuro ainda. */
  carameloTextoHover: "#6F5439",
  /** Decoração: borda, ícone grande, detalhe. NÃO usar em texto normal. */
  caramelo: "#A6815C",
  espresso: "#2D241E",
  branco: "#FFFFFF",
} as const;
