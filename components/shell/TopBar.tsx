"use client";

import { useState } from "react";
import { AppSwitcher } from "./AppSwitcher";
import { TenantSwitcher } from "./TenantSwitcher";
import { UserMenu } from "./UserMenu";
import { SearchTrigger } from "./SearchTrigger";
import { NotificationMenu } from "./NotificationMenu";
import { PlugsConnected } from "@/lib/ui/icons";
import { CrossAppMeshModal } from "@/components/mesh/CrossAppMeshModal";
import { usePathname } from "next/navigation";
import { resolveActiveAppId } from "@/lib/apps/registry";

export function TopBar() {
  const [isMeshOpen, setIsMeshOpen] = useState(false);
  const pathname = usePathname();
  const activeApp = resolveActiveAppId(pathname) ?? "crm";

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface/90 px-6 backdrop-blur transition-all duration-200">
        {/* Left side */}
        <div className="flex items-center gap-3">
          <AppSwitcher />
          <div className="h-4 w-px bg-border/60" />
          <TenantSwitcher />
        </div>

        {/* Middle side animated search bar */}
        <div className="flex flex-1 justify-center max-w-lg">
          <SearchTrigger />
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMeshOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/20 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors"
            title="Sincronizar dados entre CRM, Automações e AI Studio"
          >
            <PlugsConnected size={15} />
            <span>Integrar Dados</span>
          </button>
          <div className="h-4 w-px bg-border/60 mx-1" />
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
