import type { Metadata } from "next";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { loadPlanState } from "@/lib/plan/server";
import { proModuleForPath, PRO_MODULES } from "@/lib/plan/modules";
import { canRequestProUpgrade } from "@/lib/pro-signup/request-permission";
import { BillingClient } from "./_client";

export const metadata: Metadata = { title: "Plano e cobrança" };
export const dynamic = "force-dynamic";

/**
 * Tela de upgrade. Vive sob `/app/settings/**`, que é LIVRE de propósito: é para
 * cá que `requirePro()` redireciona, e se ela própria exigisse PRO o redirect
 * entraria em laço.
 */
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ locked?: string }>;
}) {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  const plan = activeOrg ? await loadPlanState(activeOrg.orgId) : null;

  // O parâmetro vem da URL, ou seja, do usuário. NUNCA renderizar cru: resolvemos
  // para um RÓTULO do catálogo e, se não reconhecer, não mostramos nada. Imprimir
  // o valor na tela seria injeção de texto e pareceria open redirect numa auditoria.
  const { locked } = await searchParams;
  const lockedLabel =
    locked && locked.startsWith("/app/") ? (proModuleForPath(locked)?.label ?? null) : null;

  return (
    <BillingClient
      plan={plan}
      orgName={activeOrg?.name ?? null}
      lockedLabel={lockedLabel}
      modules={[...PRO_MODULES]}
      buyerName={user.full_name ?? ""}
      buyerEmail={user.email}
      canRequest={canRequestProUpgrade({
        role: activeOrg?.role,
        isPlatformAdmin: user.is_platform_admin,
      })}
    />
  );
}
