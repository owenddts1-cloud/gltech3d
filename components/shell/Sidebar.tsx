"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "motion/react";
import {
  CaretDoubleLeft, CaretDoubleRight, CaretDown, House, SignOut, Lightning, Lock,
} from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { toggleSidebar } from "@/app/actions/shell/toggleSidebar";
import { usePermission, useUser, useAuth, useActiveOrg, usePlan } from "@/hooks/auth/AuthProvider";
import { requiresProAccess } from "@/lib/plan/modules";
import { planBadgeLabel } from "@/lib/plan/resolve";
import { ConnectionHealthDot } from "@/components/connections/ConnectionHealthDot";
import { Logo } from "./Logo";
import { isGroup, type NavEntry, type NavGroup, type NavLeaf } from "./nav-crm";

function initials(name: string | null, email: string): string {
  if (name && name.trim()) {
    return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ collapsed, nav }: { collapsed: boolean; nav: NavEntry[] }) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const canLgpd = usePermission("lgpd.execute_redact");
  const canAiAgents = usePermission("ai.agents.view");
  const canOrgSettings = usePermission("org.settings.manage");
  const canChannels = usePermission("channels.manage");
  const user = useUser();
  const activeOrg = useActiveOrg();
  const { signOut } = useAuth();

  const plan = usePlan();

  // Every `permission` used in the nav must be wired here. An unwired key is
  // HIDDEN (fail closed), so a forgotten entry shows up as a missing item in
  // review instead of a menu link that leads to /403. Server guards stay the
  // real authority.
  const permissions: Record<string, boolean> = {
    "lgpd.execute_redact": canLgpd,
    "ai.agents.view": canAiAgents,
    "org.settings.manage": canOrgSettings,
    "channels.manage": canChannels,
  };
  const canSee = (perm?: string) => (perm ? permissions[perm] ?? false : true);

  /**
   * Item travado = ha plano resolvido, ele nao da acesso PRO, e a rota exige PRO.
   *
   * `plan !== null` e fail-open COSMETICO de proposito: sem plano resolvido a UI
   * nao decora nada, em vez de chutar um cadeado. Quem decide acesso de verdade
   * e `requirePro()` no servidor, que trata `null` como sem acesso.
   *
   * Nao existe campo `requiresPro` em `NavLeaf`: ele duplicaria o mapa
   * rota -> PRO que `lib/plan/modules.ts` ja tem, e as duas listas divergiriam
   * em silencio (menu aberto, servidor trancando).
   */
  const isLocked = (href: string) =>
    plan !== null && !plan.hasProAccess && requiresProAccess(href);

  const upgradeHref = (href: string) =>
    `/app/settings/billing?locked=${encodeURIComponent(href)}`;

  const [open, setOpen] = useState<Record<string, boolean>>({});

  function renderLeaf(item: NavLeaf, opts?: { nested?: boolean }) {
    const active = isActive(pathname, item.href);
    const locked = isLocked(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        // Travado leva para a tela de upgrade, nao para a rota — que redirecionaria
        // para la de qualquer forma, so que depois de um round-trip.
        href={locked ? upgradeHref(item.href) : item.href}
        // Continua sendo <Link> e nao <button disabled>: a navegacao por teclado
        // segue funcionando, e `Sidebar.test.tsx` exige role="link" nos itens.
        title={locked ? `${item.label} — disponível no PRO` : collapsed ? item.label : undefined}
        aria-current={active && !locked ? "page" : undefined}
        data-locked={locked ? "true" : undefined}
        className={cn(
          "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors z-10",
          active && !locked
            ? "text-sidebar-text-active font-semibold"
            : "text-sidebar-text hover:text-sidebar-text-active",
          locked && "opacity-60",
          collapsed && "justify-center px-2",
          opts?.nested && !collapsed && "ml-3 pl-4",
        )}
      >
        {active && !locked && (
          <motion.div
            layoutId="sidebar-active-pill"
            className="absolute inset-0 bg-sidebar-accent/15 border-l-2 border-sidebar-accent rounded-r-md -z-10"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
        <Icon size={opts?.nested ? 16 : 18} weight={active && !locked ? "fill" : "regular"} aria-hidden className="shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {locked && (
          <Lock
            size={13}
            weight="fill"
            aria-hidden
            className={cn("shrink-0 opacity-70", collapsed ? "absolute right-1 top-1" : "ml-auto")}
          />
        )}
        {item.healthDot && !locked && (
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
              ? "text-sidebar-text-active"
              : "text-sidebar-text hover:text-sidebar-text-active",
          )}
        >
          {groupActive && (
            <motion.div
              layoutId="sidebar-active-pill"
              className="absolute inset-0 bg-sidebar-accent/15 border-l-2 border-sidebar-accent rounded-r-md -z-10"
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
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors text-sidebar-text hover:text-sidebar-text-active",
            groupActive && "text-sidebar-text-active font-medium",
          )}
        >
          <Icon size={18} weight={groupActive ? "fill" : "regular"} aria-hidden className="shrink-0" />
          <span className="truncate">{group.label}</span>
          {/* Grupo inteiro travado: mostra o cadeado, NAO esconde. Esconder e o
              caminho de `permission`; aqui o ponto do cadeado e vender. */}
          {children.every((c) => isLocked(c.href)) && (
            <Lock size={12} weight="fill" aria-hidden className="ml-auto shrink-0 opacity-60" />
          )}
          <CaretDown
            size={14}
            aria-hidden
            className={cn("ml-auto transition-transform", isOpen && "rotate-180")}
          />
        </button>
        {isOpen && (
          <div className="mt-0.5 space-y-0.5 border-l border-sidebar-border pl-1">
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
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r bg-sidebar border-sidebar-border shadow-lg",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex items-center border-b border-sidebar-border px-4 h-14", collapsed ? "justify-center" : "justify-start")}>
        <Logo collapsed={collapsed} />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2 scrollbar-none" aria-label="Navegação principal">
        {nav.map((entry) => {
          if (isGroup(entry)) return renderGroup(entry);
          if (!canSee(entry.permission)) return null;
          return renderLeaf(entry);
        })}
      </nav>
      
      {/* Conta (fixada magneticamente no rodapé, isolada da navegação) */}
      <div className="space-y-1 border-t border-sidebar-border p-2 bg-sidebar">
        <div className={cn("mb-1 flex items-center gap-3 rounded-lg bg-sidebar-elevated border border-sidebar-border p-2", collapsed && "justify-center bg-transparent border-none p-1")}>
          {/* Avatar com borda gradiente ativa */}
          <div className="relative shrink-0 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-tr from-orange-600 via-amber-500 to-emerald-500 rounded-full animate-spin-slow opacity-90 p-[1.5px]" />
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-sidebar text-[10px] font-bold text-sidebar-text-active border border-sidebar-border z-10 m-[1.5px]">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.full_name || "User Avatar"} className="h-full w-full rounded-full object-cover" />
              ) : (
                initials(user.full_name, user.email)
              )}
            </div>
            {/* Status dot */}
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-sidebar z-20" />
          </div>
          
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-sidebar-text-active leading-tight">
                  {user.full_name || user.email.split("@")[0]}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="truncate text-[10px] text-sidebar-text font-medium">
                    {activeOrg?.name || "Workspace"}
                  </span>
                  {/* Era "PRO" cravado: todo mundo via, inclusive quem nao era.
                      Agora reflete o estado real e, fora do plano pago, vira
                      porta de conversao. `null` = plano nao resolvido: nao
                      desenha nada, em vez de mentir. */}
                  {(() => {
                    const badge = planBadgeLabel(plan);
                    if (!badge) return null;
                    const paid = plan?.status === "active";
                    const content = (
                      <span
                        className={cn(
                          "flex items-center gap-0.5 text-[8px] font-bold px-1 py-0.2 rounded uppercase border tracking-wider",
                          paid
                            ? "bg-sidebar-accent/10 text-sidebar-accent border-sidebar-accent/25"
                            : "bg-amber-500/10 text-amber-500 border-amber-500/30",
                        )}
                      >
                        {paid ? <Lightning size={6} weight="fill" /> : <Lock size={6} weight="fill" />}
                        {badge}
                      </span>
                    );
                    return paid ? (
                      content
                    ) : (
                      <Link href="/app/settings/billing" title="Ver planos">
                        {content}
                      </Link>
                    );
                  })()}
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
                className="rounded-md p-1.5 text-sidebar-text transition-colors hover:bg-red-500/10 hover:text-red-500 shrink-0"
              >
                <SignOut size={15} weight="bold" />
              </motion.button>
            </>
          )}
        </div>

        <Link
          href="/"
          title={collapsed ? "Voltar à Landing" : undefined}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active transition-colors",
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
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active transition-colors",
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
