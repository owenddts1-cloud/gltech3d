"use client";
import { usePathname, useRouter } from "next/navigation";
import { CaretDown, SquaresFour } from "@/lib/ui/icons";
import { APPS, resolveActiveAppId } from "@/lib/apps/registry";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AppSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const activeId = resolveActiveAppId(pathname);
  const active = APPS.find((a) => a.id === activeId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {active ? (
            <active.icon size={16} weight="duotone" aria-hidden />
          ) : (
            <SquaresFour size={16} aria-hidden />
          )}
          <span className="max-w-[140px] truncate">{active?.shortLabel ?? "Apps"}</span>
          <CaretDown size={12} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[260px]">
        {APPS.map((app) => (
          <DropdownMenuItem
            key={app.id}
            onClick={() => router.push(app.href)}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2 truncate">
              <app.icon size={16} weight={app.id === activeId ? "fill" : "regular"} aria-hidden />
              <span className="truncate">{app.label}</span>
            </span>
            {app.status === "coming-soon" && (
              <Badge variant="outline" className="text-[9px] shrink-0">Em construção</Badge>
            )}
            {app.id === activeId && <span className="text-xs text-muted-foreground">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
