import { describe, it, expect, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: vi.fn().mockResolvedValue({ id: "user-123" }),
  resolveActiveOrg: vi.fn().mockResolvedValue({ orgId: "org-123", role: "admin" }),
}));

vi.mock("@/lib/plan/server", () => ({
  assertProAccess: vi.fn().mockResolvedValue(null),
}));

describe("AI Orchestrator Webhook API Route", () => {
  it("processes quote.requested event and executes PricingEngineAgent", async () => {
    const req = new Request("http://localhost/api/v1/webhooks/ai-orchestrator", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "quote.requested",
        tenant_id: "org-123",
        payload: {
          net_mass_g: 100,
          support_mass_g: 20,
          number_of_switches: 0,
          purge_mass_per_switch_g: 0,
          waste_factor: 0.03,
          spool_cost_per_kg: 90.0,
          print_time_hours: 4.0,
          average_power_watts: 150,
          kwh_rate_brl: 0.85,
          prep_time_min: 10,
          support_removal_time_min: 15,
          brass_inserts_count: 2,
          time_per_insert_min: 2,
          post_processing_time_min: 0,
          qc_time_min: 10,
          hourly_labor_rate_brl: 40.0,
          polymer: "PLA",
        },
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.agent).toBe("PricingEngineAgent");
    expect(json.pricing.final_price_brl).toBeGreaterThan(0);
  });

  it("returns 400 for unknown event", async () => {
    const req = new Request("http://localhost/api/v1/webhooks/ai-orchestrator", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "invalid.event",
        tenant_id: "org-123",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
