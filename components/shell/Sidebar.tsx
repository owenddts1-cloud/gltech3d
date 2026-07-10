"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Kanban, Users, UsersThree, Gear, CaretDoubleLeft, CaretDoubleRight, CaretDown,
  Inbox, ScalesSimple, Robot, PlugsConnected, House,
  Gauge, Printer, Ruler, ClipboardText, Sparkle, ShoppingCart, Package, Cube,
  CalendarBlank, ChartLineUp, Toolbox, Handshake, AddressBook,
} from "@/lib/ui/icons";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { toggleSidebar } from "@/app/actions/shell/toggleSidebar";
import { usePermission } from "@/hooks/auth/AuthProvider";
import { ConnectionHealthDot } from "@/components/connections/ConnectionHealthDot";

interface NavLeaf {
  href: string;
  label: string;
  icon: PhosphorIcon;
  permission?: string;
  healthDot?: boolean;
}
interface NavGroup {
  key: string;
  label: string;
  icon: PhosphorIcon;
  children: NavLeaf[];
}
type NavEntry = NavLeaf | NavGroup;

function isGroup(e: NavEntry): e is NavGroup {
  return (e as NavGroup).children !== undefined;
}

// Nova arquitetura de informação do super app GLTECH CRM. "Clientes" e "Vendas"
// são grupos expansíveis; o resto são abas diretas. Ordem aprovada pelo usuário.
const NAV: NavEntry[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/app/printers", label: "Impressoras & Filamentos", icon: Printer },
  {
    key: "clientes",
    label: "Clientes",
    icon: AddressBook,
    children: [
      { href: "/app/inbox", label: "Inbox", icon: Inbox },
      { href: "/app/connections", label: "Conexões", icon: PlugsConnected, healthDot: true },
      { href: "/app/kanban", label: "Kanban", icon: Kanban },
      { href: "/app/contacts", label: "Contatos", icon: Users },
      { href: "/app/team", label: "Equipe", icon: UsersThree },
      { href: "/app/lgpd/requests", label: "LGPD", icon: ScalesSimple, permission: "lgpd.execute_redact" },
      { href: "/app/ai/agents", label: "Agentes IA", icon: Robot, permission: "ai.agents.view" },
    ],
  },
  { href: "/app/projects", label: "Projetos", icon: Ruler },
  { href: "/app/service-orders", label: "Ordens de Serviço", icon: ClipboardText },
  { href: "/app/assistant", label: "Assistente IA", icon: Sparkle },
  {
    key: "vendas",
    label: "Vendas",
    icon: ShoppingCart,
    children: [
      { href: "/app/sales", label: "Visão geral", icon: ChartLineUp },
      { href: "/app/sales/shopee", label: "Shopee", icon: ShoppingCart },
      { href: "/app/sales/mercado-livre", label: "Mercado Livre", icon: ShoppingCart },
      { href: "/app/sales/facebook", label: "Facebook", icon: ShoppingCart },
      { href: "/app/sales/new-product", label: "Cadastro de produto", icon: Package },
    ],
  },
  { href: "/app/products", label: "Produtos", icon: Package },
  { href: "/app/models", label: "Modelagem", icon: Cube },
  { href: "/app/calendar", label: "Calendário", icon: CalendarBlank },
  { href: "/app/reports", label: "Relatórios", icon: ChartLineUp },
  { href: "/app/inventory", label: "Inventário", icon: Toolbox },
  { href: "/app/suppliers", label: "Fornecedores", icon: Handshake },
  { href: "/app/settings", label: "Configurações", icon: Gear },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const canLgpd = usePermission("lgpd.execute_redact");
  const canAiAgents = usePermission("ai.agents.view");

  // Resolução genérica de permissão por string. Abas sem `permission` são
  // sempre visíveis; strings desconhecidas caem para visível (fail-open) —
  // os módulos novos ainda não têm RBAC próprio no milestone 1.
  const permissions: Record<string, boolean> = {
    "lgpd.execute_redact": canLgpd,
    "ai.agents.view": canAiAgents,
  };
  const canSee = (perm?: string) => (perm ? permissions[perm] ?? true : true);

  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const e of NAV) {
      if (isGroup(e) && e.children.some((c) => isActive(pathname, c.href))) init[e.key] = true;
    }
    return init;
  });

  function renderLeaf(item: NavLeaf, opts?: { nested?: boolean }) {
    const active = isActive(pathname, item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
          active
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          collapsed && "justify-center px-2",
          opts?.nested && !collapsed && "ml-3 pl-4",
        )}
      >
        <Icon size={opts?.nested ? 16 : 18} weight={active ? "fill" : "regular"} aria-hidden />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {item.healthDot && (
          <ConnectionHealthDot className={cn(collapsed ? "absolute right-1.5 top-1.5" : "ml-auto")} />
        )}
      </Link>
    );
  }

  function renderGroup(group: NavGroup) {
    const children = group.children.filter((c) => canSee(c.permission));
    if (children.length === 0) return null;
    const groupActive = children.some((c) => isActive(pathname, c.href));
    const Icon = group.icon;

    // Colapsado: sem sub-lista; o ícone do grupo leva à primeira sub-aba.
    if (collapsed) {
      const first = children[0]!;
      return (
        <Link
          key={group.key}
          href={first.href}
          title={group.label}
          aria-current={groupActive ? "page" : undefined}
          className={cn(
            "flex items-center justify-center rounded-md px-2 py-2 text-sm transition-colors",
            groupActive
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          <Icon size={18} weight={groupActive ? "fill" : "regular"} aria-hidden />
        </Link>
      );
    }

    const isOpen = open[group.key] ?? groupActive;
    return (
      <div key={group.key}>
        <button
          type="button"
          onClick={() => setOpen((s) => ({ ...s, [group.key]: !isOpen }))}
          aria-expanded={isOpen}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            groupActive
              ? "text-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          <Icon size={18} weight={groupActive ? "fill" : "regular"} aria-hidden />
          <span className="truncate">{group.label}</span>
          <CaretDown
            size={14}
            aria-hidden
            className={cn("ml-auto transition-transform", isOpen && "rotate-180")}
          />
        </button>
        {isOpen && (
          <div className="mt-0.5 space-y-0.5 border-l border-border/60 pl-1">
            {children.map((c) => renderLeaf(c, { nested: true }))}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r bg-card transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex items-center border-b px-4 h-14", collapsed ? "justify-center" : "justify-start")}>
        {collapsed ? (
          <span aria-hidden className="text-lg font-bold text-primary">G</span>
        ) : (
          <span className="font-semibold tracking-tight">
            GLTECH <span className="text-primary">CRM</span>
          </span>
        )}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Navegação principal">
        {NAV.map((entry) => {
          if (isGroup(entry)) return renderGroup(entry);
          if (!canSee(entry.permission)) return null;
          return renderLeaf(entry);
        })}
      </nav>
      <div className="space-y-1 border-t p-2">
        <Link
          href="/"
          title={collapsed ? "Voltar à Landing" : undefined}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            collapsed && "justify-center px-2",
          )}
        >
          <House size={14} aria-hidden />
          {!collapsed && <span>Voltar à Landing</span>}
        </Link>
        <button
          type="button"
          onClick={() => startTransition(() => toggleSidebar(collapsed))}
          disabled={isPending}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            collapsed && "justify-center px-2",
          )}
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          {collapsed ? <CaretDoubleRight size={14} aria-hidden /> : <CaretDoubleLeft size={14} aria-hidden />}
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  );
}
