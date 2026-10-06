import { describe, it, expect } from "vitest";
import { signupSchema, MIN_SIGNUP_ELAPSED_MS } from "./signup";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

const VALID = {
  email: "Novo@Exemplo.COM",
  password: "a".repeat(MIN_PASSWORD_LENGTH),
  display_name: "Minha Impressão 3D",
  accept_terms: true as const,
};

describe("signupSchema", () => {
  it("aceita o payload mínimo e normaliza o e-mail", () => {
    const r = signupSchema.safeParse(VALID);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("novo@exemplo.com");
  });

  it("exige o aceite dos termos", () => {
    const { accept_terms: _omitido, ...sem } = VALID;
    expect(signupSchema.safeParse(sem).success).toBe(false);
    expect(signupSchema.safeParse({ ...VALID, accept_terms: false }).success).toBe(false);
  });

  it("recusa senha curta, usando o mesmo mínimo do servidor", () => {
    const curta = { ...VALID, password: "a".repeat(MIN_PASSWORD_LENGTH - 1) };
    expect(signupSchema.safeParse(curta).success).toBe(false);
  });

  it("recusa e-mail inválido", () => {
    expect(signupSchema.safeParse({ ...VALID, email: "nao-e-email" }).success).toBe(false);
  });

  it("recusa nome de operação com menos de 2 caracteres", () => {
    expect(signupSchema.safeParse({ ...VALID, display_name: "x" }).success).toBe(false);
  });

  it("aceita o honeypot vazio e recusa o preenchido", () => {
    expect(signupSchema.safeParse({ ...VALID, website: "" }).success).toBe(true);
    expect(signupSchema.safeParse({ ...VALID, website: "http://spam" }).success).toBe(false);
  });

  it("rejeita chave desconhecida — .strict() impede algo entrar pelo body", () => {
    // Sem isto, `plan` ou `organization_id` chegariam ao INSERT com service role.
    expect(signupSchema.safeParse({ ...VALID, plan: "pro" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...VALID, organization_id: "qualquer" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...VALID, trial_ends_at: "2030-01-01" }).success).toBe(false);
  });

  it("aceita elapsed_ms e deixa a decisão de 'rápido demais' para a rota", () => {
    // O schema não reprova: a rota responde 201 falso, para não ensinar o bot.
    const r = signupSchema.safeParse({ ...VALID, elapsed_ms: 10 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.elapsed_ms).toBeLessThan(MIN_SIGNUP_ELAPSED_MS);
  });

  it("recusa elapsed_ms negativo", () => {
    expect(signupSchema.safeParse({ ...VALID, elapsed_ms: -1 }).success).toBe(false);
  });
});
