/**
 * Lado servidor do plano: leitura, gate e concessao.
 *
 * Separado de `resolve.ts` porque este arquivo toca banco e `next/navigation` —
 * `resolve.ts` continua puro e importavel do cliente.
 */
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { isDirectorateEmail } from "@/lib/auth/landing-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import type { ActiveOrg, AuthUser } from "@/lib/auth/types";
import { resolvePlanState } from "./resolve";
import { nextExpiry } from "./expiry";
import { writePlanColumns } from "./write";
import type { PlanState } from "./types";

/** Colunas do plano, em um lugar so — os dois leitores usam esta string. */
export const PLAN_COLUMNS = "plan, trial_ends_at, plan_expires_at" as const;

interface PlanColumns {
  plan: string | null;
  trial_ends_at: string | null;
  plan_expires_at: string | null;
}

/** Converte a linha crua do banco no estado derivado. */
export function planStateFromRow(row: PlanColumns | null | undefined): PlanState | null {
  if (!row) return null;
  return resolvePlanState({
    plan: row.plan,
    trialEndsAt: row.trial_ends_at,
    planExpiresAt: row.plan_expires_at,
  });
}

/**
 * Le o plano de uma org.
 *
 * Prefira NAO chamar isto em server actions: `loadAppShellContext()` ja carrega
 * o plano na query que ele faz de qualquer jeito, e o layout propaga pelo
 * AuthProvider. Esta funcao existe para os poucos pontos fora do shell (a tela
 * de billing, a aprovacao no console admin).
 */
export async function loadPlanState(orgId: string): Promise<PlanState | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select(PLAN_COLUMNS)
    .eq("id", orgId)
    .maybeSingle();

  if (error) {
    // Nao devolver "sem plano" em silencio: quem chama trataria como gratuito e
    // trancaria um cliente pagante sem deixar rastro.
    logger.error("plan_load_failed", { orgId, details: error.message });
    return null;
  }
  return planStateFromRow(data as PlanColumns | null);
}

export interface ProContext {
  user: AuthUser;
  activeOrg: ActiveOrg;
  plan: PlanState;
}

/**
 * Gate de rota PRO. Usado pelo layout do route group `app/app/(pro)/`.
 *
 * Fail-closed: sem usuario vai para /login, sem org vai para o seletor, e sem
 * acesso vai para a tela de upgrade — que mora sob /app/settings, deliberadamente
 * FORA do gate, senao o redirect cairia em laco.
 *
 * `lockedPath` vira o parametro `?locked=`, que a tela de billing resolve para
 * um rotulo com `proModuleForPath` — nunca imprime cru.
 */
export async function requirePro(lockedPath?: string): Promise<ProContext> {
  const user = await loadAuthUser();
  if (!user) redirect("/login");

  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/portal/switcher");

  const plan = await loadPlanState(activeOrg.orgId);
  const isSuperOrDirector = Boolean(user.is_platform_admin || isDirectorateEmail(user.email));
  if (!isSuperOrDirector && (!plan || !plan.hasProAccess)) {
    const qs = lockedPath ? `?locked=${encodeURIComponent(lockedPath)}` : "";
    redirect(`/app/settings/billing${qs}`);
  }

  return {
    user,
    activeOrg,
    plan:
      plan ??
      ({
        tier: "pro",
        status: "active",
        hasProAccess: true,
        trialDaysLeft: null,
        trialEndsAt: null,
        planExpiresAt: null,
      } as PlanState),
  };
}

/**
 * Concede (ou renova) acesso pago por `days` dias.
 *
 * O `Math.max(atual, agora)` e o ponto que importa: ele faz a renovacao SOMAR ao
 * que ainda resta, em vez de resetar. Sem ele, quem renova 10 dias antes de
 * vencer perde esses 10 dias — e o erro so apareceria um ano depois.
 *
 * Read-then-write em TS, sem funcao `security definer`: o service role ja
 * bypassa RLS, e uma funcao no banco capaz de conceder plano seria superficie de
 * escalonamento que nao precisa existir.
 */
export async function grantProAccess(
  admin: SupabaseClient,
  orgId: string,
  days: number,
): Promise<{ ok: true; planExpiresAt: string | null } | { ok: false; message: string }> {
  const { data: current, error: readErr } = await admin
    .from("organizations")
    .select("plan, plan_expires_at")
    .eq("id", orgId)
    .maybeSingle();

  if (readErr) return { ok: false, message: readErr.message };
  if (!current) return { ok: false, message: "organização não encontrada" };

  // A paid plan with NO expiry (pro/enterprise, plan_expires_at NULL) is
  // unlimited. Approving another payment must never shrink it to "now + N
  // days", nor downgrade enterprise to pro: leave the row untouched.
  const currentPlan = (current.plan as string | null) ?? "standard";
  if ((currentPlan === "pro" || currentPlan === "enterprise") && current.plan_expires_at == null) {
    return { ok: true, planExpiresAt: null };
  }

  const planExpiresAt = nextExpiry((current.plan_expires_at as string | null) ?? null, days);

  // `settings.plan` (jsonb legado) nao e mais escrito: o unico leitor
  // (TenantOverview) passou a ler a coluna `plan`.
  // Paying again never downgrades: an enterprise org keeps its tier and only
  // gets the extra period.
  const written = await writePlanColumns(admin, orgId, {
    plan: currentPlan === "enterprise" ? "enterprise" : "pro",
    plan_expires_at: planExpiresAt,
  });
  if (!written.ok) return { ok: false, message: written.message };
  return { ok: true, planExpiresAt };
}

/**
 * Data de expiracao que uma concessao produziria, sem tocar o banco.
 * Re-exportada de `./expiry` (onde `admin.ts`, que e puro, tambem a consome).
 */
export { nextExpiry };

/**
 * Defesa em profundidade para server actions que ESCREVEM dados PRO.
 *
 * O gate primario e o layout do route group `(pro)`. Mas ele so roda na
 * navegacao: uma aba aberta antes do trial vencer continuaria gravando. Este
 * helper fecha essa janela.
 *
 * Devolve a mensagem de erro quando NAO ha acesso, e `null` quando ha — o
 * formato que os `requireCtx()` espalhados pelo repo ja usam.
 */
export async function assertProAccess(orgId: string): Promise<string | null> {
  const plan = await loadPlanState(orgId);
  // `null` aqui e falha de leitura, nao ausencia de plano: fail-closed.
  if (!plan || !plan.hasProAccess) {
    return "Recurso disponível no Calc3D PRO. Ative seu plano em Configurações > Billing.";
  }
  return null;
}
