/**
 * Decides whether a contact may be hard-deleted.
 *
 * Rule: a contact with ANY history is never deleted (CLAUDE.md anti-pattern #7,
 * "cascade fantasma"). Most FKs to contacts(id) are `on delete set null`, so a
 * delete would silently orphan conversations, sales and O.S.; `conversations`
 * and `messages` are `restrict` and would fail outright. For people with
 * history the LGPD path is anonymization, which keeps the records and removes
 * the personal data.
 *
 * Tables referencing contacts(id) (supabase/baseline.sql FK catalog):
 *   conversations, messages            → history (restrict)
 *   service_orders                     → history (O.S.)
 *   marketplace_orders, orders         → history (sales: manual/Shopee + Nuvemshop)
 *   crm_leads, crm_lead_activities     → history (pipeline / timeline)
 *   crm_lead_links (target_kind=contact, polymorphic, no FK) → history
 *   lgpd_requests                      → history (legal record must keep its subject)
 *   ai_agent_runs                      → history (what the bot did for this person)
 *   contacts.is_merged_into            → history (other records were merged into this one)
 *   model_folders                      → NOT history: optional folder↔client link,
 *                                        the folder survives with contact_id = null.
 *
 * Pure function: the route counts, this decides. Unit-tested.
 */

export interface ContactHistoryCounts {
  conversations: number;
  messages: number;
  service_orders: number;
  marketplace_orders: number;
  orders: number;
  crm_leads: number;
  crm_lead_activities: number;
  crm_lead_links: number;
  lgpd_requests: number;
  ai_agent_runs: number;
  merged_contacts: number;
}

/** Shape returned to the client in the 409 `details`. */
export interface ContactHistoryDetails {
  conversations: number;
  service_orders: number;
  sales: number;
  leads: number;
  lgpd_requests: number;
  other: number;
}

export type ContactDeletionDecision =
  | { allowed: true }
  | { allowed: false; details: ContactHistoryDetails };

const safe = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

export function decideContactDeletion(counts: ContactHistoryCounts): ContactDeletionDecision {
  const details: ContactHistoryDetails = {
    // Messages without a conversation row are still conversation history.
    conversations: safe(counts.conversations) || (safe(counts.messages) > 0 ? 1 : 0),
    service_orders: safe(counts.service_orders),
    sales: safe(counts.marketplace_orders) + safe(counts.orders),
    leads: safe(counts.crm_leads) + safe(counts.crm_lead_links),
    lgpd_requests: safe(counts.lgpd_requests),
    other:
      safe(counts.crm_lead_activities) + safe(counts.ai_agent_runs) + safe(counts.merged_contacts),
  };
  const total = Object.values(details).reduce((a, b) => a + b, 0);
  return total === 0 ? { allowed: true } : { allowed: false, details };
}
