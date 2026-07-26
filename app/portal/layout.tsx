import { loadAppShellContext } from "@/lib/auth/app-shell";
import { AuthProvider } from "@/hooks/auth/AuthProvider";
import { MfaEnrollGate } from "@/components/auth/MfaEnrollGate";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, activeOrg, mustEnrollMfa } = await loadAppShellContext();

  return (
    <AuthProvider user={user} activeOrg={activeOrg}>
      {mustEnrollMfa ? <MfaEnrollGate /> : children}
    </AuthProvider>
  );
}
