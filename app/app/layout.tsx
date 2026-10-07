import { cookies } from "next/headers";
import { loadAppShellContext } from "@/lib/auth/app-shell";
import { AuthProvider } from "@/hooks/auth/AuthProvider";
import { TrialBanner } from "@/components/app/TrialBanner";
import { AppShell } from "./_components/AppShell";
import { MfaEnrollGate } from "@/components/auth/MfaEnrollGate";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  IMPERSONATE_COOKIE_NAME,
  verifyImpersonateCookie,
} from "@/lib/impersonate/cookie";
import {
  ImpersonateBanner,
  type ImpersonatingInfo,
} from "@/components/app/ImpersonateBanner";

import { CRM_NAV } from "@/components/shell/nav-crm";
import { filterCrmNav } from "@/lib/auth/nav-filter";
import { isDirectorateEmail } from "@/lib/auth/landing-admin";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, activeOrg, plan, mustEnrollMfa } = await loadAppShellContext();

  const isAdmin = Boolean(user.is_platform_admin || isDirectorateEmail(user.email));
  const nav = filterCrmNav(CRM_NAV, { isAdmin });

  // Read sidebar collapsed state SSR to avoid flash.
  const store = await cookies();
  const collapsed = store.get("sidebar_collapsed")?.value === "1";

  // Impersonate (S-11.07): verify cookie server-side and resolve tenant name.
  // Middleware already validates HMAC + expiry on /app/*; we re-verify here as
  // defence-in-depth and to extract the payload safely.
  let impersonating: ImpersonatingInfo | null = null;
  const impCookie = store.get(IMPERSONATE_COOKIE_NAME)?.value;
  if (impCookie) {
    const result = verifyImpersonateCookie(impCookie);
    if (result.valid && result.payload) {
      const admin = createAdminClient();
      const { data: org } = await admin
        .from("organizations")
        .select("display_name")
        .eq("id", result.payload.tenantId)
        .maybeSingle();
      if (org) {
        impersonating = {
          tenantId: result.payload.tenantId,
          tenantName: org.display_name,
          expiresAt: new Date(result.payload.exp * 1000).toISOString(),
        };
      }
    }
  }

  return (
    <AuthProvider user={user} activeOrg={activeOrg} plan={plan}>
      <ImpersonateBanner impersonating={impersonating} />
      <TrialBanner />
      {mustEnrollMfa ? <MfaEnrollGate /> : <AppShell sidebarCollapsed={collapsed} nav={nav}>{children}</AppShell>}
    </AuthProvider>
  );
}
