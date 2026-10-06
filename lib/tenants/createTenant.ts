/**
 * Criação de organization (tenant), em um lugar só.
 *
 * Existia apenas inline no POST de `/api/v1/admin/tenants`. A aprovação de um
 * pedido do Calc3D PRO e o auto-cadastro do trial criam exatamente o mesmo tipo
 * de linha — copiar o bloco criaria três definições de "o que é um tenant
 * recém-criado", e as cópias esqueceriam `created_by` ou gravariam outro status.
 *
 * Devolve resultado tipado em vez de lançar: os chamadores precisam distinguir
 * conflito de slug (409) de falha real (500), e exceção genérica apagaria essa
 * diferença.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type TenantPlan = "standard" | "pro" | "enterprise";

export interface CreateTenantInput {
  display_name: string;
  slug: string;
  legal_name?: string | null;
  cnpj?: string | null;
  plan: TenantPlan;
  /**
   * Quem criou. `null` quando a criação não tem usuário por trás — a aprovação
   * pelo link assinado do e-mail do dono (lib/pro-signup/approve.ts).
   */
  createdBy: string | null;
  /**
   * Pula o wizard de onboarding. Verdadeiro para quem pagou e para quem entrou
   * pelo trial: os dois precisam cair direto no CRM, não num assistente que pede
   * sessão de WhatsApp e loja Nuvemshop.
   */
  markOnboarded?: boolean;
  /** Fim do trial de 7 dias (ISO). Só o auto-cadastro usa. */
  trialEndsAt?: string | null;
  /** Fim do acesso pago (ISO). NULL com plan='pro' significa sem expiração. */
  planExpiresAt?: string | null;
}

export interface CreatedTenant {
  id: string;
  slug: string;
  display_name: string;
}

export type CreateTenantResult =
  | { ok: true; org: CreatedTenant }
  | { ok: false; code: "slug_conflict" | "internal"; message: string };

export async function createTenant(
  // O client vem de fora porque quem chama já resolveu se usa service role e já
  // provou ser platform admin. Esta função não decide autorização.
  admin: SupabaseClient,
  input: CreateTenantInput,
): Promise<CreateTenantResult> {
  const nowIso = new Date().toISOString();

  const { data, error } = await admin
    .from("organizations")
    .insert({
      display_name: input.display_name,
      // Coluna NOT NULL. Passava `null` aqui, o que fazia TODO insert estourar
      // com 23502 — nem a aprovação de pedido PRO nem o console de admin
      // conseguiam criar tenant. Nome fantasia é o fallback honesto para quem
      // não informou razão social.
      legal_name: input.legal_name?.trim() || input.display_name,
      slug: input.slug,
      cnpj: input.cnpj ?? null,
      // 'onboarding' NÃO é valor válido: `organizations_status_check` admite
      // apenas active/suspended/redacted/archived, e o insert estourava com
      // 23514. Status e progresso de onboarding eram dois conceitos colapsados
      // num campo só — "ainda em onboarding" é `onboarded_at IS NULL`, que é
      // exatamente o que aquela coluna documenta.
      status: "active",
      onboarded_at: input.markOnboarded ? nowIso : null,
      plan: input.plan,
      trial_ends_at: input.trialEndsAt ?? null,
      plan_expires_at: input.planExpiresAt ?? null,
      // A coluna `plan` é a única fonte da verdade (migration 0082). O antigo
      // `settings.plan` deixou de ser escrito quando o último leitor
      // (TenantOverview) passou a ler a coluna.
      created_by: input.createdBy,
    })
    .select("id, slug, display_name")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, code: "slug_conflict", message: "Slug already exists" };
    }
    return { ok: false, code: "internal", message: error.message };
  }

  return {
    ok: true,
    org: {
      id: data.id as string,
      slug: data.slug as string,
      display_name: data.display_name as string,
    },
  };
}
