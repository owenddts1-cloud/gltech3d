import { describe, expect, it } from "vitest";
import { decideContactDeletion, type ContactHistoryCounts } from "./delete-guard";

const none: ContactHistoryCounts = {
  conversations: 0, messages: 0, service_orders: 0, marketplace_orders: 0, orders: 0,
  crm_leads: 0, crm_lead_activities: 0, crm_lead_links: 0, lgpd_requests: 0,
  ai_agent_runs: 0, merged_contacts: 0,
};

describe("decideContactDeletion", () => {
  it("allows deleting a contact with no history at all", () => {
    expect(decideContactDeletion(none)).toEqual({ allowed: true });
  });

  it.each(Object.keys(none) as Array<keyof ContactHistoryCounts>)(
    "blocks when only %s references the contact",
    (key) => {
      const d = decideContactDeletion({ ...none, [key]: 1 });
      expect(d.allowed).toBe(false);
    },
  );

  it("reports conversations, O.S. and sales (manual + Nuvemshop) separately", () => {
    const d = decideContactDeletion({ ...none, conversations: 2, service_orders: 1, marketplace_orders: 3, orders: 1 });
    expect(d).toEqual({
      allowed: false,
      details: { conversations: 2, service_orders: 1, sales: 4, leads: 0, lgpd_requests: 0, other: 0 },
    });
  });

  it("counts orphan messages as conversation history", () => {
    const d = decideContactDeletion({ ...none, messages: 5 });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.details.conversations).toBe(1);
  });

  it("groups leads with lead links, and the rest under other", () => {
    const d = decideContactDeletion({ ...none, crm_leads: 1, crm_lead_links: 2, ai_agent_runs: 1, merged_contacts: 1, crm_lead_activities: 1 });
    expect(d).toMatchObject({ allowed: false, details: { leads: 3, other: 3 } });
  });

  it("ignores negative / NaN counts instead of underflowing", () => {
    expect(decideContactDeletion({ ...none, orders: -3, messages: Number.NaN })).toEqual({ allowed: true });
  });
});
