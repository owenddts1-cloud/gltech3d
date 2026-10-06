/**
 * Approval / rejection core of a Calc3D PRO request.
 *
 * Two entry points call this:
 *  - `POST /api/v1/admin/pro-signups/:id/approve` (and the reject PATCH) — the
 *    platform-admin panel, `via: "panel"`;
 *  - `POST /api/v1/public/pro-signup/email-action` — the one-click buttons of the
 *    owner's email, `via: "email_link"`, no session (`reviewerUserId: null`).
 *
 * The caller authorizes (platform admin, or a verified signed token). This
 * module decides WHAT happens and guarantees it happens at most once:
 *
 *  1. Every check that can refuse (not found, not pending, amount, ambiguous org,
 *     missing tenant fields) runs BEFORE anything is written.
 *  2. The request is then CLAIMED with a conditional `pending → approved`
 *     update. Only one concurrent caller wins the claim; the other gets
 *     `not_pending`. This is what makes a double click — or the email link and
 *     the panel at the same time — grant the plan once, not twice.
 *  3. If granting/creating fails after the claim, the claim is reverted to
 *     `pending` so the operator can retry.
 */
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { audit as auditImpl } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { findUserIdByEmail as findUserIdByEmailImpl } from "@/lib/auth/admin-users";
import { signInviteToken as signInviteTokenImpl } from "@/lib/auth/invite-token";
import { grantProAccess as grantProAccessImpl } from "@/lib/plan/server";
import { createTenant as createTenantImpl, type CreatedTenant } from "@/lib/tenants/createTenant";
import { sendEmail as sendEmailImpl } from "@/lib/email/send";
import { buildProActivationEmail } from "@/lib/email/templates/pro-activation";
import { buildProUpgradedEmail } from "@/lib/email/templates/pro-upgraded";
import { absoluteSiteUrl } from "@/lib/marketing/site-url";
import { PRO_PLANS } from "@/lib/pricing/pro-plans";
import { slugify } from "@/lib/text/slugify";
import { ACTIVATION_TTL_SECONDS } from "./constants";
import { resolveTargetOrg, type Membership } from "./resolve-target-org";
import { buyerMembershipOutcome, type BuyerMembership } from "./buyer-membership";

export type { BuyerMembership };

export type ApprovalVia = "panel" | "email_link";

/** Side effects, injectable so the decision branches are testable without I/O. */
export interface ApproveDeps {
  findUserIdByEmail: typeof findUserIdByEmailImpl;
  grantProAccess: typeof grantProAccessImpl;
  createTenant: typeof createTenantImpl;
  sendEmail: typeof sendEmailImpl;
  audit: typeof auditImpl;
  signInviteToken: typeof signInviteTokenImpl;
  now: () => Date;
}

const DEFAULT_DEPS: ApproveDeps = {
  findUserIdByEmail: findUserIdByEmailImpl,
  grantProAccess: grantProAccessImpl,
  createTenant: createTenantImpl,
  sendEmail: sendEmailImpl,
  audit: auditImpl,
  signInviteToken: signInviteTokenImpl,
  now: () => new Date(),
};

export interface BuyerInfo {
  name: string;
  email: string;
  phone: string | null;
}

export interface TenantFields {
  display_name?: string;
  slug?: string;
  legal_name?: string | null;
  cnpj?: string | null;
}

export interface ApproveProSignupArgs {
  admin: SupabaseClient;
  requestId: string;
  signupId: string;
  reviewerUserId: string | null;
  chosenOrgId: string | null;
  via: ApprovalVia;
  ip: string | null;
  /**
   * CREATE path only. From the panel both `display_name` and `slug` are
   * required (the operator chose them). From the email link they are derived
   * from the request, retrying the slug with a suffix on conflict.
   */
  tenant?: TenantFields;
  reviewNote?: string | null;
  /** Amount the caller saw (the email token). A mismatch refuses before writing. */
  expectedAmountCents?: number;
  deps?: Partial<ApproveDeps>;
}

export interface ApprovedUpgrade {
  outcome: "approved";
  mode: "upgrade";
  signupId: string;
  organizationId: string;
  organizationName: string;
  membership: BuyerMembership;
  /** null = the org already had an unlimited paid plan; approval kept it. */
  planExpiresAt: string | null;
  emailDispatched: boolean;
  buyer: BuyerInfo;
}

