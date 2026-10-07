import type { NavEntry, NavGroup, NavLeaf } from "@/components/shell/nav-crm";
import { isGroup } from "@/components/shell/nav-crm";

/**
 * Rotas estritamente restritas à Diretoria e Super-Admins da GLTech3D.
 * Clientes PRO e usuários comuns NUNCA devem ver estas rotas no menu.
 */
export const RESTRICTED_NON_ADMIN_HREFS: ReadonlySet<string> = new Set([
  "/app/pedidos-site",
  "/app/connections",
  "/app/lgpd/requests",
  "/app/ai/agents",
  "/automations",
  "/content-studio",
  "/app/landing-edit",
]);

export interface NavFilterOptions {
  isAdmin: boolean;
}

/**
 * Filtra a árvore de navegação do CRM baseada no nível de acesso do usuário.
 * Para usuários não-admin, remove recursivamente todos os links restritos
 * e grupos que ficarem sem filhos.
 */
export function filterCrmNav(
  entries: NavEntry[],
  { isAdmin }: NavFilterOptions,
): NavEntry[] {
  if (isAdmin) return entries;

  const result: NavEntry[] = [];

  for (const entry of entries) {
    if (isGroup(entry)) {
      const allowedChildren = entry.children.filter(
        (child) => !RESTRICTED_NON_ADMIN_HREFS.has(child.href),
      );
      if (allowedChildren.length > 0) {
        result.push({
          ...entry,
          children: allowedChildren,
        });
      }
    } else {
      if (!RESTRICTED_NON_ADMIN_HREFS.has(entry.href)) {
        result.push(entry);
      }
    }
  }

  return result;
}
