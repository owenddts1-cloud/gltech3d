"use client";
import { useTransition } from "react";
import { useUser, useAuth } from "@/hooks/auth/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { PaletteSwitcher } from "@/components/theme/PaletteSwitcher";
import { SignOut, Lightbulb, ArrowsClockwise } from "@/lib/ui/icons";
import { useOptionalGuides } from "@/components/guides/GuideProvider";

function initials(name: string | null, email: string): string {
  if (name && name.trim()) {
    return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const user = useUser();
  const { signOut } = useAuth();
  const [isPending, startTransition] = useTransition();
  // Null when the menu is rendered outside the guide provider.
  const guides = useOptionalGuides();

  return (
    <div className="flex items-center gap-2">
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menu do usuário">
            <Avatar className="h-8 w-8">
              {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
              <AvatarFallback>{initials(user.full_name, user.email)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[220px]">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user.full_name ?? user.email}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <PaletteSwitcher />
          <DropdownMenuSeparator />
          {guides ? (
            <>
              {/* Deferred: the dropdown must finish closing (and returning focus)
                  before a dialog opens, or the dialog loses its focus trap. */}
              <DropdownMenuItem onSelect={() => window.setTimeout(guides.openCenter, 0)}>
                <Lightbulb size={16} className="mr-2" aria-hidden />
                Central de guias
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.setTimeout(guides.resetAll, 0)}>
                <ArrowsClockwise size={16} className="mr-2" aria-hidden />
                Rever todos os guias
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem disabled={isPending} onClick={() => startTransition(async () => { await signOut(); })}>
            <SignOut size={16} className="mr-2" aria-hidden />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
