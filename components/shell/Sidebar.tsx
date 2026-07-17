"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LogOut, Zap } from "lucide-react";
import {
  Kanban, Users, UsersThree, Gear, CaretDoubleLeft, CaretDoubleRight, CaretDown,
  Inbox, ScalesSimple, Robot, PlugsConnected, House,
  Gauge, Printer, Ruler, ClipboardText, Sparkle, ShoppingCart, Package, Cube,
  CalendarBlank, ChartLineUp, Toolbox, Handshake, AddressBook, Calculator, Coins,
  Storefront,
} from "@/lib/ui/icons";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { toggleSidebar } from "@/app/actions/shell/toggleSidebar";
import { usePermission, useUser, useAuth, useActiveOrg } from "@/hooks/auth/AuthProvider";
import { ConnectionHealthDot } from "@/components/connections/ConnectionHealthDot";
import { Logo } from "./Logo";

function initials(name: string | null, email: string): string {
  if (name && name.trim()) {
    return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

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

// Menu agrupado para reduzir poluição: ~9 entradas de topo (era ~16). Só reorganiza —
// nenhuma rota muda. Grupos colapsáveis (NavGroup) já suportados pelo render.
const NAV: NavEntry[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: Gauge },
  {
    key: "producao",
    label: "Produção",
    icon: Ruler,
    children: [
      { href: "/app/projects", label: "Projetos", icon: Ruler },
      { href: "/app/service-orders", label: "Ordens de Serviço", icon: ClipboardText },
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
    key: "suprimentos",
    label: "Suprimentos",
    icon: Toolbox,
    children: [
      { href: "/app/inventory", label: "Inventário", icon: Toolbox },
      { href: "/app/suppliers", label: "Fornecedores", icon: Handshake },
    ],
  },
  { href: "/app/assistant", label: "Assistente IA", icon: Sparkle },
  { href: "/app/landing-edit", label: "Landing Edit", icon: Storefront },
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
  const user = useUser();
  const activeOrg = useActiveOrg();
  const { signOut } = useAuth();

  const permissions: Record<string, boolean> = {
    "lgpd.execute_redact": canLgpd,
    "ai.agents.view": canAiAgents,
  };
  const canSee = (perm?: string) => (perm ? permissions[perm] ?? true : true);

  const [open, setOpen] = useState<Record<string, boolean>>({});

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
          "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors z-10",
          active
            ? "text-primary font-semibold"
            : "text-muted-foreground hover:text-foreground",
          collapsed && "justify-center px-2",
          opts?.nested && !collapsed && "ml-3 pl-4",
        )}
      >
        {active && (
          <motion.div
            layoutId="sidebar-active-pill"
            className="absolute inset-0 bg-primary/10 border-l-2 border-primary rounded-r-md -z-10"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
        <Icon size={opts?.nested ? 16 : 18} weight={active ? "fill" : "regular"} aria-hidden className="shrink-0" />
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

    if (collapsed) {
      const first = children[0]!;
      return (
        <Link
          key={group.key}
          href={first.href}
          title={group.label}
          aria-current={groupActive ? "page" : undefined}
          className={cn(
            "relative flex items-center justify-center rounded-md px-2 py-2 text-sm transition-colors z-10",
            groupActive
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {groupActive && (
            <motion.div
              layoutId="sidebar-active-pill"
              className="absolute inset-0 bg-primary/10 border-l-2 border-primary rounded-r-md -z-10"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <Icon size={18} weight={groupActive ? "fill" : "regular"} aria-hidden />
        </Link>
      );
    }

    const isOpen = open[group.key] ?? false;
    return (
      <div key={group.key} className="space-y-0.5">
        <button
          type="button"
          onClick={() => setOpen((s) => ({ ...s, [group.key]: !isOpen }))}
          aria-expanded={isOpen}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors text-muted-foreground hover:text-foreground",
            groupActive && "text-foreground font-medium",
          )}
        >
          <Icon size={18} weight={groupActive ? "fill" : "regular"} aria-hidden className="shrink-0" />
          <span className="truncate">{group.label}</span>
          <CaretDown
            size={14}
            aria-hidden
            className={cn("ml-auto transition-transform", isOpen && "rotate-180")}
          />
        </button>
        {isOpen && (
          <div className="mt-0.5 space-y-0.5 border-l border-zinc-400 dark:border-zinc-850 pl-1">
            {children.map((c) => renderLeaf(c, { nested: true }))}
          </div>
        )}
      </div>
    );
  }

  return (
    <motion.aside
      layout="position"
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r bg-[#fef2e0] dark:bg-zinc-950 border-zinc-400 dark:border-zinc-850 shadow-lg",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex items-center border-b border-zinc-400 dark:border-zinc-850 px-4 h-14", collapsed ? "justify-center" : "justify-start")}>
        <Logo collapsed={collapsed} />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2 scrollbar-none" aria-label="Navegação principal">
        {NAV.map((entry) => {
          if (isGroup(entry)) return renderGroup(entry);
          if (!canSee(entry.permission)) return null;
          return renderLeaf(entry);
        })}
      </nav>
      
      {/* Conta (fixada magneticamente no rodapé, isolada da navegação) */}
      <div className="space-y-1 border-t border-zinc-400 dark:border-zinc-800/60 p-2 bg-zinc-200/50 dark:bg-zinc-950/20">
        <div className={cn("mb-1 flex items-center gap-3 rounded-lg bg-white/80 dark:bg-zinc-900/40 border border-zinc-400 dark:border-zinc-800/30 p-2", collapsed && "justify-center bg-transparent border-none p-1")}>
          {/* Avatar com borda gradiente ativa */}
          <div className="relative shrink-0 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-tr from-orange-600 via-amber-500 to-emerald-500 rounded-full animate-spin-slow opacity-90 p-[1.5px]" />
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-[10px] font-bold text-zinc-100 border border-zinc-900 z-10 m-[1.5px]">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.full_name || "User Avatar"} className="h-full w-full rounded-full object-cover" />
              ) : (
                initials(user.full_name, user.email)
              )}
            </div>
            {/* Status dot */}
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-zinc-950 z-20" />
          </div>
          
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100 leading-tight">
                  {user.full_name || user.email.split("@")[0]}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="truncate text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                    {activeOrg?.name || "Workspace"}
                  </span>
                  <span className="flex items-center gap-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-500 text-[8px] font-bold px-1 py-0.2 rounded uppercase border border-orange-500/20 tracking-wider">
                    <Zap size={6} fill="currentColor" />
                    PRO
                  </span>
                </div>
              </div>
              <motion.button
                type="button"
                onClick={() => startTransition(async () => { await signOut(); })}
                disabled={isPending}
                title="Sair"
                aria-label="Sair"
                whileHover={{ rotate: 15, scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-md p-1.5 text-zinc-500 dark:text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-500 shrink-0"
              >
                <LogOut size={15} strokeWidth={2} />
              </motion.button>
            </>
          )}
        </div>

        <Link
          href="/"
          title={collapsed ? "Voltar à Landing" : undefined}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800/35 hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors",
            collapsed && "justify-center px-2",
          )}
        >
          <House size={14} aria-hidden className="shrink-0" />
          {!collapsed && <span>Voltar à Landing</span>}
        </Link>
        
        <button
          type="button"
          onClick={() => startTransition(() => toggleSidebar(collapsed))}
          disabled={isPending}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800/35 hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors",
            collapsed && "justify-center px-2",
          )}
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          {collapsed ? <CaretDoubleRight size={14} aria-hidden /> : <CaretDoubleLeft size={14} aria-hidden />}
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </motion.aside>
  );
}
