import { describe, it, expect } from "vitest";
import {
  generateTechnicalProposal,
  dispatchCustomerUpdate,
  type CustomerUpdateParams,
} from "./cx";

describe("CXPumpAgent Tool Calling Module", () => {
  it("generates technical proposal with item details and payment link", () => {
    const proposal = generateTechnicalProposal({
      order_id: "ord-88319a2b",
      customer_name: "Engenharia Robótica S.A.",
      delivery_days: 3,
      items: [
        { title: "Engrenagem Helicoidal", polymer: "PA-CF", mass_g: 120, price_brl: 145.0 },
        { title: "Suporte do Motor", polymer: "PETG", mass_g: 80, price_brl: 65.0 },
      ],
      total_price_brl: 210.0,
    });

    expect(proposal.proposal_text).toContain("Engenharia Robótica S.A.");
    expect(proposal.proposal_text).toContain("Engrenagem Helicoidal");
    expect(proposal.proposal_text).toContain("PA-CF");
    expect(proposal.proposal_text).toContain("R$ 210.00");
    expect(proposal.checkout_url).toContain("ord-88319a2b");
  });

  describe("Milestone updates: WhatsApp & E-mail", () => {
    it("dispatches milestone 1: production / print started", () => {
      const update = dispatchCustomerUpdate({
        order_id: "ord-100",
        event_type: "production_started",
        customer_name: "Carlos",
      });

      expect(update.ok).toBe(true);
      expect(update.dispatched_message).toContain("entrou em produção");
      expect(update.dispatched_message).toContain("ord-100");
    });

    it("dispatches milestone 2: 50% progress / interim QC checkpoint", () => {
      const update = dispatchCustomerUpdate({
        order_id: "ord-100",
        event_type: "progress_halfway",
        customer_name: "Carlos",
        progress_pct: 50,
      });

      expect(update.ok).toBe(true);
      expect(update.dispatched_message).toContain("50%");
      expect(update.dispatched_message.toLowerCase()).toContain("controle de qualidade intermediário");
    });

    it("dispatches milestone 3: print finished / finishing & post-processing", () => {
      const update = dispatchCustomerUpdate({
        order_id: "ord-100",
        event_type: "print_finished",
        customer_name: "Carlos",
      });

      expect(update.ok).toBe(true);
      expect(update.dispatched_message).toContain("finalizada na mesa");
      expect(update.dispatched_message).toContain("acabamento e pós-cura");
    });

    it("dispatches milestone 4a: shipped with tracking code", () => {
      const update = dispatchCustomerUpdate({
        order_id: "ord-100",
        event_type: "shipped_tracking",
        customer_name: "Carlos",
        tracking_code: "BR987654321GL",
      });

      expect(update.ok).toBe(true);
      expect(update.dispatched_message).toContain("despachado");
      expect(update.dispatched_message).toContain("BR987654321GL");
    });

    it("dispatches milestone 4b: ready for local pickup", () => {
      const update = dispatchCustomerUpdate({
        order_id: "ord-100",
        event_type: "ready_for_pickup",
        customer_name: "Carlos",
        pickup_instructions: "Oficina GLTech3D - Rua Industrial 500",
      });

      expect(update.ok).toBe(true);
      expect(update.dispatched_message).toContain("disponível para retirada");
      expect(update.dispatched_message).toContain("Oficina GLTech3D");
    });
  });
});
