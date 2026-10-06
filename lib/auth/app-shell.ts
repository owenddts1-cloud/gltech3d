import { redirect } from "next/navigation";
import { loadAuthUser, resolveSelectedOrgForShell, isMfaEnrolled, requiresMfa } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { planStateFromRow } from "@/lib/plan/server";
import type { AuthUser, ActiveOrg } from "@/lib/auth/types";
import type { PlanState } from "@/lib/plan/types";

export interface AppShellContext {
  user: AuthUser;
  activeOrg: ActiveOrg | null;
  /** `null` espelha `activeOrg: null` — sem org, nao ha plano a resolver. */
  plan: PlanState | null;
  mustEnrollMfa: boolean;
}

/**
 * Núcleo de auth compartilhado por todo layout autenticado top-level (/app,
 * /portal, /automations, /content-studio). Faz os mesmos redirects que
 * app/app/layout.tsx sempre fez: não autenticado → /login, onboarding
 * incompleto → /onboarding, org suspensa → /account-suspended. MFA
 * obrigatório não é redirect — o caller decide (renderizar MfaEnrollGate).
 *
 * O PLANO é resolvido aqui, e não em cada server action, porque esta query já
 * acontece em todo request autenticado dos quatro layouts: ler três colunas a
 * mais custa zero round-trip. Resolver plano dentro dos ~25 `requireCtx()`
 * custaria uma query por action.
 */
export async function loadAppShellContext(): Promise<AppShellContext> {
  const user = await loadAuthUser();
  if (!user) redirect("/login");

  // The shell needs the selected org even when it is suspended — that is what
  // drives the /account-suspended redirect below. API handlers and server
  // actions use `resolveActiveOrg()`, which returns null for a non-active org.
  const activeOrg = await resolveSelectedOrgForShell(user);

  let plan: PlanState | null = null;
  let hasPaidPlan = false;

  if (activeOrg) {
    const admin = createAdminClient();
    const { data: orgRow } = await admin
      .from("organizations")
      .select("onboarded_at, status, plan, trial_ends_at, plan_expires_at")
      .eq("id", activeOrg.orgId)
      .maybeSingle();
    if (orgRow && !orgRow.onboarded_at) redirect("/onboarding");
    if (orgRow?.status === "suspended") redirect("/account-suspended");
    // redacted/archived: RLS (0084) already hides the data from members; show
    // the same page instead of an app shell that would render empty.
    if (orgRow && orgRow.status !== "active" && !user.is_platform_admin) {
      redirect("/account-suspended");
    }

    plan = planStateFromRow(orgRow);

    // MFA é exigido de plano PAGO, não de trial. A política existe para proteger
    // PII de clientes reais; forçar um authenticator antes de a pessoa ver uma
    // tela do produto mataria o funil do trial de 7 dias.
    //
    // A checagem olha TODAS as memberships de admin, não só a org ativa: alguém
    // que administra uma org paga e outra em trial escaparia do TOTP só por
    // deixar a org em trial selecionada.
    hasPaidPlan = await hasAnyPaidAdminOrg(user);
  }

  const enrolled = await isMfaEnrolled();
  const mustEnrollMfa =
    requiresMfa({
      role: activeOrg?.role,
      isPlatformAdmin: user.is_platform_admin,
      hasPaidPlan,
    }) && !enrolled;

  return { user, activeOrg, plan, mustEnrollMfa };
}

/**
 * O usuário é `admin` de alguma organização com plano pago vigente?
 *
 * Uma query só, sobre as orgs em que ele é admin. Trial não conta — o gate de
 * TOTP liga no dia em que o Pix é aprovado.
 */
async function hasAnyPaidAdminOrg(user: AuthUser): Promise<boolean> {
  const adminOrgIds = user.organizations
    .filter((o) => o.role === "admin")
    .map((o) => o.organization_id);
  if (adminOrgIds.length === 0) return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("plan, trial_ends_at, plan_expires_at")
    .in("id", adminOrgIds);

  return (data ?? []).some((row) => {
    const state = planStateFromRow(row);
    // `tier !== 'standard'` exclui o trial: trial é janela sobre o gratuito.
    return state?.status === "active" && state.tier !== "standard";
  });
}
