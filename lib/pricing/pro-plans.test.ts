import { describe, it, expect } from "vitest";
import { PRO_PLANS, getProPlan, formatBRL, monthlyEquivalentCents } from "./pro-plans";
import { proSignupRequestSchema } from "@/lib/schemas/pro-signup";

describe("PRO_PLANS", () => {
  it("expõe o plano anual com valor positivo em centavos e moeda BRL", () => {
    const plan = getProPlan("pro");
    expect(plan.amountCents).toBeGreaterThan(0);
    expect(Number.isInteger(plan.amountCents)).toBe(true);
    expect(plan.currency).toBe("BRL");
    expect(plan.periodDays).toBe(365);
  });

  it("todo id do catálogo bate com a chave do registro", () => {
    for (const [key, plan] of Object.entries(PRO_PLANS)) {
      expect(plan.id).toBe(key);
    }
  });
});

/**
 * Esta é a guarda contra a regressão que importa: se alguém adicionar
 * `amount_cents` ao schema de entrada, o preço passaria a vir do cliente.
 */
describe("o preço nunca vem do cliente", () => {
  it("o schema de intake não tem campo de valor", () => {
    const parsed = proSignupRequestSchema.safeParse({
      buyer_name: "Teste",
      buyer_email: "a@b.com",
      buyer_phone: "31999999999",
      declared_paid: true,
      consent: true,
      amount_cents: 1,
    });
    expect(parsed.success).toBe(false);
  });

  it("o valor cobrado sai do catálogo, não de entrada externa", () => {
    expect(getProPlan("pro").amountCents).toBe(PRO_PLANS.pro.amountCents);
  });
});

describe("formatBRL", () => {
  it("formata centavos em real", () => {
    // NBSP: o Intl do Node usa espaço não separável depois do símbolo.
    expect(formatBRL(19900).replace(/ /g, " ")).toBe("R$ 199,00");
    expect(formatBRL(0).replace(/ /g, " ")).toBe("R$ 0,00");
  });
});

describe("monthlyEquivalentCents", () => {
  it("divide o anual pelos meses do período", () => {
    const plan = getProPlan("pro");
    const monthly = monthlyEquivalentCents(plan);
    expect(monthly).toBeGreaterThan(0);
    expect(monthly).toBeLessThan(plan.amountCents);
    // 12 meses de volta têm de reconstruir o anual com folga de arredondamento.
    expect(Math.abs(monthly * 12 - plan.amountCents)).toBeLessThan(plan.amountCents * 0.02);
  });
});
