/**
 * O teste que impede o gate de apodrecer.
 *
 * O gate de plano é um `layout.tsx` dentro do route group `app/app/(pro)/`.
 * Ele protege o que está DENTRO dele — e nada mais. Sem esta verificação, o
 * primeiro módulo criado fora do group nasceria aberto, em silêncio, e ninguém
 * notaria até alguém com trial expirado usá-lo de graça.
 *
 * A regra: todo diretório de rota sob `app/app` ou está dentro de `(pro)`, ou
 * está explicitamente na allowlist de `lib/plan/modules.ts`.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { FREE_ROUTE_PREFIXES, requiresProAccess } from "@/lib/plan/modules";

const ROOT = path.resolve(__dirname, "../..");
const APP_DIR = path.join(ROOT, "app", "app");
const PRO_DIR = path.join(APP_DIR, "(pro)");

/** Diretórios que não são rota: privados do Next (`_`) e route groups (`(...)`). */
function isRouteDir(name: string): boolean {
  return !name.startsWith("_") && !name.startsWith("(") && !name.startsWith(".");
}

function routeDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && isRouteDir(e.name))
    .map((e) => e.name);
}

const freeNames = FREE_ROUTE_PREFIXES.map((p) => p.replace("/app/", ""));

describe("cobertura do gate PRO", () => {
  it("o route group (pro) existe e tem o layout do gate", () => {
    expect(existsSync(PRO_DIR)).toBe(true);
    expect(existsSync(path.join(PRO_DIR, "layout.tsx"))).toBe(true);
  });

  it("todo diretório fora de (pro) está na allowlist de rotas livres", () => {
    const fora = routeDirs(APP_DIR);
    const naoListados = fora.filter((d) => !freeNames.includes(d));
    expect(naoListados).toEqual([]);
  });

  it("todo diretório dentro de (pro) é tratado como PRO pela função de decisão", () => {
    for (const d of routeDirs(PRO_DIR)) {
      expect(requiresProAccess(`/app/${d}`)).toBe(true);
    }
  });

  it("nenhum diretório livre foi movido para dentro de (pro) por engano", () => {
    const dentro = routeDirs(PRO_DIR);
    for (const livre of freeNames) {
      expect(dentro).not.toContain(livre);
    }
  });

  it("o group (pro) de fato contém módulos — não ficou vazio após um refactor", () => {
    expect(routeDirs(PRO_DIR).length).toBeGreaterThan(10);
  });

  it("a tela de upgrade está FORA do gate, senão o redirect entra em laço", () => {
    // /app/settings/billing é o destino do redirect de requirePro().
    expect(requiresProAccess("/app/settings/billing")).toBe(false);
    expect(existsSync(path.join(APP_DIR, "settings", "billing"))).toBe(true);
  });
});
