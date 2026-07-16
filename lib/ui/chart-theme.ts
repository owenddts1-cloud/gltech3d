/**
 * Paleta e estilos canônicos dos gráficos (Recharts). Todo dashboard importa daqui —
 * é o mesmo espírito do ADR-05 para ícones: uma fonte só, para as telas não divergirem.
 *
 * Por que hex e não var(--...): Recharts injeta estes valores em atributos SVG (`fill`,
 * `stroke`) via JS, e `var()` só resolve quando o browser aplica CSS ao elemento — em
 * vários pontos o Recharts lê a string crua e monta gradiente/canvas com ela. Onde o valor
 * VAI parar em CSS (contentStyle, cursor) usamos var() normalmente.
 */

/**
 * Cores de série. Semântica fixa: dinheiro que entra é verde, que sai é vermelho.
 *
 * emerald/red validados como par categórico (claro #fcfcfb): banda PASS · croma PASS ·
 * CVD adjacente ΔE 24.1, bem acima do alvo 12. O aviso de contraste do emerald (2.47:1)
 * é coberto pela regra de alívio: legenda + os valores em texto nos cards acima do gráfico.
 */
export const CHART = {
  ink: "#1e293b",      // slate-800 — linha principal sobre fundo claro
  blue: "#3b82f6",     // destaque / acumulado
  emerald: "#10b981",  // receita
  red: "#ef4444",      // despesa
  amber: "#f59e0b",    // atenção / em andamento
  slate: "#94a3b8",    // neutro
} as const;

/**
 * Fatias de rosca (categorias nominais). Slots em ordem fixa — nunca ciclar, nunca gerar
 * um 4º hue: a ordem é o mecanismo de segurança para daltonismo, não estética.
 *
 * Validado com scripts/validate_palette.js da skill de dataviz, nos dois modos:
 *   claro (#fcfcfb): banda de luminosidade PASS · croma PASS · pior CVD adjacente ΔE 47.2
 *   escuro (#1a1a19): tudo PASS, inclusive contraste >= 3:1
 *
 * A paleta anterior (#3b82f6,#94a3b8,#cbd5e1) reprovava: #cbd5e1 fora da banda e dois slots
 * abaixo do piso de croma — liam como cinza, não como categoria.
 *
 * Aviso do validador: no claro, aqua e yellow ficam abaixo de 3:1 contra a superfície. Isso
 * obriga rótulo visível — a legenda ao lado da rosca traz nome e valor de cada fatia, então
 * a cor nunca é o único canal.
 */
export const DONUT = ["#2a78d6", "#1baf7a", "#eda100"] as const;
export const DONUT_DARK = ["#3987e5", "#199e70", "#c98500"] as const;

/** Eixos: seguem o tema porque só viram atributo de texto SVG. */
export const axisTick = { fontSize: 11, fill: "var(--color-text-muted)" } as const;

/** Tooltip escuro, igual nos dois dashboards. */
export const tooltipStyle = {
  background: "#0f172a",
  border: "none",
  borderRadius: 10,
  fontSize: 12,
  color: "#fff",
  boxShadow: "0 8px 24px -6px rgba(0,0,0,0.35)",
} as const;

export const tooltipLabelStyle = { color: "#94a3b8", marginBottom: 2 } as const;

/** Realce da barra sob o cursor. `--color-muted` NÃO existe: bg-muted mapeia para isto. */
export const tooltipCursorFill = "var(--color-surface-elevated)";

/** Card padrão dos dashboards. */
export const CARD = "rounded-2xl border border-border bg-surface p-5 shadow-sm";
