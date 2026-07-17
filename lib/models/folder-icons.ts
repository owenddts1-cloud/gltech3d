import {
  Folder,
  FolderOpen,
  User,
  Users,
  Star,
  Heart,
  Package,
  Box,
  Wrench,
  Palette,
  Camera,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/**
 * Ícones que uma pasta de cliente pode usar. O banco guarda o NOME (texto),
 * não o componente — jsonb/coluna não carrega função. Allowlist fechada de
 * propósito (mesma ideia de lib/landing/section-icons.ts): nome livre viraria
 * ícone quebrado ao primeiro erro de digitação.
 */
export const FOLDER_ICONS = {
  Folder,
  FolderOpen,
  User,
  Users,
  Star,
  Heart,
  Package,
  Box,
  Wrench,
  Palette,
  Camera,
  Sparkles,
} satisfies Record<string, LucideIcon>;

export type FolderIconName = keyof typeof FOLDER_ICONS;

export const FOLDER_ICON_NAMES = Object.keys(FOLDER_ICONS) as FolderIconName[];

/** Cores opcionais para o ícone da pasta (tokens neutros + acento). */
export const FOLDER_COLORS = [
  { name: "Padrão", value: "" },
  { name: "Âmbar", value: "#f59e0b" },
  { name: "Azul", value: "#3b82f6" },
  { name: "Verde", value: "#10b981" },
  { name: "Rosa", value: "#ec4899" },
  { name: "Roxo", value: "#8b5cf6" },
] as const;

/** Resolve o nome para o componente. Nome desconhecido cai em Folder. */
export function resolveFolderIcon(name: string | undefined): LucideIcon {
  if (name && name in FOLDER_ICONS) return FOLDER_ICONS[name as FolderIconName];
  return Folder;
}
