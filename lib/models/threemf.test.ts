/**
 * 3MF: leitura e escrita.
 *
 * O teste que vale é o das FIXTURES: `cube-deflate.3mf` e
 * `cube-stored-inch.3mf` foram gerados pelo módulo `zipfile` do Python, não por
 * este código. Round-trip contra o próprio escritor provaria só que ele é
 * consistente consigo mesmo — passaria até com o formato inteiro errado.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parse3mf, write3mf } from "./threemf";
import { crc32, readZip, writeZip } from "./zip";

const fixture = (name: string): ArrayBuffer => {
  const buf = readFileSync(join(__dirname, "__fixtures__", name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};

const boundsOf = (p: Float32Array) => {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (let i = 0; i + 2 < p.length; i += 3) {
    minX = Math.min(minX, p[i]!); maxX = Math.max(maxX, p[i]!);
    minZ = Math.min(minZ, p[i + 2]!); maxZ = Math.max(maxZ, p[i + 2]!);
  }
  return { minX, maxX, minZ, maxZ };
};

const CUBE = new Float32Array([
  // duas faces bastam para os testes de escrita
  0, 0, 0, 10, 0, 0, 10, 10, 0,
  0, 0, 0, 10, 10, 0, 0, 10, 0,
]);

describe("zip", () => {
  it("crc32 bate com o vetor conhecido de \"123456789\"", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("lê um ZIP DEFLATE escrito por outra ferramenta", async () => {
    const entries = await readZip(fixture("cube-deflate.3mf"));
    const model = entries.find((e) => e.name === "3D/3dmodel.model");
    expect(model).toBeDefined();
    expect(new TextDecoder().decode(model!.data)).toContain("<triangle");
  });

  it("lê um ZIP armazenado (sem compressão)", async () => {
    const entries = await readZip(fixture("cube-stored-inch.3mf"));
    expect(entries.map((e) => e.name)).toContain("3D/3dmodel.model");
  });

  it("o que eu escrevo, eu releio", async () => {
    const data = new TextEncoder().encode("conteúdo de teste com acento");
    const zip = writeZip([{ name: "a/b.txt", data }]);
    const back = await readZip(zip.buffer.slice(0) as ArrayBuffer);
    expect(back).toHaveLength(1);
    expect(back[0]!.name).toBe("a/b.txt");
    expect(new TextDecoder().decode(back[0]!.data)).toBe("conteúdo de teste com acento");
  });

  it("recusa lixo em vez de devolver vazio em silêncio", async () => {
    await expect(readZip(new Uint8Array(200).buffer)).rejects.toThrow(/ZIP/i);
  });
});

describe("parse3mf", () => {
  it("lê o cubo comprimido: 12 triângulos", async () => {
    const mesh = await parse3mf(fixture("cube-deflate.3mf"));
    expect(mesh.numTriangles).toBe(12);
    expect(mesh.positions.length).toBe(12 * 9);
  });

  it("as dimensões batem com o cubo de 10 mm", async () => {
    const { positions } = await parse3mf(fixture("cube-deflate.3mf"));
    const b = boundsOf(positions);
    expect(b.maxX - b.minX).toBeCloseTo(10, 4);
    expect(b.maxZ - b.minZ).toBeCloseTo(10, 4);
  });

  it("CONVERTE A UNIDADE: o mesmo cubo em polegadas vira 254 mm", async () => {
    // O erro silencioso mais caro do 3MF. Lido como milímetro, sairia 25,4
    // vezes menor e nada no arquivo reclamaria.
    const { positions } = await parse3mf(fixture("cube-stored-inch.3mf"));
    const b = boundsOf(positions);
    expect(b.maxX - b.minX).toBeCloseTo(254, 3);
  });

  it("a caixa envolvente é recalculada, não copiada do arquivo", async () => {
    const mesh = await parse3mf(fixture("cube-stored-inch.3mf"));
    expect(mesh.boundingBox.max[0] - mesh.boundingBox.min[0]).toBeCloseTo(254, 3);
  });

  it("não gera NaN", async () => {
    const { positions } = await parse3mf(fixture("cube-deflate.3mf"));
    for (const v of positions) expect(Number.isFinite(v)).toBe(true);
  });

  it("recusa unidade desconhecida em vez de adivinhar a escala", async () => {
    const zip = writeZip([
      {
        name: "3D/3dmodel.model",
        data: new TextEncoder().encode(
          '<model unit="furlong"><resources></resources><build/></model>',
        ),
      },
    ]);
    await expect(parse3mf(zip.buffer.slice(0) as ArrayBuffer)).rejects.toThrow(/furlong/);
  });

  it("recusa 3MF sem o arquivo de modelo dentro", async () => {
    const zip = writeZip([{ name: "leia-me.txt", data: new TextEncoder().encode("oi") }]);
    await expect(parse3mf(zip.buffer.slice(0) as ArrayBuffer)).rejects.toThrow(/3dmodel|modelo/i);
  });

  it("pula triângulo com índice fora da faixa em vez de emitir NaN", async () => {
    const xml = `<model unit="millimeter"><resources><object id="1"><mesh>
      <vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="1" y="1" z="0"/></vertices>
      <triangles><triangle v1="0" v2="1" v3="2"/><triangle v1="0" v2="1" v3="99"/></triangles>
    </mesh></object></resources><build><item objectid="1"/></build></model>`;
    const zip = writeZip([{ name: "3D/3dmodel.model", data: new TextEncoder().encode(xml) }]);
    const mesh = await parse3mf(zip.buffer.slice(0) as ArrayBuffer);
    expect(mesh.numTriangles).toBe(1);
    for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true);
  });

  it("aplica a translação do item da build", async () => {
    const xml = `<model unit="millimeter"><resources><object id="1"><mesh>
      <vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="1" y="1" z="0"/></vertices>
      <triangles><triangle v1="0" v2="1" v3="2"/></triangles>
    </mesh></object></resources>
    <build><item objectid="1" transform="1 0 0 0 1 0 0 0 1 100 0 0"/></build></model>`;
    const zip = writeZip([{ name: "3D/3dmodel.model", data: new TextEncoder().encode(xml) }]);
    const mesh = await parse3mf(zip.buffer.slice(0) as ArrayBuffer);
    expect(boundsOf(mesh.positions).minX).toBeCloseTo(100, 4);
  });
});

describe("write3mf", () => {
  it("o que escrevo volta com os mesmos triângulos", async () => {
    const mesh = await parse3mf(write3mf(CUBE).buffer.slice(0) as ArrayBuffer);
    expect(mesh.numTriangles).toBe(2);
    const b = boundsOf(mesh.positions);
    expect(b.maxX - b.minX).toBeCloseTo(10, 4);
  });

  it("INDEXA os vértices — é metade da razão de o 3MF existir", async () => {
    // Os dois triângulos compartilham 2 cantos: 6 posições viram 4 vértices.
    const xml = new TextDecoder().decode(
      (await readZip(write3mf(CUBE).buffer.slice(0) as ArrayBuffer))
        .find((e) => e.name === "3D/3dmodel.model")!.data,
    );
    expect((xml.match(/<vertex /g) ?? []).length).toBe(4);
    expect((xml.match(/<triangle /g) ?? []).length).toBe(2);
  });

  it("declara milímetro — o modelo interno é sempre mm", async () => {
    const xml = new TextDecoder().decode(
      (await readZip(write3mf(CUBE).buffer.slice(0) as ArrayBuffer))
        .find((e) => e.name === "3D/3dmodel.model")!.data,
    );
    expect(xml).toContain('unit="millimeter"');
  });

  it("traz as partes obrigatórias do pacote", async () => {
    const names = (await readZip(write3mf(CUBE).buffer.slice(0) as ArrayBuffer)).map((e) => e.name);
    expect(names).toContain("[Content_Types].xml");
    expect(names).toContain("_rels/.rels");
    expect(names).toContain("3D/3dmodel.model");
  });

  it("escapa o nome em vez de deixar quebrar o XML", async () => {
    const xml = new TextDecoder().decode(
      (await readZip(write3mf(CUBE, 'pe<ça>"x"').buffer.slice(0) as ArrayBuffer))
        .find((e) => e.name === "3D/3dmodel.model")!.data,
    );
    // Os caracteres perigosos são REMOVIDOS, não trocados por entidade: o nome
    // é rótulo, não conteúdo, e remover é o que não deixa XML meio escapado.
    expect(xml).toContain("<metadata name=\"Title\">peçax</metadata>");
    expect(xml).not.toContain("pe<");
  });

  it("ida e volta preserva a geometria de um 3MF de outra ferramenta", async () => {
    const original = await parse3mf(fixture("cube-deflate.3mf"));
    const roundTrip = await parse3mf(
      write3mf(original.positions).buffer.slice(0) as ArrayBuffer,
    );
    expect(roundTrip.numTriangles).toBe(original.numTriangles);
    expect(boundsOf(roundTrip.positions)).toEqual(boundsOf(original.positions));
  });
});
