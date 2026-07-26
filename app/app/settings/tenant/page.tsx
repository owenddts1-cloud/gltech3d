import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { readDocumentBranding } from "@/lib/schemas/settings";
import { TenantForm } from "./_form";

export const dynamic = "force-dynamic";

interface OrgRow {
  display_name: string;
  legal_name: string;
  cnpj: string | null;
  timezone: string;
  locale: string;
  media_retention_days: number;
  dpo_email: string | null;
  privacy_policy_url: string | null;
  settings: Record<string, unknown> | null;
}

export default async function TenantSettingsPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!user.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) {
    redirect("/403");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select(
      "display_name, legal_name, cnpj, timezone, locale, media_retention_days, dpo_email, privacy_policy_url, settings",
    )
    .eq("id", activeOrg.orgId)
    .maybeSingle();

  const row = (data ?? null) as OrgRow | null;
  const lostReasonsExtra =
    (row?.settings && Array.isArray((row.settings as { lost_reasons_extra?: unknown }).lost_reasons_extra)
      ? ((row.settings as { lost_reasons_extra?: string[] }).lost_reasons_extra ?? [])
      : []) as string[];

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organização</h1>
          <p className="text-sm text-muted-foreground">
            Dados da empresa, logotipo, retenção de mídia e preferências de documentos impressos.
          </p>
        </div>
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <a
            href="/app/service-orders"
            className="inline-flex h-8 items-center rounded-lg px-3 text-xs text-text-muted hover:bg-surface-elevated hover:text-foreground"
          >
            ← Voltar para Ordens de Serviço
          </a>
          <span className="h-4 w-px bg-border/60" />
          <a
            href="/app/settings/tenant"
            className="inline-flex h-8 items-center rounded-lg bg-accent/15 px-3 text-xs font-bold text-accent border border-accent/20"
          >
            Organização & Documentos
          </a>
        </div>
      </header>
      {row && (
        <TenantForm
          initial={{
            display_name: row.display_name,
            legal_name: row.legal_name,
            cnpj: row.cnpj,
            timezone: row.timezone,
            locale: row.locale === "en-US" ? "en-US" : "pt-BR",
            media_retention_days: row.media_retention_days,
            dpo_email: row.dpo_email,
            privacy_policy_url: row.privacy_policy_url,
            lost_reasons_extra: lostReasonsExtra,
            // Nunca ler path cru do jsonb: o schema é a única porta.
            documents: readDocumentBranding(row.settings),
          }}
        />
      )}
    </div>
  );
}
