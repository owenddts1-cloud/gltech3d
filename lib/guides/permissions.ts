import { CRM_NAV, isGroup, type NavLeaf } from "@/components/shell/nav-crm";
import { roleCan } from "@/lib/auth/permissions";
import type { Role } from "@/lib/auth/types";
import { guideHref } from "./registry";
import type { GuideEntry } from "./types";

/**
 * The guide center must not list screens the user cannot open: clicking
 * "Organização" or "Agentes IA" as an agent lands on /403. The permission of a
 * guide is the permission of the sidebar item for the same href — one source of
 * truth (`CRM_NAV`), so the menu and the guide center never disagree.
 */
const PERMISSION_BY_HREF: ReadonlyMap<string, string> = new Map(
  CRM_NAV.flatMap((e) => (isGroup(e) ? e.children : [e as NavLeaf]))
    .filter((leaf) => leaf.permission)
    .map((leaf) => [leaf.href, leaf.permission as string]),
);

export function guidePermission(guide: GuideEntry): string | null {
  return PERMISSION_BY_HREF.get(guideHref(guide)) ?? null;
}

export function canSeeGuide(
  guide: GuideEntry,
  role: Role | null | undefined,
  opts?: { isPlatformAdmin?: boolean },
): boolean {
  const permission = guidePermission(guide);
  return permission === null || roleCan(role, permission, opts);
}
