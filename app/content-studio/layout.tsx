import { loadAppShellContext } from "@/lib/auth/app-shell";
import { AuthProvider } from "@/hooks/auth/AuthProvider";
import { MfaEnrollGate } from "@/components/auth/MfaEnrollGate";
import { MinimalTopBar } from "@/components/shell/MinimalTopBar";
import { GuideProvider } from "@/components/guides/GuideProvider";

export default async function ContentStudioLayout({ children }: { children: React.ReactNode }) {
  const { user, activeOrg, plan, mustEnrollMfa } = await loadAppShellContext();

  return (
    <AuthProvider user={user} activeOrg={activeOrg} plan={plan}>
      {mustEnrollMfa ? (
        <MfaEnrollGate />
      ) : (
        <GuideProvider>
          <div className="flex min-h-screen flex-col bg-bg">
            <MinimalTopBar />
            <main className="flex-1">{children}</main>
          </div>
        </GuideProvider>
      )}
    </AuthProvider>
  );
}
