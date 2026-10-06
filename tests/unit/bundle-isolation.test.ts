/**
 * A regra de `docs/specs/modelagem-3d.md` virando teste:
 *
 *   "Nenhuma dependência 3D pode entrar no bundle de quem só abre o Dashboard."
 *
 * Até aqui isso era uma promessa num documento. O repo não mede bundle em lugar
 * nenhum (`next.config.ts` tem o budget em comentário, e `perf.yml` só imprime
 * `du -sh` e nunca falha), então uma regressão passaria calada — e o sintoma
 * seria o CRM ficando lento para todo mundo por causa de uma landing.
 *
 * Precisa de um build: `describe.skipIf` sem o manifesto, como
 * `pro-signup-rls.test.ts` faz com o banco. O pulo aparece no relatório, que é o
 * ponto — ninguém pode confundir "não rodou" com "passou".
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const MANIFEST = path.join(ROOT, ".next", "app-build-manifest.json");

interface BuildManifest {
  pages: Record<string, string[]>;
}

/** Chunks que uma entrada carrega, resolvidos para caminho absoluto. */
function chunksFor(manifest: BuildManifest, entry: string): string[] {
  const files = manifest.pages[entry] ?? [];
  return files
    .filter((f) => f.endsWith(".js"))
    .map((f) => path.join(ROOT, ".next", f))
    .filter((f) => existsSync(f));
}

function totalBytes(files: string[]): number {
  return files.reduce((acc, f) => acc + statSync(f).size, 0);
}

/** Procura marcas inequívocas do three no conteúdo dos chunks. */
function mentionsThree(files: string[]): boolean {
  // Strings que o three embute no bundle e que praticamente nada mais usa.
  const marcas = ["WebGLRenderer", "THREE.WebGL", "LatheGeometry"];
  return files.some((f) => {
    const src = readFileSync(f, "utf8");
    return marcas.some((m) => src.includes(m));
  });
}

describe.skipIf(!existsSync(MANIFEST))("isolamento de bundle", () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as BuildManifest;

  it("o manifesto tem as entradas que vamos medir", () => {
    const entradas = Object.keys(manifest.pages);
    expect(entradas.some((e) => e.includes("/app/dashboard"))).toBe(true);
  });

  it("o bundle do Dashboard NÃO contém three.js", () => {
    const entry = Object.keys(manifest.pages).find((e) => e.includes("/app/dashboard"));
    expect(entry).toBeDefined();
    expect(mentionsThree(chunksFor(manifest, entry!))).toBe(false);
  });

  it("nenhuma entrada do CRM carrega three.js", () => {
    const doCrm = Object.keys(manifest.pages).filter(
      (e) => e.startsWith("/app/") && !e.includes("/models"),
    );
    const contaminadas = doCrm.filter((e) => mentionsThree(chunksFor(manifest, e)));
    expect(contaminadas).toEqual([]);
  });

  it("a landing não estoura o teto de JS (sem o chunk lazy do three)", () => {
    const entry = Object.keys(manifest.pages).find((e) => e.includes("/calc3d-pro"));
    expect(entry).toBeDefined();
    const files = chunksFor(manifest, entry!);
    // Os chunks da ENTRADA não incluem o import dinâmico, que só é baixado
    // depois do gate de capacidade — logo este número é o custo de quem abre a
    // página num celular.
    expect(mentionsThree(files)).toBe(false);
    // Teto generoso em bytes crus (≈3x o gzip). Serve para pegar uma regressão
    // grosseira, não para afinar performance.
    expect(totalBytes(files)).toBeLessThan(1_400_000);
  });
});
