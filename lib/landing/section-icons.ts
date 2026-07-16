import {
  UploadCloud,
  Printer,
  Truck,
  Package,
  Palette,
  Wrench,
  Sparkles,
  MessageCircle,
  ShieldCheck,
  Boxes,
  type LucideIcon,
} from "lucide-react";

/**
 * Ícones que um passo do "Como Funciona" pode usar.
 *
 * O banco guarda o NOME (texto), não o componente — jsonb não carrega função.
 * Allowlist fechada de propósito: nome livre viraria ícone quebrado na landing
 * ao primeiro erro de digitação, e obrigaria a importar o pacote inteiro no
 * cliente.
 */
export const SECTION_ICONS = {
  UploadCloud,
  Printer,
  Truck,
  Package,
  Palette,
  Wrench,
  Sparkles,
  MessageCircle,
  ShieldCheck,
  Boxes,
} satisfies Record<string, LucideIcon>;

export type SectionIconName = keyof typeof SECTION_ICONS;

export const SECTION_ICON_NAMES = Object.keys(SECTION_ICONS) as SectionIconName[];

/** Rótulos em português para o seletor do editor. */
export const SECTION_ICON_LABEL: Record<SectionIconName, string> = {
  UploadCloud: "Upload / arquivo",
  Printer: "Impressora",
  Truck: "Entrega",
  Package: "Embalagem",
  Palette: "Cor / acabamento",
  Wrench: "Ajuste técnico",
  Sparkles: "Destaque",
  MessageCircle: "Atendimento",
  ShieldCheck: "Garantia",
  Boxes: "Catálogo",
};

/** Resolve o nome para o componente. Nome desconhecido cai num ícone neutro. */
export function resolveSectionIcon(name: string | undefined): LucideIcon {
  if (name && name in SECTION_ICONS) return SECTION_ICONS[name as SectionIconName];
  return Boxes;
}
