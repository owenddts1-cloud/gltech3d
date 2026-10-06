import { describe, it, expect } from "vitest";

import { buyerMembershipOutcome, buyerMembershipWarning } from "./buyer-membership";

describe("buyerMembershipOutcome", () => {
  it("classifica sem escrever nada", () => {
    expect(buyerMembershipOutcome(null, null)).toBe("no_account");
    expect(buyerMembershipOutcome("u", null)).toBe("missing_not_created");
    expect(buyerMembershipOutcome("u", { revoked_at: null })).toBe("active_kept");
    expect(buyerMembershipOutcome("u", { revoked_at: "2026-01-01T00:00:00Z" })).toBe("revoked_not_reactivated");
  });
  it("só avisa quando o comprador ficou sem acesso", () => {
    expect(buyerMembershipWarning("active_kept")).toBeNull();
    expect(buyerMembershipWarning("no_account")).toBeNull();
    expect(buyerMembershipWarning("revoked_not_reactivated")).toMatch(/REVOGADO/);
    expect(buyerMembershipWarning("missing_not_created")).toMatch(/não é membro/);
  });
});
