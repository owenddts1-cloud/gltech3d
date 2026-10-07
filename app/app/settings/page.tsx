import Link from "next/link";

import { Card } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/server";
import { isDirectorateEmail } from "@/lib/auth/landing-admin";
import { SETTINGS_LINKS, filterSettingsLinks } from "@/lib/auth/settings-filter";

export const dynamic = "force-dynamic";

export default async function SettingsHubPage() {
  const user = await requireAuth();
  const isDirectorOrPlatformAdmin = Boolean(
    user.is_platform_admin || isDirectorateEmail(user.email),
  );

  const visible = filterSettingsLinks(SETTINGS_LINKS, { isDirectorOrPlatformAdmin });

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie sua conta, organização e integrações.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((l) => (
          <Link key={l.href} href={l.href} className="block">
            <Card className="h-full p-4 transition-colors hover:border-border-strong">
              <h2 className="text-sm font-semibold">{l.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{l.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
