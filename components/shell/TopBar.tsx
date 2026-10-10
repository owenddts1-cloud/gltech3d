"use client";

import { useState } from "react";
import { AppSwitcher } from "./AppSwitcher";
import { TenantSwitcher } from "./TenantSwitcher";
import { UserMenu } from "./UserMenu";
import { SearchTrigger } from "./SearchTrigger";
import { NotificationMenu } from "./NotificationMenu";
import { PlugsConnected, MenuIcon } from "@/lib/ui/icons";
import { CrossAppMeshModal } from "@/components/mesh/CrossAppMeshModal";
import { GuideButton } from "@/components/guides/GuideButton";
import { usePathname } from "next/navigation";
import { resolveActiveAppId } from "@/lib/apps/registry";

export function TopBar({ onToggleMobileMenu }: { onToggleMobileMenu?: () => void } = {}) {
  const [isMeshOpen, setIsMeshOpen] = useState(false);
  const pathname = usePathname();
  const activeApp = resolveActiveAppId(pathname) ?? "crm";

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 md:gap-4 border-b border-border bg-surface/90 px-3 md:px-6 backdrop-blur transition-all duration-200">
        {/* Left side */}
        <div className="flex items-center gap-2 md:gap-3">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground hover:bg-muted md:hidden"
              aria-label="Abrir menu de navegação"
            >
              <MenuIcon size={18} />
            </button>
          )}
          <AppSwitcher />
          <div className="hidden sm:block h-4 w-px bg-border/60" />
          <div className="hidden sm:block">
            <TenantSwitcher />
          </div>
        </div>

        {/* Middle side animated search bar */}
        <div className="hidden sm:flex flex-1 justify-center max-w-lg">
          <SearchTrigger />
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-1.5 md:gap-2">
          <GuideButton />
          <button
            onClick={() => setIsMeshOpen(true)}
            className="hidden lg:flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/20 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors"
            title="Sincronizar dados entre CRM, Automações e AI Studio"
          >
            <PlugsConnected size={15} />
            <span>Integrar Dados</span>
          </button>
          <div className="hidden sm:block h-4 w-px bg-border/60 mx-1" />
          <NotificationMenu />
          <div className="h-4 w-px bg-border/60 mx-1" />
          <UserMenu />
        </div>
      </header>

      <CrossAppMeshModal
        isOpen={isMeshOpen}
        onClose={() => setIsMeshOpen(false)}
        currentApp={activeApp}
      />
    </>
  );
}
