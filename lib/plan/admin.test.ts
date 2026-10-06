import { describe, it, expect } from "vitest";

import { extendPlan, revokePlan, setPlan, type PlanColumnsRow } from "./admin";
import { resolvePlanState } from "./resolve";

const NOW = new Date("2026-10-06T12:00:00.000Z");
const DAY = 86_400_000;

function iso(offsetDays: number): string {
  return new Date(NOW.getTime() + offsetDays * DAY).toISOString();
}

function stateAfter(row: PlanColumnsRow) {
  return resolvePlanState({
    plan: row.plan,
    trialEndsAt: row.trial_ends_at,
    planExpiresAt: row.plan_expires_at,
    now: NOW,
  });
}

describe("setPlan", () => {
  it("pro com data futura grava a data normalizada em ISO", () => {
    const res = setPlan({ plan: "pro", expiresAt: "2027-01-01T03:00:00.000Z" }, NOW);
    expect(res).toEqual({
      ok: true,
      patch: { plan: "pro", plan_expires_at: "2027-01-01T03:00:00.000Z" },
    });
  });

  it("pro sem vencimento grava NULL (nunca expira)", () => {
    const res = setPlan({ plan: "enterprise", expiresAt: null }, NOW);
    expect(res).toEqual({ ok: true, patch: { plan: "enterprise", plan_expires_at: null } });
  });

  it("standard sempre limpa o vencimento e NÃO mexe no trial", () => {
    const res = setPlan({ plan: "standard", expiresAt: iso(30) }, NOW);
    expect(res).toEqual({ ok: true, patch: { plan: "standard", plan_expires_at: null } });
    if (res.ok) expect("trial_ends_at" in res.patch).toBe(false);
  });

  it("recusa data no passado — liberar um plano já vencido tranca o cliente", () => {
    const res = setPlan({ plan: "pro", expiresAt: iso(-1) }, NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("expiry_in_past");
  });

  it("recusa data inválida", () => {
    const res = setPlan({ plan: "pro", expiresAt: "não é data" }, NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("invalid_expiry");
  });
});

describe("extendPlan", () => {
  it("pro ativo: soma ao que resta, não reseta", () => {
    const res = extendPlan({ plan: "pro", trial_ends_at: null, plan_expires_at: iso(10) }, 30, NOW);
    expect(res).toEqual({ ok: true, patch: { plan: "pro", plan_expires_at: iso(40) } });
  });

  it("pro vencido: conta a partir de agora", () => {
    const res = extendPlan({ plan: "pro", trial_ends_at: null, plan_expires_at: iso(-5) }, 30, NOW);
    expect(res).toEqual({ ok: true, patch: { plan: "pro", plan_expires_at: iso(30) } });
  });

  it("enterprise continua enterprise", () => {
    const res = extendPlan(
      { plan: "enterprise", trial_ends_at: null, plan_expires_at: iso(1) },
      365,
      NOW,
    );
    expect(res.ok && res.patch.plan).toBe("enterprise");
  });

  it("standard (trial ou grátis) vira pro a partir de agora, ignorando data velha", () => {
    const res = extendPlan(
      { plan: "standard", trial_ends_at: iso(3), plan_expires_at: iso(90) },
      30,
      NOW,
    );
    expect(res).toEqual({ ok: true, patch: { plan: "pro", plan_expires_at: iso(30) } });
  });

  it("recusa estender plano sem vencimento — viraria uma data finita e REDUZIRIA o acesso", () => {
    const res = extendPlan({ plan: "pro", trial_ends_at: null, plan_expires_at: null }, 30, NOW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("no_expiry_to_extend");
  });
});

describe("revokePlan", () => {
  it("tira o pro e limpa o vencimento", () => {
    const current = { plan: "pro", trial_ends_at: null, plan_expires_at: iso(100) };
    const patch = revokePlan(current, NOW);
    expect(patch).toEqual({ plan: "standard", plan_expires_at: null, trial_ends_at: null });
    expect(stateAfter({ ...current, ...patch }).hasProAccess).toBe(false);
  });

  it("encerra um trial ATIVO — senão 'remover plano' deixaria acesso pelo trial", () => {
    const current = { plan: "standard", trial_ends_at: iso(5), plan_expires_at: null };
    // Sanidade: antes do revoke o trial dá acesso.
    expect(stateAfter(current).hasProAccess).toBe(true);

    const patch = revokePlan(current, NOW);
    expect(patch.trial_ends_at).toBe(NOW.toISOString());

    const after = stateAfter({ ...current, ...patch });
    expect(after.hasProAccess).toBe(false);
    expect(after.status).toBe("trial_expired");
  });

  it("trial já vencido fica como está (preserva o histórico)", () => {
    const current = { plan: "standard", trial_ends_at: iso(-10), plan_expires_at: null };
    expect(revokePlan(current, NOW).trial_ends_at).toBe(iso(-10));
  });

  it("sem trial continua sem trial", () => {
    const current = { plan: "pro", trial_ends_at: null, plan_expires_at: null };
    const patch = revokePlan(current, NOW);
    expect(patch.trial_ends_at).toBeNull();
    expect(stateAfter({ ...current, ...patch }).status).toBe("none");
  });
});
