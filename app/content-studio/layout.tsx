import { loadAppShellContext } from "@/lib/auth/app-shell";
import { AuthProvider } from "@/hooks/auth/AuthProvider";
import { MfaEnrollGate } from "@/components/auth/MfaEnrollGate";
import { MinimalTopBar } from "@/components/shell/MinimalTopBar";

export default async function ContentStudioLayout({ children }: { children: React.ReactNode }) {
  const { user, activeOrg, mustEnrollMfa } = await loadAppShellContext();

  return (
    <AuthProvider user={user} activeOrg={activeOrg}>
      {mustEnrollMfa ? (
        <MfaEnrollGate />
      ) : (
        <div className="flex min-h-screen flex-col bg-bg">
          <MinimalTopBar />
          <main className="flex-1">{children}</main>
        </div>
      )}
    </AuthProvider>
  );
}
