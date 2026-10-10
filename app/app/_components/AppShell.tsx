"use client";
import { useMemo, useState, type ReactNode } from "react";
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
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    // Per-screen guides: auto-open on first visit, always reachable from the TopBar.
    <GuideProvider>
      <div className="flex min-h-screen w-full bg-bg">
        {/* Desktop Sidebar: oculto em telas menores para não esmagar a interface */}
        <div data-no-print className="hidden md:block">
          <Sidebar collapsed={sidebarCollapsed} nav={activeNav} />
        </div>

        {/* Mobile Drawer: gaveta deslizante sobreposta em celulares */}
        {mobileOpen && (
          <div data-no-print className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl">
              <Sidebar
                collapsed={false}
                nav={activeNav}
                onCloseMobile={() => setMobileOpen(false)}
              />
            </div>
          </div>
        )}

        <div
          className={cn(
            "flex min-h-screen flex-1 flex-col transition-[margin] duration-200 print:ml-0",
            "ml-0",
            sidebarCollapsed ? "md:ml-16" : "md:ml-60",
          )}
        >
          <div data-no-print>
            <TopBar onToggleMobileMenu={() => setMobileOpen((prev) => !prev)} />
          </div>
          <main className="flex-1 overflow-auto p-4 md:p-6 print:overflow-visible print:p-0">{children}</main>
        </div>
      </div>
    </GuideProvider>
  );
}

