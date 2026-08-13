/**
 * A ponte entre a malha e o custo.
 *
 * O teste que mais importa aqui é o de EQUIVALÊNCIA DE FORMATO: a mesma
 * geometria em STL e em 3MF tem de produzir a mesma estimativa. Se divergir, o
 * custo de uma peça passaria a depender de qual arquivo foi enviado — e ninguém
 * desconfiaria, porque os dois números pareceriam plausíveis.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { estimateFromMesh } from "./estimate-from-mesh";
import { writeBinaryStl } from "@/lib/models/stl";
import { write3mf } from "@/lib/models/threemf";

const ab = (u: Uint8Array | ArrayBuffer): ArrayBuffer =>
  u instanceof ArrayBuffer ? u : (u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer);

/** Caixa fechada de 20×20×10 mm — geometria mínima que fatia de verdade. */
function box(sx: number, sy: number, sz: number): Float32Array {
  const v: Array<[number, number, number]> = [
    [0, 0, 0], [sx, 0, 0], [sx, sy, 0], [0, sy, 0],
    [0, 0, sz], [sx, 0, sz], [sx, sy, sz], [0, sy, sz],
  ];
  const quads: Array<[number, number, number, number]> = [
    [0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
  ];
  const out: number[] = [];
  for (const [a, b, c, d] of quads) out.push(...v[a]!, ...v[b]!, ...v[c]!, ...v[a]!, ...v[c]!, ...v[d]!);
  return new Float32Array(out);
}

const CAIXA = box(20, 20, 10);

const fixture = (name: string): ArrayBuffer => {
  const b = readFileSync(join(__dirname, "..", "models", "__fixtures__", name));
  return ab(b);
};

describe("equivalência de formato — a razão deste arquivo existir", () => {
  it("a MESMA peça em STL e em 3MF dá a MESMA estimativa", async () => {
    const stl = await estimateFromMesh(ab(writeBinaryStl(CAIXA)), {}, "peca.stl");
    const tresMf = await estimateFromMesh(ab(write3mf(CAIXA, "peca")), {}, "peca.3mf");

    expect(tresMf.filamentGrams).toBe(stl.filamentGrams);
    expect(tresMf.printTimeSeconds).toBe(stl.printTimeSeconds);
    expect(tresMf.layerCount).toBe(stl.layerCount);
    expect(tresMf.triangles).toBe(stl.triangles);
    expect(tresMf.openContourCount).toBe(stl.openContourCount);
  });

  it("lê 3MF de OUTRA ferramenta, não só o que eu escrevo", async () => {
    // Fixture gerada pelo módulo `zipfile` do Python. Testar só o próprio
    // escritor provaria coerência interna e passaria com o formato errado.
    const r = await estimateFromMesh(fixture("cube-deflate.3mf"), {}, "cube.3mf");
    expect(r.triangles).toBe(12);
    expect(r.filamentGrams).toBeGreaterThan(0);
  });

  it("respeita a UNIDADE do 3MF: o cubo em polegadas gasta muito mais", async () => {
    // 10 mm contra 254 mm. Ler polegada como milímetro produziria uma peça 25,4×
    // menor e um custo ridiculamente baixo, sem nada acusar.
    const mm = await estimateFromMesh(fixture("cube-deflate.3mf"), {}, "mm.3mf");
    const pol = await estimateFromMesh(fixture("cube-stored-inch.3mf"), {}, "pol.3mf");
    expect(pol.filamentGrams).toBeGreaterThan(mm.filamentGrams * 10);
    expect(pol.layerCount).toBeGreaterThan(mm.layerCount * 10);
  });
});

describe("estimativa", () => {
  it("devolve os dois números que o custo precisa, positivos", async () => {
    const r = await estimateFromMesh(ab(writeBinaryStl(CAIXA)), {}, "p.stl");
    expect(r.filamentGrams).toBeGreaterThan(0);
    expect(r.printTimeSeconds).toBeGreaterThan(0);
    expect(Number.isFinite(r.filamentGrams)).toBe(true);
  });

  it("carrega o perfil usado — proveniência, não só o número", async () => {
    const r = await estimateFromMesh(ab(writeBinaryStl(CAIXA)), {
      settings: { infillDensityPct: 40, wallCount: 3 },
    });
    expect(r.profile.infillDensityPct).toBe(40);
    expect(r.profile.wallCount).toBe(3);
    expect(r.profile.autoOriented).toBe(true);
  });

  it("mais preenchimento gasta mais filamento", async () => {
    const buf = ab(writeBinaryStl(CAIXA));
    const magro = await estimateFromMesh(buf, { settings: { infillDensityPct: 5 } });
    const cheio = await estimateFromMesh(buf, { settings: { infillDensityPct: 60 } });
    expect(cheio.filamentGrams).toBeGreaterThan(magro.filamentGrams);
  });

  it("caixa fechada não tem contorno aberto", async () => {
    const r = await estimateFromMesh(ab(writeBinaryStl(CAIXA)), {}, "p.stl");
    expect(r.openContourCount).toBe(0);
  });

  it("peça mais fina que a camada falha com mensagem clara, não com zero", async () => {
    // Devolver "0 g" seria pior: entraria no custo como peça de graça.
    await expect(
      estimateFromMesh(ab(writeBinaryStl(box(10, 10, 0.05))), {}, "fina.stl"),
    ).rejects.toThrow(/camada|vazia/i);
  });

  it("arquivo que não é malha falha com mensagem específica", async () => {
    const lixo = new TextEncoder().encode("isto nao e um modelo 3d, e texto puro");
    await expect(estimateFromMesh(ab(lixo), {}, "x.stl")).rejects.toThrow();
  });

  it(".3mf que não é pacote ZIP é recusado pela extensão", async () => {
    const lixo = new TextEncoder().encode("nao sou um zip");
    await expect(estimateFromMesh(ab(lixo), {}, "falso.3mf")).rejects.toThrow(/ZIP/i);
  });
});
