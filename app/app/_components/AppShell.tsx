"use client";
import { useMemo, type ReactNode } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { CRM_NAV, type NavEntry } from "@/components/shell/nav-crm";
import { GuideProvider } from "@/components/guides/GuideProvider";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/auth/AuthProvider";
import { filterCrmNav } from "@/lib/auth/nav-filter";
import { isDirectorateEmail } from "@/lib/auth/landing-admin";

interface AppShellProps {
  sidebarCollapsed: boolean;
  nav?: NavEntry[];
  children: ReactNode;
}

export function AppShell({ sidebarCollapsed, nav, children }: AppShellProps) {
  const user = useUser();
  const isAdmin = Boolean(user.is_platform_admin || isDirectorateEmail(user.email));
  const activeNav = useMemo(() => nav ?? filterCrmNav(CRM_NAV, { isAdmin }), [nav, isAdmin]);

  return (
    // Per-screen guides: auto-open on first visit, always reachable from the TopBar.
    <GuideProvider>
      <div className="flex min-h-screen w-full bg-bg">
        {/* `data-no-print`: navegação não vai para o papel (regra em globals.css). */}
        <div data-no-print>
          <Sidebar collapsed={sidebarCollapsed} nav={activeNav} />
        </div>
        <div className={cn("flex min-h-screen flex-1 flex-col transition-[margin] duration-200 print:ml-0", sidebarCollapsed ? "ml-16" : "ml-60")}>
          <div data-no-print>
            <TopBar />
          </div>
          <main className="flex-1 overflow-auto p-6 print:overflow-visible print:p-0">{children}</main>
        </div>
      </div>
    </GuideProvider>
  );
}

