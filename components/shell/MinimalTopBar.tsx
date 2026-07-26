"use client";

import { AppSwitcher } from "./AppSwitcher";
import { UserMenu } from "./UserMenu";

/** Header reduzido para apps sem sidebar ainda (/automations, /content-studio). */
export function MinimalTopBar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-6 backdrop-blur">
      <AppSwitcher />
      <UserMenu />
    </header>
  );
}
