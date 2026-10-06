/**
 * Regra do "último admin", pura.
 *
 * Uma org sem nenhum admin ativo fica sem ninguém capaz de convidar, mudar
 * papéis ou configurar cobrança — e só o suporte da plataforma desfaz isso. A
 * rota do tenant (`/api/v1/team/[user_id]/role`) e o painel de Assinantes
 * (`/api/v1/admin/subscribers/[orgId]/members/[userId]`) aplicam a mesma regra.
 */
import type { Role } from "./types";

export function isLastAdminDemotion(input: {
  currentRole: string;
  nextRole: Role;
  /** Admins ATIVOS (revoked_at nulo) da org, incluindo o alvo. */
  activeAdminCount: number;
}): boolean {
  return input.currentRole === "admin" && input.nextRole !== "admin" && input.activeAdminCount <= 1;
}
