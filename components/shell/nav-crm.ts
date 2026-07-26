import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  Users, UsersThree, Gear, Buildings,
  Inbox, ScalesSimple, Robot, PlugsConnected,
  Gauge, Printer, Ruler, ClipboardText, Sparkle, ShoppingCart, Package, Cube,
  CalendarBlank, ChartLineUp, Toolbox, Handshake, AddressBook, Calculator, Coins,
  Storefront, VideoCamera,
} from "@/lib/ui/icons";

export interface NavLeaf {
  href: string;
  label: string;
  icon: PhosphorIcon;
  permission?: string;
  healthDot?: boolean;
}
export interface NavGroup {
  key: string;
  label: string;
  icon: PhosphorIcon;
  children: NavLeaf[];
}
export type NavEntry = NavLeaf | NavGroup;

export function isGroup(e: NavEntry): e is NavGroup {
  return (e as NavGroup).children !== undefined;
}

// Menu agrupado para reduzir poluição: ~9 entradas de topo (era ~16). Só reorganiza —
// nenhuma rota muda. Grupos colapsáveis (NavGroup) já suportados pelo render.
export const CRM_NAV: NavEntry[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: Gauge },
  {
    key: "producao",
    label: "Produção",
    icon: Ruler,
    children: [
      { href: "/app/projects", label: "Projetos", icon: Ruler },
      { href: "/app/service-orders", label: "Ordens de Serviço", icon: ClipboardText },
      { href: "/app/settings/tenant", label: "Organização", icon: Buildings },
      { href: "/app/printers", label: "Impressoras & Filamentos", icon: Printer },
      { href: "/app/models", label: "Modelagem", icon: Cube },
      { href: "/app/calculator", label: "Calculadora 3D", icon: Calculator },
      { href: "/app/calendar", label: "Calendário", icon: CalendarBlank },
    ],
  },
  {
    key: "vendas",
    label: "Vendas",
    icon: ShoppingCart,
    children: [
      { href: "/app/sales", label: "Visão geral", icon: ChartLineUp },
      { href: "/app/sales/shopee", label: "Shopee", icon: ShoppingCart },
      { href: "/app/sales/mercado-livre", label: "Mercado Livre", icon: ShoppingCart },
      { href: "/app/sales/facebook", label: "Facebook", icon: ShoppingCart },
      { href: "/app/products", label: "Produtos", icon: Package },
      { href: "/app/sales/new-product", label: "Cadastro de produto", icon: Package },
    ],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    icon: Coins,
    children: [
      { href: "/app/control", label: "Controle", icon: Coins },
      { href: "/app/reports", label: "Relatórios", icon: ChartLineUp },
    ],
  },
  {
    key: "clientes",
    label: "Clientes",
    icon: AddressBook,
    children: [
      { href: "/app/inbox", label: "Inbox", icon: Inbox },
      { href: "/app/connections", label: "Conexões", icon: PlugsConnected, healthDot: true },
      // "Kanban" (funil de leads genérico /app/pipelines) escondido do menu a
      // pedido do usuário — ele já usa o Kanban de Vendas (/app/sales). Rota
      // continua existindo, só não aparece na navegação.
      { href: "/app/contacts", label: "Contatos", icon: Users },
      { href: "/app/team", label: "Equipe", icon: UsersThree },
      { href: "/app/lgpd/requests", label: "LGPD", icon: ScalesSimple, permission: "lgpd.execute_redact" },
      { href: "/app/ai/agents", label: "Agentes IA", icon: Robot, permission: "ai.agents.view" },
    ],
  },
  {
    key: "suprimentos",
    label: "Suprimentos",
    icon: Toolbox,
    children: [
      { href: "/app/inventory", label: "Inventário", icon: Toolbox },
      { href: "/app/suppliers", label: "Fornecedores", icon: Handshake },
    ],
  },
  { href: "/app/assistant", label: "Assistente IA", icon: Sparkle },
  { href: "/automations", label: "Automações (n8n)", icon: Robot },
  { href: "/content-studio", label: "Criação de Conteúdo", icon: VideoCamera },
  { href: "/app/landing-edit", label: "Landing Edit", icon: Storefront },
  { href: "/app/settings", label: "Configurações", icon: Gear },
];