export interface ApprovedCreate {
  outcome: "approved";
  mode: "create";
  signupId: string;
  organization: CreatedTenant;
  /**
   * `true` when the buyer's e-mail already had an account (with no org): they
   * were added as admin of the new org and log in with their CURRENT password.
   * No activation link exists in that case - an activation link would let
   * whoever holds it set the password of someone else's account.
   */
  existingAccount: boolean;
  /** Only for brand-new accounts. */
  activationUrl: string | null;
  activationExpiresAt: string | null;
  planExpiresAt: string;
  emailDispatched: boolean;
  buyer: BuyerInfo;
}

export interface AmbiguousOrg {
  outcome: "ambiguous";
  signupId: string;
  candidates: readonly Membership[];
}

export type ApproveErrorCode =
  | "not_found"
  | "not_pending"
  | "amount_mismatch"
  | "missing_tenant_fields"
  | "slug_conflict"
  | "internal";

export interface ApproveFailure {
  outcome: "error";
  error: ApproveErrorCode;
  message: string;
  /** For `not_pending`: what the request already is. */
  currentStatus?: string;
  organizationId?: string | null;
}

export type ApproveProSignupResult = ApprovedUpgrade | ApprovedCreate | AmbiguousOrg | ApproveFailure;

interface SignupRow {
  id: string;
  status: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string | null;
  company_name: string | null;
  organization_id: string | null;
  amount_cents: number;
}

const SIGNUP_COLUMNS =
  "id, status, buyer_name, buyer_email, buyer_phone, company_name, organization_id, amount_cents";

function failure(
  error: ApproveErrorCode,
  message: string,
  extra: Partial<ApproveFailure> = {},
): ApproveFailure {
  return { outcome: "error", error, message, ...extra };
}

/** Slug candidates for the email path: the natural one, then 3 suffixed ones. */
export function slugCandidates(base: string, random: () => string): string[] {
  const root = slugify(base);
  const safeRoot = root.length >= 2 ? root : "cliente";
  const trimmed = safeRoot.slice(0, 35).replace(/-+$/, "");
  return [safeRoot, `${trimmed}-${random()}`, `${trimmed}-${random()}`, `${trimmed}-${random()}`];
}

const randomSuffix = () => randomBytes(2).toString("hex");

