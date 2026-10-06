import { describe, it, expect } from "vitest";

import { isPublicPath } from "./public-paths";

describe("isPublicPath — aprovação PRO pelo e-mail", () => {
  it("a página /aprovar/<token> é pública (o token é a credencial)", () => {
    expect(isPublicPath("/aprovar/eyJhYmMiOjF9.c2ln")).toBe(true);
  });

  it("/aprovar sem token não é", () => {
    expect(isPublicPath("/aprovar")).toBe(false);
    expect(isPublicPath("/aprovar/")).toBe(false);
  });

  it("a rota que decide fica sob /api/v1/public/", () => {
    expect(isPublicPath("/api/v1/public/pro-signup/email-action")).toBe(true);
  });

  it("o painel de Assinantes continua protegido", () => {
    expect(isPublicPath("/admin/assinantes")).toBe(false);
    expect(isPublicPath("/api/v1/admin/subscribers")).toBe(false);
  });
});
