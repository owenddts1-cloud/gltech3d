import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Cada seção da landing lê o texto de `settings.sections[<chave>]` e cai no
 * padrão quando o campo está vazio. As duas pontas precisam usar a MESMA chave:
 * se o editor grava em `orcamento` e o componente lê `orcamentos`, o campo
 * aparece na tela, salva no banco — e não muda nada no site. Falha silenciosa,
 * a pior categoria.
 *
 * Este teste lê os arquivos porque o alvo é justamente o acoplamento entre
 * eles: renderizar o componente não pegaria a chave errada no editor.
 */

const read = (p: string): string => readFileSync(p, "utf8");

/** chave da seção → componente que a consome */
const WIRING: { key: string; component: string }[] = [
  { key: "hero", component: "components/marketing/HeroScrollVideo.tsx" },
  { key: "categorias", component: "components/marketing/Categories.tsx" },
  { key: "bestsellers", component: "components/marketing/ProductGrid.tsx" },
  { key: "galeria", component: "components/marketing/ProductGrid.tsx" },
  { key: "como_funciona", component: "components/marketing/HowItWorks.tsx" },
  { key: "prova_social", component: "components/marketing/SocialProof.tsx" },
  { key: "orcamento", component: "components/marketing/LeadForm.tsx" },
  { key: "newsletter", component: "components/marketing/NewsletterBar.tsx" },
  { key: "footer", component: "components/marketing/Footer.tsx" },
];

const editor = read("app/app/landing-edit/_components/LandingEditClient.tsx");
const homeClient = read("app/(marketing)/_components/HomeClient.tsx");

describe("contrato de textos entre Landing Edit e a landing", () => {
  it.each(WIRING)("a seção '$key' é lida por quem o editor declara", ({ key, component }) => {
    // O editor oferece a seção…
    expect(editor).toContain(`key: '${key}'`);
    // …e o componente lê exatamente essa chave.
    expect(read(component)).toContain(`sections?.${key}`);
  });

  it("todo componente de seção recebe `settings` do HomeClient", () => {
    for (const c of ["HowItWorks", "SocialProof", "LeadForm", "NewsletterBar", "HeroScrollVideo", "Footer"]) {
      expect(homeClient).toContain(`<${c} settings={catalog.settings}`);
    }
  });

  it("nenhuma seção declarada no editor fica órfã", () => {
    const declared = [...editor.matchAll(/key: '([a-z_]+)',\n\s*label:/g)].map((m) => m[1]);
    const wired = new Set(WIRING.map((w) => w.key));
    for (const key of declared) {
      expect(wired.has(key!), `seção "${key}" aparece no editor mas nenhum componente a lê`).toBe(true);
    }
  });
});

/**
 * As listas padrão vivem em dois lugares: no componente (o que o site mostra) e
 * no editor (o que o painel exibe como "padrão", para você editar em cima). Se
 * divergirem, o painel mostra um texto e o visitante lê outro — e ninguém nota,
 * porque as duas telas parecem certas isoladamente.
 */
describe("listas padrão espelhadas entre componente e editor", () => {
  const howItWorks = read("components/marketing/HowItWorks.tsx");
  const socialProof = read("components/marketing/SocialProof.tsx");

  /**
   * Textos dos campos dentro do bloco `const <name> ... ];`.
   *
   * Ancorado no nome do campo de propósito: um `/'([^']+)'/g` solto casa também
   * o miolo ENTRE dois literais (`',\n    title: '`) e o teste passa a comparar
   * lixo.
   */
  function literals(src: string, constName: string): string[] {
    const start = src.indexOf(`const ${constName}`);
    if (start === -1) return [];
    const end = src.indexOf("];", start);
    const block = src.slice(start, end);
    return [...block.matchAll(/(?:title|text|author|detail): '([^']+)'/g)].map((m) => m[1]!);
  }

  it("os passos do Como Funciona batem nos dois lados", () => {
    const fromComponent = literals(howItWorks, "DEFAULT_STEPS");
    expect(fromComponent.length).toBeGreaterThan(0);
    for (const text of fromComponent) {
      expect(editor, `passo ausente no editor: "${text.slice(0, 40)}…"`).toContain(text);
    }
  });

  it("os depoimentos de exemplo batem nos dois lados", () => {
    const fromComponent = literals(socialProof, "DEFAULT_TESTIMONIALS");
    expect(fromComponent.length).toBeGreaterThan(0);
    for (const text of fromComponent) {
      expect(editor, `depoimento ausente no editor: "${text.slice(0, 40)}…"`).toContain(text);
    }
  });

  it("todo ícone usado nos passos padrão existe na allowlist", () => {
    const icons = read("lib/landing/section-icons.ts");
    for (const m of howItWorks.matchAll(/icon: '(\w+)'/g)) {
      expect(icons, `ícone "${m[1]}" fora da allowlist`).toContain(`  ${m[1]},`);
    }
  });
});
