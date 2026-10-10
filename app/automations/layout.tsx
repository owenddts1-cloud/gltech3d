import { cookies } from "next/headers";
import { loadAppShellContext } from "@/lib/auth/app-shell";
import { AuthProvider } from "@/hooks/auth/AuthProvider";
import { MfaEnrollGate } from "@/components/auth/MfaEnrollGate";
import { AppShell } from "../app/_components/AppShell";

export default async function AutomationsLayout({ children }: { children: React.ReactNode }) {
  const { user, activeOrg, plan, mustEnrollMfa } = await loadAppShellContext();
  const store = await cookies();
  const collapsed = store.get("sidebar_collapsed")?.value === "1";

  return (
    <AuthProvider user={user} activeOrg={activeOrg} plan={plan}>
      {mustEnrollMfa ? (
        <MfaEnrollGate />
      ) : (
        <AppShell sidebarCollapsed={collapsed}>{children}</AppShell>
      )}
    </AuthProvider>
  );
}
