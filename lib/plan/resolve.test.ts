import { describe, it, expect } from "vitest";
import { resolvePlanState, planBadgeLabel } from "./resolve";

const NOW = new Date("2026-10-05T12:00:00.000Z");
const FUTURO = new Date("2026-10-12T12:00:00.000Z").toISOString();
const PASSADO = new Date("2026-09-28T12:00:00.000Z").toISOString();

describe("resolvePlanState — tabela de verdade", () => {
  it.each([
    // plan, plan_expires_at, trial_ends_at, status esperado, acesso esperado
    ["pro", null, null, "active", true],
    ["pro", FUTURO, null, "active", true],
    ["pro", PASSADO, null, "expired", false],
    ["enterprise", null, null, "active", true],
    ["enterprise", PASSADO, null, "expired", false],
    ["standard", null, FUTURO, "trialing", true],
    ["standard", null, PASSADO, "trial_expired", false],
    ["standard", null, null, "none", false],
  ])(
    "plan=%s expira=%s trial=%s resolve para %s (acesso=%s)",
    (plan, planExpiresAt, trialEndsAt, status, hasProAccess) => {
      const s = resolvePlanState({ plan, planExpiresAt, trialEndsAt, now: NOW });
      expect(s.status).toBe(status);
      expect(s.hasProAccess).toBe(hasProAccess);
    },
  );

  /**
   * O caso que, lido de outro jeito, trancaria no deploy da migration 0082 TODA
   * org que ja era PRO — inclusive a da propria GLTech3D, que nao tem data de
   * pagamento registrada.
   */
  it("org pro grandfathered sem data nao e trancada", () => {
    const s = resolvePlanState({ plan: "pro", planExpiresAt: null, trialEndsAt: null, now: NOW });
    expect(s.hasProAccess).toBe(true);
    expect(s.status).toBe("active");
  });

  it("plano desconhecido fecha, nao abre", () => {
    for (const plan of ["premium", "", "PRO", null, "gold"]) {
      const s = resolvePlanState({ plan, planExpiresAt: null, trialEndsAt: null, now: NOW });
      expect(s.tier).toBe("standard");
      expect(s.hasProAccess).toBe(false);
    }
  });

  it("data invalida nao vira acesso nem NaN", () => {
    const s = resolvePlanState({
      plan: "standard",
      planExpiresAt: null,
      trialEndsAt: "nao-e-data",
      now: NOW,
    });
    expect(s.hasProAccess).toBe(false);
    expect(s.status).toBe("none");
    expect(s.trialEndsAt).toBeNull();
  });

  it("aceita Date alem de string", () => {
    const s = resolvePlanState({
      plan: "standard",
      planExpiresAt: null,
      trialEndsAt: new Date(FUTURO),
      now: NOW,
    });
    expect(s.status).toBe("trialing");
  });
});

describe("trialDaysLeft", () => {
  it("arredonda para cima: 6,1 dias restantes mostram 7", () => {
    const end = new Date(NOW.getTime() + 6.1 * 86_400_000).toISOString();
    const s = resolvePlanState({ plan: "standard", planExpiresAt: null, trialEndsAt: end, now: NOW });
    expect(s.trialDaysLeft).toBe(7);
  });

  it("no ultimo dia ainda mostra 1 — seria 0 com floor, enquanto o acesso funciona", () => {
    const end = new Date(NOW.getTime() + 3 * 3_600_000).toISOString();
    const s = resolvePlanState({ plan: "standard", planExpiresAt: null, trialEndsAt: end, now: NOW });
    expect(s.trialDaysLeft).toBe(1);
    expect(s.hasProAccess).toBe(true);
  });

  it("nunca fica negativo depois de vencer", () => {
    const end = new Date(NOW.getTime() - 3 * 86_400_000).toISOString();
    const s = resolvePlanState({ plan: "standard", planExpiresAt: null, trialEndsAt: end, now: NOW });
    expect(s.trialDaysLeft).toBe(0);
    expect(s.status).toBe("trial_expired");
  });

  it("e null para quem nunca trialou e para quem e pago", () => {
    const nunca = resolvePlanState({ plan: "standard", planExpiresAt: null, trialEndsAt: null, now: NOW });
    expect(nunca.trialDaysLeft).toBeNull();

    const pago = resolvePlanState({ plan: "pro", planExpiresAt: null, trialEndsAt: FUTURO, now: NOW });
    expect(pago.trialDaysLeft).toBeNull();
  });

  it("o instante exato do vencimento ja conta como expirado", () => {
    const s = resolvePlanState({
      plan: "standard",
      planExpiresAt: null,
      trialEndsAt: NOW.toISOString(),
      now: NOW,
    });
    expect(s.status).toBe("trial_expired");
    expect(s.hasProAccess).toBe(false);
  });
});

describe("planBadgeLabel", () => {
  it("nao inventa selo quando nao ha plano resolvido", () => {
    expect(planBadgeLabel(null)).toBeNull();
  });

  it("pago le PRO", () => {
    const s = resolvePlanState({ plan: "pro", planExpiresAt: null, trialEndsAt: null, now: NOW });
    expect(planBadgeLabel(s)).toBe("PRO");
  });

  it("trial conta os dias e concorda o plural", () => {
    const cinco = new Date(NOW.getTime() + 5 * 86_400_000).toISOString();
    const umDia = new Date(NOW.getTime() + 2 * 3_600_000).toISOString();

    expect(
      planBadgeLabel(resolvePlanState({ plan: "standard", planExpiresAt: null, trialEndsAt: cinco, now: NOW })),
    ).toBe("TRIAL · 5 dias");

    expect(
      planBadgeLabel(resolvePlanState({ plan: "standard", planExpiresAt: null, trialEndsAt: umDia, now: NOW })),
    ).toBe("TRIAL · 1 dia");
  });

  it("sem acesso le GRATIS nos tres estados", () => {
    const casos = [
      { plan: "standard", trialEndsAt: PASSADO, planExpiresAt: null },
      { plan: "standard", trialEndsAt: null, planExpiresAt: null },
      { plan: "pro", trialEndsAt: null, planExpiresAt: PASSADO },
    ];
    for (const row of casos) {
      expect(planBadgeLabel(resolvePlanState({ ...row, now: NOW }))).toBe("GRÁTIS");
    }
  });
});
