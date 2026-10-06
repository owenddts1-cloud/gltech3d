/**
 * Server-side auth helpers — load AuthUser, resolve active org, gate routes.
 *
 * Uses the service-role admin client to read tenant-scoped tables
 * (`user_organizations`, `platform_admins`, `organizations`) — RLS bypass is
 * intentional here because we resolve the user from the validated JWT first
 * and then filter by `user_id` (a trusted source).
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthUser, Role, UserOrgMembership, ActiveOrg } from "./types";
import { pickActiveOrg, pickSelectedMembership, toActiveOrg } from "./active-org";

const ACTIVE_ORG_COOKIE = "active_org";

interface RawOrgEmbed {
  display_name: string;
  status: string;
}

interface RawMembershipRow {
  organization_id: string;
  role: string;
  organizations: RawOrgEmbed | RawOrgEmbed[] | null;
}

/**
 * Loads the AuthUser for the current request. Returns null if unauthenticated.
 * Use only in Server Components / Route Handlers / Server Actions.
 *
 * Uses the user-scoped server client (cookie session). RLS policies allow:
 * - user_organizations: user_id = auth.uid() (user_orgs_select)
 * - organizations: id IN fn_user_org_ids()  (orgs_select)
 * - platform_admins: only platform admins read (so non-admins get null — correct)
 */
export async function loadAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Platform admin? (active = no revoked_at). RLS returns null for non-admins.
  const { data: paRow } = await supabase
    .from("platform_admins")
    .select("user_id, revoked_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .maybeSingle();

  // Org memberships (only active = not revoked, accepted)
  const { data: rawMemberships } = await supabase
    .from("user_organizations")
    .select("organization_id, role, organizations(display_name, status)")
    .eq("user_id", user.id)
    .is("revoked_at", null);

  const rows = (rawMemberships ?? []) as RawMembershipRow[];
  const memberships: UserOrgMembership[] = rows.map((row) => {
    // The embed is null when RLS hides the org row: since migration 0084 a
    // non-admin member cannot read a suspended org (orgs_select relies on
    // fn_user_org_ids, which only returns active orgs).
    const org = Array.isArray(row.organizations) ? (row.organizations[0] ?? null) : row.organizations;
    return {
      organization_id: row.organization_id,
      organization_name: org?.display_name ?? "—",
      role: row.role as Role,
      organization_status: org?.status ?? null,
    };
  });

  const fullName = (user.user_metadata?.full_name as string | undefined) ?? null;
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  return {
    id: user.id,
    email: user.email ?? "",
    full_name: fullName,
    avatar_url: avatarUrl,
    is_platform_admin: !!paRow,
    organizations: memberships,
  };
}

/**
 * Resolves the active organization for the current request (API handlers and
 * server actions). Priority: cookie `active_org` (if member of) → first
 * membership. Returns null if the user has zero memberships OR the selected org
 * is not `active` (suspended/redacted/archived) — unless platform admin. Same
 * rule RLS applies since migration 0084; see lib/auth/active-org.ts.
 */
export async function resolveActiveOrg(authUser: AuthUser): Promise<ActiveOrg | null> {
  if (authUser.organizations.length === 0) return null;
  const store = await cookies();
  return pickActiveOrg(authUser, store.get(ACTIVE_ORG_COOKIE)?.value);
}

/**
 * The selected org IGNORING its status. Only for `loadAppShellContext()`, which
 * must see a suspended org to redirect to /account-suspended. Anything that
 * reads or writes tenant data uses `resolveActiveOrg()`.
 */
export async function resolveSelectedOrgForShell(authUser: AuthUser): Promise<ActiveOrg | null> {
  if (authUser.organizations.length === 0) return null;
  const store = await cookies();
  const m = pickSelectedMembership(authUser, store.get(ACTIVE_ORG_COOKIE)?.value);
  return m ? toActiveOrg(m) : null;
}

/**
 * For Server Components / Server Actions in /app/(app)/* routes — guarantees
 * an authenticated user. Redirects to /login if not.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await loadAuthUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Returns true if the current session has at least one verified TOTP factor.
 * Use only in Server Components / Server Actions (cookie session).
 */
export async function isMfaEnrolled(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  return !!data?.totp?.some((f) => f.status === "verified");
}

export interface MfaPolicyInput {
  role: Role | undefined;
  isPlatformAdmin: boolean;
  /** `admin` de alguma org com plano pago vigente. Trial nao conta. */
  hasPaidPlan: boolean;
}

/**
 * MFA enforcement policy.
 *
 * Platform admins sempre. Tenant `admin` SO quando ha plano pago — nao durante o
 * trial de 7 dias.
 *
 * Por que o trial e excecao: a doutrina de TOTP obrigatorio existe para proteger
 * PII de clientes reais. Um tenant em trial com tres pecas de teste nao tem esse
 * risco, e forcar a instalacao de um authenticator ANTES de a pessoa ver uma
 * unica tela do produto mataria a conversao. No dia em que o Pix e aprovado — e
 * a org passa a guardar dados de verdade — o gate liga.
 *
 * Consequencia operacional, documentada no runbook: no primeiro login depois da
 * aprovacao do pagamento o usuario e levado ao enrolamento de TOTP.
 */
export function requiresMfa(input: MfaPolicyInput): boolean {
  if (input.isPlatformAdmin) return true;
  return input.role === "admin" && input.hasPaidPlan;
}
