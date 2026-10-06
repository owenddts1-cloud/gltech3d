/**
 * O teste que impede um item novo do menu de nascer sem guia.
 *
 * Cada entrada da navegação do CRM precisa de um guia PRÓPRIO — não basta cair
 * no guia de um pai por prefixo (ex.: `/app/models/fatiar` herdando o guia de
 * `/app/models` explicaria a tela errada). Quem adicionar um item em
 * `nav-crm.ts` sem escrever o guia em `lib/guides/registry.ts` quebra aqui.
 */
import { describe, it, expect } from "vitest";
import { CRM_NAV, isGroup, type NavLeaf } from "@/components/shell/nav-crm";
import { GUIDES, guideForPath } from "@/lib/guides/registry";

function leaves(): NavLeaf[] {
  return CRM_NAV.flatMap((e) => (isGroup(e) ? e.children : [e]));
}

describe("cobertura dos guias por tela", () => {
  it("a navegação tem itens (o teste não está passando no vazio)", () => {
    expect(leaves().length).toBeGreaterThan(10);
  });

  it("todo item do menu resolve para um guia próprio, não para o de um pai", () => {
    const withoutOwnGuide = leaves()
      .filter((leaf) => {
        const guide = guideForPath(leaf.href);
        return !guide || !guide.paths.includes(leaf.href);
      })
      .map((leaf) => leaf.href);
    expect(withoutOwnGuide).toEqual([]);
  });

  it("dois itens do menu nunca dividem o mesmo guia", () => {
    const ids = leaves().map((leaf) => guideForPath(leaf.href)?.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("as subpáginas de Configurações têm guia próprio", () => {
    for (const href of ["/app/settings/security", "/app/settings/billing", "/app/settings/profile", "/app/settings/tenant"]) {
      expect(guideForPath(href)?.paths, href).toContain(href);
    }
  });

  it("todo guia com rota é alcançável pelo próprio prefixo principal", () => {
    for (const g of GUIDES.filter((x) => x.paths.length > 0)) {
      expect(guideForPath(g.paths[0])?.id, g.id).toBe(g.id);
    }
  });
});
