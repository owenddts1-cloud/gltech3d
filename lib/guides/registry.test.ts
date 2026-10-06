import { describe, it, expect } from "vitest";
import {
  GUIDES,
  WELCOME_GUIDE_ID,
  autoGuideFor,
  guideById,
  guideForPath,
  guideHref,
  normalizePath,
} from "./registry";
import { GUIDE_GROUP_ORDER } from "./types";

describe("guideForPath", () => {
  it("resolve a rota exata do módulo", () => {
    expect(guideForPath("/app/dashboard")?.id).toBe("dashboard");
    expect(guideForPath("/app/products")?.id).toBe("products");
  });

  it("o prefixo mais específico vence", () => {
    expect(guideForPath("/app/models/fatiar")?.id).toBe("slicer");
    expect(guideForPath("/app/models")?.id).toBe("models");
    expect(guideForPath("/app/sales/shopee")?.id).toBe("sales-shopee");
    expect(guideForPath("/app/sales")?.id).toBe("sales");
    expect(guideForPath("/app/settings/security")?.id).toBe("settings-security");
    expect(guideForPath("/app/settings/tenant")?.id).toBe("tenant");
    expect(guideForPath("/app/settings")?.id).toBe("settings");
  });

  it("rota de detalhe cai no guia do módulo", () => {
    expect(guideForPath("/app/contacts/3f1c2b9e-1111-4a2b-9c3d-123456789abc")?.id).toBe("contacts");
    expect(guideForPath("/app/inbox/abc")?.id).toBe("inbox");
    expect(guideForPath("/app/service-orders/123/documentos")?.id).toBe("service-orders");
    expect(guideForPath("/app/ai/credentials")?.id).toBe("ai-agents");
    expect(guideForPath("/app/settings/api-tokens")?.id).toBe("settings");
    expect(guideForPath("/app/products/catalog")?.id).toBe("products");
  });

  it("não confunde prefixos parciais de segmento", () => {
    // `/app/salesforce` não é `/app/sales`.
    expect(guideForPath("/app/salesforce")).toBeNull();
    expect(guideForPath("/app/models-extra")).toBeNull();
  });

  it("ignora query string, hash e barra final", () => {
    expect(guideForPath("/app/sales/shopee/?view=kanban")?.id).toBe("sales-shopee");
    expect(guideForPath("/app/settings/billing?locked=reports")?.id).toBe("settings-billing");
    expect(guideForPath("/app/calendar#hoje")?.id).toBe("calendar");
  });

  it("devolve null fora do CRM ou sem rota", () => {
    expect(guideForPath("/")).toBeNull();
    expect(guideForPath("/login")).toBeNull();
    expect(guideForPath(null)).toBeNull();
    expect(guideForPath(undefined)).toBeNull();
  });

  it("cobre os apps sem sidebar", () => {
    expect(guideForPath("/automations")?.id).toBe("automations");
    expect(guideForPath("/app/automations")?.id).toBe("automations");
    expect(guideForPath("/content-studio/timeline")?.id).toBe("content-studio");
  });
});

describe("normalizePath", () => {
  it("remove barra final mas preserva a raiz", () => {
    expect(normalizePath("/app/sales/")).toBe("/app/sales");
    expect(normalizePath("/")).toBe("/");
  });
});

describe("autoGuideFor", () => {
  const none = new Set<string>();

  it("primeira visita mostra o guia de boas-vindas", () => {
    expect(autoGuideFor("/app/dashboard", none)?.id).toBe(WELCOME_GUIDE_ID);
  });

  it("depois das boas-vindas, mostra o guia da tela ainda não visto", () => {
    expect(autoGuideFor("/app/products", new Set([WELCOME_GUIDE_ID]))?.id).toBe("products");
  });

  it("não reabre guia já visto", () => {
    expect(autoGuideFor("/app/products", new Set([WELCOME_GUIDE_ID, "products"]))).toBeNull();
  });

  it("telas com autoOpen=false não abrem nada, nem as boas-vindas", () => {
    expect(autoGuideFor("/app/settings/billing?locked=reports", none)).toBeNull();
    expect(autoGuideFor("/app/settings/billing", new Set([WELCOME_GUIDE_ID]))).toBeNull();
    expect(autoGuideFor("/app/sales/new-product", none)).toBeNull();
  });

  it("rota sem guia não abre nada depois das boas-vindas", () => {
    expect(autoGuideFor("/app/desconhecida", new Set([WELCOME_GUIDE_ID]))).toBeNull();
  });
});

describe("conteúdo do registro", () => {
  it("ids são únicos", () => {
    const ids = GUIDES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("nenhum prefixo de rota pertence a dois guias", () => {
    const all = GUIDES.flatMap((g) => g.paths);
    expect(new Set(all).size).toBe(all.length);
  });

  it("prefixos são absolutos e sem barra final", () => {
    for (const g of GUIDES) {
      for (const p of g.paths) {
        expect(p.startsWith("/"), `${g.id}: ${p}`).toBe(true);
        expect(p.endsWith("/"), `${g.id}: ${p}`).toBe(false);
      }
    }
  });

  it("todo guia tem ideia, propósito e passos preenchidos", () => {
    for (const g of GUIDES) {
      expect(g.title.trim(), g.id).not.toBe("");
      expect(g.idea.trim(), g.id).not.toBe("");
      expect(g.purpose.length, g.id).toBeGreaterThan(0);
      expect(g.steps.length, g.id).toBeGreaterThan(0);
      for (const s of g.steps) {
        expect(s.title.trim(), g.id).not.toBe("");
        expect(s.detail.trim(), g.id).not.toBe("");
      }
      // Os títulos dos passos são chave de lista no painel.
      expect(new Set(g.steps.map((s) => s.title)).size, g.id).toBe(g.steps.length);
    }
  });

  it("todo guia pertence a um grupo conhecido e tem link válido", () => {
    for (const g of GUIDES) {
      expect(GUIDE_GROUP_ORDER).toContain(g.group);
      expect(guideHref(g).startsWith("/")).toBe(true);
    }
  });

  it("apenas o guia de boas-vindas não tem rota", () => {
    const semRota = GUIDES.filter((g) => g.paths.length === 0).map((g) => g.id);
    expect(semRota).toEqual([WELCOME_GUIDE_ID]);
  });

  it("módulos de demonstração avisam que são demonstração", () => {
    expect(guideById("automations")?.notice?.kind).toBe("demo");
    expect(guideById("content-studio")?.notice?.kind).toBe("demo");
  });

  it("canais de venda avisam que não há sincronização automática", () => {
    for (const id of ["sales-shopee", "sales-mercado-livre", "sales-facebook"]) {
      expect(guideById(id)?.notice?.kind, id).toBe("integration");
    }
  });

  it("guideById devolve null para id desconhecido", () => {
    expect(guideById("nao-existe")).toBeNull();
  });
});
