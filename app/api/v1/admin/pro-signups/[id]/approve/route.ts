/**
 * POST /api/v1/admin/pro-signups/:id/approve
 *
 * Libera o PRO para um pedido pago. Dois caminhos:
 *
 *  - UPGRADE: o comprador já tem organização (veio do trial, ou está renovando).
 *    Estende `plan_expires_at` da org existente. **Não** cria tenant e **não**
 *    manda "crie sua senha" — ele já tem senha, e mandar isso transformaria o
 *    console de admin num vetor de redefinição de senha de terceiros.
 *  - CREATE: comprador novo. Cria o tenant e emite o link de ativação.
 *
 * Quando há mais de uma organização candidata, a rota devolve 409
 * `ambiguous_org` com a lista — escolher sozinha daria PRO para a org errada e
 * deixaria o cliente sem acesso onde ele trabalha.
 *
 * A lógica mora em `lib/pro-signup/approve.ts` (`approveProSignup`), compartilhada
 * com a aprovação em 1 clique do e-mail do dono
 * (`/api/v1/public/pro-signup/email-action`). Esta rota é só o invólucro do
 * painel: exige sessão de platform admin (o layout de /admin já cobra MFA AAL2)
 * e traduz o resultado para HTTP.
 *
 * Sobre o link do e-mail (antes proibido aqui): o desenho atual é seguro porque
 * (1) abrir /aprovar/<token> NUNCA muta — a página mostra o resumo e só faz o
 * POST quando o dono clica em "Confirmar…". Não basta o GET ser inofensivo:
 * scanners de e-mail (Defender Safe Links, Proofpoint, Mimecast) abrem o link num
 * navegador headless COM JavaScript, então um POST automático ao montar seria
 * disparado por eles;
 * (2) o token é HMAC com segredo próprio, preso ao propósito, à ação, ao pedido e
 * ao valor, e vale 48h; (3) o efeito é único: só pedido `pending` muda, via claim
 * condicional; (4) todo uso dispara um e-mail de alarme ao dono com o link para
 * remover o plano no painel de Assinantes.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/wrappers";
import { clientIp } from "@/lib/api/client-ip";
import { approveProSignup, type ApproveFailure } from "@/lib/pro-signup/approve";

const bodySchema = z
  .object({
    // Só usados no caminho CREATE. Numa org que já existe não se escolhe nome.
    display_name: z.string().trim().min(2).max(120).optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[a-z0-9-]+$/, "Slug deve ser minúsculo, alfanumérico com hífens")
      .optional(),
    legal_name: z.string().trim().min(2).max(255).optional(),
    cnpj: z.string().trim().max(20).optional(),
    /** Desempate quando há várias orgs candidatas. */
    organization_id: z.string().uuid().optional(),
  })
  .strict();

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  const { id } = await ctx.params;

  let adminCtx: Awaited<ReturnType<typeof requirePlatformAdmin>>;
  try {
    adminCtx = await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403, { requestId });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("validation_error", "Invalid JSON body", 400, { requestId });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", "Invalid request body", 400, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  const result = await approveProSignup({
    admin: createAdminClient(),
    requestId,
    signupId: id,
    reviewerUserId: adminCtx.user.id,
    chosenOrgId: parsed.data.organization_id ?? null,
    via: "panel",
    ip: clientIp(req),
    tenant: {
      display_name: parsed.data.display_name,
      slug: parsed.data.slug,
      legal_name: parsed.data.legal_name ?? null,
      cnpj: parsed.data.cnpj ?? null,
    },
  });

  switch (result.outcome) {
    case "ambiguous":
      return fail(
        "ambiguous_org",
        result.reason === "account_newer_than_request"
          ? "A conta com este e-mail foi criada DEPOIS do pedido (o cadastro não confirma o e-mail). Confirme com o comprador e escolha a organização explicitamente — ou recuse."
          : "Este e-mail pertence a mais de uma organização. Escolha qual deve receber o PRO.",
        409,
        { requestId, details: { candidates: result.candidates, reason: result.reason } },
      );
    case "error":
      return approveFailureResponse(result, requestId);
    case "approved":
      if (result.mode === "upgrade") {
        return ok(
          {
            id,
            status: "approved",
            mode: "upgrade",
            organization_id: result.organizationId,
            buyer_membership: result.membership,
            plan_expires_at: result.planExpiresAt,
            email_dispatched: result.emailDispatched,
          },
          { status: 201, requestId },
        );
      }
      return ok(
        {
          id,
          status: "approved",
          mode: "create",
          organization: result.organization,
          existing_account: result.existingAccount,
          activation_url: result.activationUrl,
          activation_expires_at: result.activationExpiresAt,
          plan_expires_at: result.planExpiresAt,
          email_dispatched: result.emailDispatched,
        },
        { status: 201, requestId },
      );
  }
}

function approveFailureResponse(result: ApproveFailure, requestId: string) {
  switch (result.error) {
    case "not_found":
      return fail("not_found", result.message, 404, { requestId });
    case "not_pending":
      return fail("conflict", result.message, 409, { requestId });
    case "slug_conflict":
      return fail("conflict", result.message, 409, { requestId });
    case "missing_tenant_fields":
    case "amount_mismatch":
      return fail("validation_error", result.message, 400, { requestId });
    case "internal":
      return fail("internal_error", result.message, 500, {
        requestId,
        details: result.organizationId ? `organization_id=${result.organizationId}` : undefined,
      });
  }
}
