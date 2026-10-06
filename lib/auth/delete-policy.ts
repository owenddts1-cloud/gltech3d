import type { Role } from "./types";

/**
 * Minimum role to DELETE rows of each business table, as enforced by RLS since
 * migration 0084 (supabase/migrations/20261007120000_0084_*.sql).
 *
 * `member` = any member of the org (the save of these tables is replace-all:
 * upsert the list, delete what the user removed — deletion is ordinary editing).
 *
 * This map mirrors the database; it does not enforce anything by itself.
 * tests/unit/role-delete-policies-drift.test.ts fails if the migration or the
 * baseline appendix disagree with it.
 */
export const TABLE_DELETE_MIN_ROLE = {
  contacts: "admin",
  financial_records: "admin",
  crm_leads: "manager",
  conversations: "manager",
  messages: "manager",
  print_jobs: "manager",
  service_orders: "manager",
  products: "manager",
  inventory_assets: "manager",
  projects: "manager",
  suppliers: "manager",
  supplier_purchases: "manager",
  calendar_events: "manager",
  marketplace_orders: "manager",
  service_order_documents: "manager",
  filaments: "member",
  printers: "member",
  service_order_items: "member",
} as const satisfies Record<string, Role | "member">;

export type DeleteGuardedTable = keyof typeof TABLE_DELETE_MIN_ROLE;

const ROLE_LABEL: Record<Role | "member", string> = {
  member: "membro da organização",
  viewer: "leitor",
  agent: "atendente",
  manager: "gerente ou administrador",
  admin: "administrador",
};

/**
 * Message for a DELETE that matched zero rows. Under RLS a denied DELETE does
 * not raise: it deletes nothing. The row may also have been removed meanwhile,
 * so the message covers both instead of claiming one.
 */
export function deleteDeniedMessage(table: DeleteGuardedTable): string {
  const min = TABLE_DELETE_MIN_ROLE[table];
  return `Nada foi excluído: o registro não existe mais ou excluir aqui exige perfil de ${ROLE_LABEL[min]}.`;
}
