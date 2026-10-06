import { loadAppShellContext } from "@/lib/auth/app-shell";
import { AuthProvider } from "@/hooks/auth/AuthProvider";
import { MfaEnrollGate } from "@/components/auth/MfaEnrollGate";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, activeOrg, plan, mustEnrollMfa } = await loadAppShellContext();

  return (
    <AuthProvider user={user} activeOrg={activeOrg} plan={plan}>
      {mustEnrollMfa ? <MfaEnrollGate /> : children}
    </AuthProvider>
  );
}
