/**
 * Design System Editorial — Catálogo Visual GLTech3D (Agente 1)
 *
 * Estética Anti-IA: Linhas rígidas suíças, proporções de engenharia escandinava/automotiva,
 * tipografia com dados milimétricos e paletas cromáticas orgânicas e técnicas.
 */

export type EditorialThemeId = "warm_studio" | "technical_monolith";
export type CatalogLayoutMode = "grid_2x2" | "hero_plus_3" | "editorial_detail" | "technical_list";

export interface EditorialThemeTokens {
  id: EditorialThemeId;
  name: string;
  isDark: boolean;
  bg: string;
  fg: string;
  surface: string;
  surfaceSubtle: string;
  border: string;
  accent: string;
  accentMuted: string;
  muted: string;
  highlight: string;
  tagBg: string;
}

export const EDITORIAL_THEMES: Record<EditorialThemeId, EditorialThemeTokens> = {
  warm_studio: {
    id: "warm_studio",
    name: "Warm Studio Minimalist (Editorial Claro)",
    isDark: false,
    bg: "#FAF8F5",
    fg: "#171615",
    surface: "#F4F0E8",
    surfaceSubtle: "#EFEBE2",
    border: "#E5E2DC",
    accent: "#9E5A38", // Cobre técnico
    accentMuted: "#DFD2C9",
    muted: "#7A756D",
    highlight: "#264653",
    tagBg: "#EDE9E1",
  },
  technical_monolith: {
    id: "technical_monolith",
    name: "Technical Studio Monolith (Industrial Escuro)",
    isDark: true,
    bg: "#0D0E11",
    fg: "#F4F4F6",
    surface: "#16181E",
    surfaceSubtle: "#1B1D24",
    border: "#262933",
    accent: "#F59E0B", // Âmbar técnico
    accentMuted: "#423215",
    muted: "#8E929E",
    highlight: "#06B6D4",
    tagBg: "#1F222B",
  },
};

export function getThemeTokens(themeId?: string | null): EditorialThemeTokens {
  if (themeId === "technical_monolith") {
    return EDITORIAL_THEMES.technical_monolith;
  }
  return EDITORIAL_THEMES.warm_studio;
}

export interface CatalogLayoutSpec {
  id: CatalogLayoutMode;
  name: string;
  description: string;
  itemsPerPage: number;
  cols: number;
  rows: number;
  cardStyle: "equal_card" | "hero_card" | "editorial_split" | "technical_row";
}

export const CATALOG_LAYOUT_SPECS: Record<CatalogLayoutMode, CatalogLayoutSpec> = {
  grid_2x2: {
    id: "grid_2x2",
    name: "Grade Comercial 2x2",
    description: "4 produtos por página em proporção equilibrada. Ideal para atacado e varejo.",
    itemsPerPage: 4,
    cols: 2,
    rows: 2,
    cardStyle: "equal_card",
  },
  hero_plus_3: {
    id: "hero_plus_3",
    name: "Destaque Hero + 3",
    description: "1 produto principal com foto grande + 3 peças secundárias na base.",
    itemsPerPage: 4,
    cols: 3,
    rows: 2,
    cardStyle: "hero_card",
  },
  editorial_detail: {
    id: "editorial_detail",
    name: "Editorial Minimalista 1x1",
    description: "1 produto exclusivo por página com foto hero expandida e ficha técnica completa.",
    itemsPerPage: 1,
    cols: 1,
    rows: 1,
    cardStyle: "editorial_split",
  },
  technical_list: {
    id: "technical_list",
    name: "Lista Técnica de Engenharia",
    description: "6 itens por página em formato horizontal com matriz de tolerâncias e pesos.",
    itemsPerPage: 6,
    cols: 1,
    rows: 6,
    cardStyle: "technical_row",
  },
};

export const TECHNICAL_BADGES = {
  tolerance: "Tolerância: ±0.05mm Mecânica",
  resolution: "Resolução: 0.12 - 0.28mm FDM / 50µm Resina",
  standard: "ISO/ASTM 52900 Manufatura Aditiva",
  supportedPolymers: [
    { name: "PLA Premium HT", temp: "215°C", use: "Protótipos & Design" },
    { name: "PETG Carbon Fiber", temp: "250°C", use: "Peças Mecânicas Rígidas" },
    { name: "TPU 95A Industrial", temp: "230°C", use: "Vedações & Flexíveis" },
    { name: "ABS / ASA Pro", temp: "260°C", use: "Resistência Térmica Externa" },
    { name: "Resina Tough 8K", temp: "Ambiente", use: "Alta Definição e Encaixes Finos" },
  ],
};

export function formatDimensionBadge(
  d?: { x?: number; y?: number; z?: number } | string | null,
): string {
  if (!d) {
    return "Sob Medida";
  }
  if (typeof d === "string") {
    return d.trim() || "Sob Medida";
  }
  if (!d.x && !d.y && !d.z) {
    return "Sob Medida";
  }
  const x = d.x ?? "—";
  const y = d.y ?? "—";
  const z = d.z ?? "—";
  return `${x} × ${y} × ${z} mm`;
}