export async function approveProSignup(args: ApproveProSignupArgs): Promise<ApproveProSignupResult> {
  const deps: ApproveDeps = { ...DEFAULT_DEPS, ...args.deps };
  const { admin, requestId, signupId } = args;

  const { data, error: readErr } = await admin
    .from("pro_signup_requests")
    .select(SIGNUP_COLUMNS)
    .eq("id", signupId)
    .maybeSingle();

  if (readErr) {
    logger.error("pro_signup_approve_load_failed", { requestId, signupId, details: readErr.message });
    return failure("internal", "Falha ao carregar o pedido");
  }
  if (!data) return failure("not_found", "Pedido não encontrado");
  const row = data as SignupRow;

  if (row.status !== "pending") {
    return failure("not_pending", "Pedido já processado", {
      currentStatus: row.status,
      organizationId: row.organization_id,
    });
  }
  if (args.expectedAmountCents !== undefined && args.expectedAmountCents !== row.amount_cents) {
    return failure("amount_mismatch", "O valor do pedido mudou desde o envio do e-mail");
  }

  const buyerEmail = row.buyer_email.trim().toLowerCase();
  const buyer: BuyerInfo = { name: row.buyer_name, email: buyerEmail, phone: row.buyer_phone };
  const plan = PRO_PLANS.pro;

  // --- A quem este pagamento dá PRO? ---------------------------------------
  const existingUserId = await deps.findUserIdByEmail(admin, buyerEmail);
  let memberships: Membership[] = [];
  if (existingUserId) {
    const { data: rows, error: memErr } = await admin
      .from("user_organizations")
      .select("organization_id, organizations(display_name)")
      .eq("user_id", existingUserId)
      .is("revoked_at", null);
    if (memErr) {
      // Lendo memberships como "nenhuma" criaríamos uma SEGUNDA org para quem
      // já tem uma. Falhar é o lado seguro.
      logger.error("pro_signup_memberships_failed", { requestId, signupId, details: memErr.message });
      return failure("internal", "Falha ao ler as organizações do comprador");
    }
    memberships = (rows ?? []).map((r) => {
      const orgRel = r.organizations as { display_name?: string } | null;
      return {
        organizationId: r.organization_id as string,
        organizationName: orgRel?.display_name ?? "—",
      };
    });
  }

  const target = resolveTargetOrg({
    requestOrgId: row.organization_id,
    existingUserId,
    memberships,
    chosenOrgId: args.chosenOrgId,
  });

  if (target.mode === "ambiguous") {
    return { outcome: "ambiguous", signupId, candidates: target.candidates };
  }

  if (target.mode === "create" && args.via === "panel") {
    if (!args.tenant?.display_name || !args.tenant.slug) {
      return failure("missing_tenant_fields", "Nome e slug são obrigatórios para criar um tenant");
    }
  }

  // --- Membership do comprador (só leitura, antes de qualquer escrita) -----
  let membership: BuyerMembership = "no_account";
  if (target.mode === "upgrade" && target.userId) {
    const { data: mRow, error: mErr } = await admin
      .from("user_organizations")
      .select("id, revoked_at")
      .eq("user_id", target.userId)
      .eq("organization_id", target.organizationId)
      .maybeSingle();
    if (mErr) {
      logger.error("pro_signup_membership_read_failed", { requestId, signupId, details: mErr.message });
      return failure("internal", "Falha ao ler o acesso do comprador");
    }
    membership = buyerMembershipOutcome(
      target.userId,
      mRow ? { revoked_at: (mRow.revoked_at as string | null) ?? null } : null,
    );
  }

  // --- Claim: pending → approved, uma vez só -------------------------------
  const reviewedAt = deps.now().toISOString();
  const claimPatch: Record<string, string | null> = {
    status: "approved",
    reviewed_by: args.reviewerUserId,
    reviewed_at: reviewedAt,
    invited_user_email: buyerEmail,
  };
  if (args.reviewNote) claimPatch.review_note = args.reviewNote;
  if (target.mode === "upgrade") claimPatch.organization_id = target.organizationId;

  const { data: claimed, error: claimErr } = await admin
    .from("pro_signup_requests")
    .update(claimPatch)
    .eq("id", signupId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (claimErr) {
    logger.error("pro_signup_claim_failed", { requestId, signupId, details: claimErr.message });
    return failure("internal", "Falha ao registrar a aprovação");
  }
  if (!claimed) {
    // Outro clique (painel ou e-mail) ganhou a corrida.
    return failure("not_pending", "Pedido já processado");
  }

  const revertClaim = async (reason: string) => {
    const { error } = await admin
      .from("pro_signup_requests")
      .update({
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        invited_user_email: null,
        organization_id: row.organization_id,
      })
      .eq("id", signupId)
      .eq("status", "approved");
    if (error) {
      // O pedido fica "aprovado" sem plano concedido. Precisa de mão humana.
      logger.error("pro_signup_claim_revert_failed", {
        requestId,
        signupId,
        reason,
        details: error.message,
      });
    }
  };

  // --- UPGRADE: a org já existe --------------------------------------------
  if (target.mode === "upgrade") {
    // Nenhuma escrita em user_organizations aqui: ver `BuyerMembership`.
    if (membership === "revoked_not_reactivated" || membership === "missing_not_created") {
      logger.warn("pro_signup_buyer_without_access", {
        requestId,
        signupId,
        organizationId: target.organizationId,
        membership,
      });
    }

    const granted = await deps.grantProAccess(admin, target.organizationId, plan.periodDays);
    if (!granted.ok) {
      logger.error("pro_signup_grant_failed", {
        requestId,
        signupId,
        organizationId: target.organizationId,
        details: granted.message,
      });
      await revertClaim("grant_failed");
      return failure("internal", "Falha ao liberar o plano");
    }

    const { data: orgRow } = await admin
      .from("organizations")
      .select("display_name")
      .eq("id", target.organizationId)
      .maybeSingle();
    const organizationName =
      (orgRow?.display_name as string | undefined) ?? row.company_name ?? "sua operação";

    const emailDispatched = await sendBuyerEmail(deps, requestId, signupId, buyerEmail, () =>
      buildProUpgradedEmail({
        buyerName: row.buyer_name,
        orgName: organizationName,
        planExpiresAt: granted.planExpiresAt ? new Date(granted.planExpiresAt) : null,
        appUrl: absoluteSiteUrl("/app/dashboard"),
      }),
    );

    await deps.audit({
      action: "pro_signup.approved",
      actorUserId: args.reviewerUserId,
      actingAsPlatformAdmin: args.via === "panel",
      bypassedRls: true,
      organizationId: target.organizationId,
      resourceType: "pro_signup_request",
      resourceId: signupId,
      requestId,
      ip: args.ip,
      // `mode` responde depois "por que esse cliente tem duas orgs"; `via`
      // responde "quem aprovou sem login".
      metadata: {
        mode: "upgrade",
        via: args.via,
        plan: "pro",
        plan_expires_at: granted.planExpiresAt,
        email_dispatched: emailDispatched,
        buyer_membership: membership,
      },
    });

    return {
      outcome: "approved",
      mode: "upgrade",
      signupId,
      organizationId: target.organizationId,
      organizationName,
      membership,
      planExpiresAt: granted.planExpiresAt,
      emailDispatched,
      buyer,
    };
  }

  // --- CREATE: comprador novo ----------------------------------------------
  const planExpiresAt = new Date(deps.now().getTime() + plan.periodDays * 86_400_000).toISOString();
  const displayName =
    args.tenant?.display_name?.trim() || row.company_name?.trim() || row.buyer_name.trim();
  const slugs = args.tenant?.slug
    ? [args.tenant.slug]
    : slugCandidates(displayName, randomSuffix);

  let org: CreatedTenant | null = null;
  for (const slug of slugs) {
    const created = await deps.createTenant(admin, {
      display_name: displayName,
      slug,
      legal_name: args.tenant?.legal_name ?? null,
      cnpj: args.tenant?.cnpj ?? null,
      plan: "pro",
      planExpiresAt,
      createdBy: args.reviewerUserId,
      // Quem pagou não cai no wizard de WhatsApp/Nuvemshop.
      markOnboarded: true,
    });
    if (created.ok) {
      org = created.org;
      break;
    }
    if (created.code !== "slug_conflict") {
      logger.error("pro_signup_create_tenant_failed", { requestId, signupId, details: created.message });
      await revertClaim("create_failed");
      return failure("internal", "Falha ao criar o tenant");
    }
  }
  if (!org) {
    await revertClaim("slug_conflict");
    return failure("slug_conflict", "Já existe um tenant com este slug");
  }

  const existingAccount = target.userId !== null;
  const createdOrg = org;

  // Conta já existente (sem org): vira admin da org NOVA - que não tem nenhuma
  // linha de membership, então não há papel anterior a sobrescrever. Sem link
  // de ativação: ele entra com a senha que já tem.
  if (target.userId) {
    const { error: memberErr } = await admin.from("user_organizations").insert({
      user_id: target.userId,
      organization_id: org.id,
      role: "admin",
      invited_at: reviewedAt,
      accepted_at: reviewedAt,
    });
    if (memberErr) {
      // A org nova fica órfã (sem membros, sem pedido apontando para ela). O
      // pedido volta a pending para nova tentativa; o log aponta a órfã.
      logger.error("pro_signup_existing_account_membership_failed", {
        requestId,
        signupId,
        orphanOrganizationId: org.id,
        details: memberErr.message,
      });
      await revertClaim("existing_account_membership_failed");
      return failure("internal", "Falhou ao dar acesso à conta existente. Tente aprovar de novo.");
    }
  }

  let activationUrl: string | null = null;
  let expiresAt: Date | null = null;
  if (!existingAccount) {
    expiresAt = new Date(deps.now().getTime() + ACTIVATION_TTL_SECONDS * 1000);
    // Reusa o token de convite de equipe: o payload já descreve exatamente isto.
    // A ativação só DEFINE senha criando a conta - nunca numa conta existente
    // (lib/pro-signup/activate.ts) - e isso também torna o link de uso único.
    const token = deps.signInviteToken({
      invite_id: signupId,
      email: buyerEmail,
      organization_id: org.id,
      role: "admin",
      exp: Math.floor(expiresAt.getTime() / 1000),
    });
    activationUrl = absoluteSiteUrl(`/ativar/${token}`);
  }

  // A ativação confere `organization_id` do pedido contra o token: sem este
  // vínculo o link não funciona.
  const { error: linkErr } = await admin
    .from("pro_signup_requests")
    .update({ organization_id: org.id })
    .eq("id", signupId);
  if (linkErr) {
    logger.error("pro_signup_link_org_failed", {
      requestId,
      signupId,
      organizationId: org.id,
      details: linkErr.message,
    });
    return failure("internal", "Tenant criado, mas o pedido não foi vinculado a ele", {
      organizationId: org.id,
    });
  }

  const emailDispatched = await sendBuyerEmail(deps, requestId, signupId, buyerEmail, () =>
    activationUrl && expiresAt
      ? buildProActivationEmail({
          buyerName: row.buyer_name,
          orgName: createdOrg.display_name,
          activationUrl,
          expiresAt,
        })
      : buildProUpgradedEmail({
          buyerName: row.buyer_name,
          orgName: createdOrg.display_name,
          planExpiresAt: new Date(planExpiresAt),
          appUrl: absoluteSiteUrl("/app/dashboard"),
        }),
  );

  await deps.audit({
    action: "pro_signup.approved",
    actorUserId: args.reviewerUserId,
    actingAsPlatformAdmin: args.via === "panel",
    bypassedRls: true,
    organizationId: org.id,
    resourceType: "pro_signup_request",
    resourceId: signupId,
    requestId,
    ip: args.ip,
    metadata: {
      mode: "create",
      via: args.via,
      existing_account: existingAccount,
      slug: org.slug,
      plan: "pro",
      plan_expires_at: planExpiresAt,
      email_dispatched: emailDispatched,
    },
  });

  return {
    outcome: "approved",
    mode: "create",
    signupId,
    organization: org,
    existingAccount,
    activationUrl,
    activationExpiresAt: expiresAt ? expiresAt.toISOString() : null,
    planExpiresAt,
    emailDispatched,
    buyer,
  };
}

/**
 * Awaited on purpose: the panel must say whether the email left (without a
 * verified sender every send fails and the operator has to copy the link).
 * Never throws — an email failure cannot undo a plan already granted.
 */
async function sendBuyerEmail(
  deps: ApproveDeps,
  requestId: string,
  signupId: string,
  to: string,
  build: () => { subject: string; html: string; text: string },
): Promise<boolean> {
  try {
    const mail = build();
    const res = await deps.sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text });
    if (!res.ok) {
      logger.error("pro_signup_buyer_email_failed", {
        requestId,
        signupId,
        reason: res.error,
        details: res.details,
      });
    }
    return res.ok;
  } catch (err) {
    logger.error("pro_signup_buyer_email_threw", {
      requestId,
      signupId,
      details: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Reject
// ---------------------------------------------------------------------------

export interface RejectProSignupArgs {
  admin: SupabaseClient;
  requestId: string;
  signupId: string;
  reviewerUserId: string | null;
  reviewNote: string | null;
  via: ApprovalVia;
  ip: string | null;
  deps?: Partial<Pick<ApproveDeps, "audit" | "now">>;
}

export type RejectProSignupResult =
  | { outcome: "rejected"; signupId: string }
  | { outcome: "error"; error: "not_pending" | "internal"; message: string };

export async function rejectProSignup(args: RejectProSignupArgs): Promise<RejectProSignupResult> {
  const audit = args.deps?.audit ?? DEFAULT_DEPS.audit;
  const now = args.deps?.now ?? DEFAULT_DEPS.now;

  // O filtro por `status = 'pending'` é a guarda de concorrência: rejeitar um
  // pedido já aprovado não pode desfazer o tenant criado.
  const { data, error } = await args.admin
    .from("pro_signup_requests")
    .update({
      status: "rejected",
      review_note: args.reviewNote,
      reviewed_by: args.reviewerUserId,
      reviewed_at: now().toISOString(),
    })
    .eq("id", args.signupId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    logger.error("pro_signup_reject_failed", {
      requestId: args.requestId,
      signupId: args.signupId,
      details: error.message,
    });
    return { outcome: "error", error: "internal", message: "Falha ao rejeitar" };
  }
  if (!data) {
    return { outcome: "error", error: "not_pending", message: "Pedido já processado ou inexistente" };
  }

  await audit({
    action: "pro_signup.rejected",
    actorUserId: args.reviewerUserId,
    actingAsPlatformAdmin: args.via === "panel",
    bypassedRls: true,
    resourceType: "pro_signup_request",
    resourceId: args.signupId,
    requestId: args.requestId,
    ip: args.ip,
    metadata: { has_note: !!args.reviewNote, via: args.via },
  });

  return { outcome: "rejected", signupId: args.signupId };
}
