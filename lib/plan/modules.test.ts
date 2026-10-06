import { describe, it, expect } from "vitest";
import {
  requiresProAccess,
  proModuleForPath,
  PRO_MODULES,
  FREE_ROUTE_PREFIXES,
} from "./modules";

describe("requiresProAccess — allowlist", () => {
  it.each(["/app/dashboard", "/app/calculator", "/app/settings"])("%s e livre", (p) => {
    expect(requiresProAccess(p)).toBe(false);
  });

  it.each([
    "/app/dashboard/qualquer-coisa",
    "/app/calculator/historico",
    "/app/settings/billing",
    "/app/settings/tenant",
    "/app/settings/security",
  ])("%s e livre (sub-rota da allowlist)", (p) => {
    expect(requiresProAccess(p)).toBe(false);
  });

  it.each([
    "/app/sales",
    "/app/sales/shopee",
    "/app/products",
    "/app/inbox",
    "/app/printers",
    "/app/models/fatiar",
    "/app/control",
    "/automations",
    "/content-studio",
  ])("%s exige PRO", (p) => {
    expect(requiresProAccess(p)).toBe(true);
  });

  /**
   * A razao de ser da allowlist: a rota que alguem criar daqui a um ano nasce
   * TRAVADA. Com blocklist ela nasceria aberta e ninguem notaria.
   */
  it("rota que ainda nao existe ja nasce exigindo PRO", () => {
    expect(requiresProAccess("/app/nfe")).toBe(true);
    expect(requiresProAccess("/app/modulo-de-2027/sub")).toBe(true);
  });

  it("nao confunde prefixo com inicio de palavra", () => {
    expect(requiresProAccess("/app/settingsx")).toBe(true);
    expect(requiresProAccess("/app/dashboardzinho")).toBe(true);
  });

  it("rota fora do CRM nao e assunto deste gate", () => {
    for (const p of ["/", "/calc3d-pro", "/login", "/admin/tenants", "/portal/switcher"]) {
      expect(requiresProAccess(p)).toBe(false);
    }
  });
});

describe("proModuleForPath", () => {
  it("resolve o rotulo para a tela de upgrade", () => {
    expect(proModuleForPath("/app/sales")?.label).toBe("Vendas e funil");
    expect(proModuleForPath("/app/sales/mercado-livre")?.label).toBe("Vendas e funil");
    expect(proModuleForPath("/app/models/fatiar")?.label).toBe("Modelagem 3D e fatiador");
  });

  it("devolve null para o que nao reconhece, em vez de ecoar a entrada", () => {
    expect(proModuleForPath("/app/dashboard")).toBeNull();
    expect(proModuleForPath("/app/rota-inventada")).toBeNull();
    expect(proModuleForPath("javascript:alert(1)")).toBeNull();
    expect(proModuleForPath("https://evil.example/app/sales")).toBeNull();
  });
});

describe("coerencia do catalogo", () => {
  it("todo modulo do catalogo de fato exige PRO", () => {
    for (const m of PRO_MODULES) {
      expect(requiresProAccess(m.routePrefix)).toBe(true);
    }
  });

  it("nenhum modulo do catalogo colide com a allowlist", () => {
    for (const m of PRO_MODULES) {
      for (const free of FREE_ROUTE_PREFIXES) {
        expect(m.routePrefix.startsWith(free)).toBe(false);
      }
    }
  });

  it("nao ha prefixo duplicado no catalogo", () => {
    const prefixes = PRO_MODULES.map((m) => m.routePrefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
});
