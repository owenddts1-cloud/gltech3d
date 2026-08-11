/**
 * Modos de visualização, materiais e ângulos de câmera do inspetor 3D.
 *
 * Módulo PURO — só dados e matemática de câmera, sem `three` e sem DOM. Fica
 * separado do `ThreeViewer` para poder ser testado e para que acrescentar um
 * material não exija abrir o componente de render.
 */

export type ViewMode = "solid" | "wireframe" | "xray" | "normals" | "matcap";

export interface ViewModeSpec {
  id: ViewMode;
  label: string;
  hint: string;
}

export const VIEW_MODES: readonly ViewModeSpec[] = [
  { id: "solid", label: "Sólido", hint: "Como a peça vai sair impressa" },
  { id: "wireframe", label: "Wireframe", hint: "Malha aparente — mostra a densidade de triângulos" },
  { id: "xray", label: "Raio-X", hint: "Translúcido — revela paredes internas e vazios" },
  { id: "normals", label: "Normais", hint: "Colore por direção da face — normal invertida salta à vista" },
  { id: "matcap", label: "Matcap", hint: "Sombreamento de estúdio, bom para julgar a forma" },
] as const;

export type MaterialPresetId =
  | "resina-branca"
  | "filamento-fosco"
  | "metal-escovado"
  | "ouro"
  | "vidro"
  | "argila";

export interface MaterialPreset {
  id: MaterialPresetId;
  label: string;
  color: string;
  roughness: number;
  metalness: number;
  /** Verniz por cima — dá o brilho de resina curada. */
  clearcoat: number;
  clearcoatRoughness: number;
  /** 1 = opaco. Abaixo disso o material entra em modo transparente. */
  opacity: number;
  transmission: number;
}

/**
 * Valores escolhidos para PARECER o material real na impressão, não para serem
 * fisicamente exatos. `metalness` alto com `roughness` alto vira cinza sujo —
 * por isso os fosco/argila ficam com metalness 0.
 */
export const MATERIAL_PRESETS: readonly MaterialPreset[] = [
  { id: "resina-branca",  label: "Resina branca",  color: "#f4f4f5", roughness: 0.28, metalness: 0.0,  clearcoat: 0.6, clearcoatRoughness: 0.25, opacity: 1,    transmission: 0 },
  { id: "filamento-fosco",label: "Filamento fosco",color: "#e07a3f", roughness: 0.85, metalness: 0.0,  clearcoat: 0.0, clearcoatRoughness: 1.0,  opacity: 1,    transmission: 0 },
  { id: "metal-escovado", label: "Metal escovado", color: "#b8bcc4", roughness: 0.38, metalness: 1.0,  clearcoat: 0.1, clearcoatRoughness: 0.5,  opacity: 1,    transmission: 0 },
  { id: "ouro",           label: "Ouro",           color: "#d4a017", roughness: 0.22, metalness: 1.0,  clearcoat: 0.2, clearcoatRoughness: 0.2,  opacity: 1,    transmission: 0 },
  { id: "vidro",          label: "Vidro",          color: "#dceaf5", roughness: 0.05, metalness: 0.0,  clearcoat: 1.0, clearcoatRoughness: 0.05, opacity: 0.45, transmission: 0.85 },
  { id: "argila",         label: "Argila",         color: "#c8836a", roughness: 0.95, metalness: 0.0,  clearcoat: 0.0, clearcoatRoughness: 1.0,  opacity: 1,    transmission: 0 },
] as const;

export function materialPresetById(id: MaterialPresetId): MaterialPreset {
  return MATERIAL_PRESETS.find((m) => m.id === id) ?? MATERIAL_PRESETS[0]!;
}

export type StudioAngle = "frente" | "costas" | "esquerda" | "direita" | "topo" | "iso";

export const STUDIO_ANGLES: readonly { id: StudioAngle; label: string }[] = [
  { id: "frente", label: "Frente" },
  { id: "costas", label: "Costas" },
  { id: "esquerda", label: "Esquerda" },
  { id: "direita", label: "Direita" },
  { id: "topo", label: "Topo" },
  { id: "iso", label: "Isométrica" },
] as const;

export interface CameraPose {
  position: [number, number, number];
  /** Vetor "para cima". Em vista de topo NÃO pode ser +Y, senão a câmera fica
   *  paralela ao próprio up e a matriz de visão degenera (tela preta). */
  up: [number, number, number];
}

/**
 * Posição de câmera para um ângulo, dado o raio de enquadramento (já calculado
 * a partir da maior dimensão do modelo).
 */
export function cameraPoseFor(angle: StudioAngle, radius: number): CameraPose {
  const d = Math.max(radius, 0.001); // raio zero deixaria a câmera dentro do modelo
  switch (angle) {
    case "frente":   return { position: [0, 0, d],  up: [0, 1, 0] };
    case "costas":   return { position: [0, 0, -d], up: [0, 1, 0] };
    case "esquerda": return { position: [-d, 0, 0], up: [0, 1, 0] };
    case "direita":  return { position: [d, 0, 0],  up: [0, 1, 0] };
    case "topo":     return { position: [0, d, 0],  up: [0, 0, -1] };
    case "iso":      return { position: [d * 0.62, d * 0.55, d * 0.62], up: [0, 1, 0] };
  }
}

/**
 * Raio que enquadra o modelo inteiro numa câmera em perspectiva.
 *
 * `fovDeg` é o campo de visão VERTICAL. Quando a janela é mais alta que larga, o
 * limite passa a ser o horizontal — daí a divisão por `aspect` quando ele é < 1;
 * sem isso a peça sai cortada nas laterais em telas estreitas.
 */
export function framingRadius(maxDimension: number, fovDeg = 45, aspect = 1, padding = 1.25): number {
  const fov = (fovDeg * Math.PI) / 180;
  const vertical = (maxDimension / 2) / Math.tan(fov / 2);
  const radius = aspect < 1 ? vertical / aspect : vertical;
  return radius * padding;
}
