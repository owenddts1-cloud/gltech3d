import { describe, it, expect } from "vitest";
import { resolveTargetOrg, type Membership } from "./resolve-target-org";

const USER = "user-1";
const ORG_A: Membership = { organizationId: "org-a", organizationName: "Oficina A" };
const ORG_B: Membership = { organizationId: "org-b", organizationName: "Oficina B" };

describe("resolveTargetOrg", () => {
  it("1. pedido com organization_id vai direto para upgrade", () => {
    const r = resolveTargetOrg({
      requestOrgId: "org-do-pedido",
      existingUserId: USER,
      memberships: [ORG_A, ORG_B],
    });
    expect(r).toEqual({ mode: "upgrade", organizationId: "org-do-pedido", userId: USER });
  });

  it("2. usuário inexistente: cria tenant novo", () => {
    const r = resolveTargetOrg({ requestOrgId: null, existingUserId: null, memberships: [] });
    expect(r).toEqual({ mode: "create", userId: null });
  });

  it("2a. usuário com UMA membership: upgrade dela", () => {
    const r = resolveTargetOrg({
      requestOrgId: null,
      existingUserId: USER,
      memberships: [ORG_A],
    });
    expect(r).toEqual({ mode: "upgrade", organizationId: "org-a", userId: USER });
  });

  /**
   * O caso que não pode ser adivinhado: escolher errado dá PRO para a org errada
   * e deixa o cliente sem acesso justamente onde ele trabalha.
   */
  it("2b. usuário com VÁRIAS memberships: ambíguo, não adivinha", () => {
    const r = resolveTargetOrg({
      requestOrgId: null,
      existingUserId: USER,
      memberships: [ORG_A, ORG_B],
    });
    expect(r.mode).toBe("ambiguous");
    if (r.mode === "ambiguous") {
      expect(r.candidates).toHaveLength(2);
      expect(r.userId).toBe(USER);
    }
  });

  it("2b. com a escolha do admin, resolve para upgrade", () => {
    const r = resolveTargetOrg({
      requestOrgId: null,
      existingUserId: USER,
      memberships: [ORG_A, ORG_B],
      chosenOrgId: "org-b",
    });
    expect(r).toEqual({ mode: "upgrade", organizationId: "org-b", userId: USER });
  });

  it("escolha FORA das candidatas é ignorada — o corpo não escolhe a org", () => {
    const r = resolveTargetOrg({
      requestOrgId: null,
      existingUserId: USER,
      memberships: [ORG_A, ORG_B],
      chosenOrgId: "org-de-outra-pessoa",
    });
    expect(r.mode).toBe("ambiguous");
  });

  it("2c. usuário existente sem nenhuma membership: cria, mas reusa a conta", () => {
    const r = resolveTargetOrg({ requestOrgId: null, existingUserId: USER, memberships: [] });
    expect(r).toEqual({ mode: "create", userId: USER });
  });

  it("nunca devolve upgrade sem organizationId", () => {
    const casos = [
      { requestOrgId: null, existingUserId: null, memberships: [] },
      { requestOrgId: null, existingUserId: USER, memberships: [] },
      { requestOrgId: null, existingUserId: USER, memberships: [ORG_A, ORG_B] },
    ];
    for (const c of casos) {
      const r = resolveTargetOrg(c);
      if (r.mode === "upgrade") expect(r.organizationId).toBeTruthy();
    }
  });
});
