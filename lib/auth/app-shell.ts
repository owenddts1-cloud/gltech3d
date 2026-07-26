import { redirect } from "next/navigation";
import { loadAuthUser, resolveActiveOrg, isMfaEnrolled, requiresMfa } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuthUser, ActiveOrg } from "@/lib/auth/types";

export interface AppShellContext {
  user: AuthUser;
  activeOrg: ActiveOrg | null;
  mustEnrollMfa: boolean;
}

/**
 * Núcleo de auth compartilhado por todo layout autenticado top-level (/app,
 * /portal, /automations, /content-studio). Faz os mesmos redirects que
 * app/app/layout.tsx sempre fez: não autenticado → /login, onboarding
 * incompleto → /onboarding, org suspensa → /account-suspended. MFA
 * obrigatório não é redirect — o caller decide (renderizar MfaEnrollGate).
 */
export async function loadAppShellContext(): Promise<AppShellContext> {
  const user = await loadAuthUser();
  if (!user) redirect("/login");

  const activeOrg = await resolveActiveOrg(user);

  if (activeOrg) {
    const admin = createAdminClient();
    const { data: orgRow } = await admin
      .from("organizations")
      .select("onboarded_at, status")
      .eq("id", activeOrg.orgId)
      .maybeSingle();
    if (orgRow && !orgRow.onboarded_at) redirect("/onboarding");
    if (orgRow?.status === "suspended") redirect("/account-suspended");
  }

  const enrolled = await isMfaEnrolled();
  const mustEnrollMfa = requiresMfa(activeOrg?.role, user.is_platform_admin) && !enrolled;

  return { user, activeOrg, mustEnrollMfa };
}
