"use client";

import { TenantSwitcher } from "./TenantSwitcher";
import { UserMenu } from "./UserMenu";
import { SearchTrigger } from "./SearchTrigger";
import { NotificationMenu } from "./NotificationMenu";

export function TopBar() {

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface/90 px-6 backdrop-blur transition-all duration-200">
      {/* Left side */}
      <div className="flex items-center gap-3">
        <TenantSwitcher />
      </div>

      {/* Middle side animated search bar */}
      <div className="flex flex-1 justify-center max-w-lg">
        <SearchTrigger />
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        <NotificationMenu />
        <div className="h-4 w-px bg-border/60 mx-1" />
        <UserMenu />
      </div>
    </header>
  );
}
