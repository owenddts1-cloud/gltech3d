import { describe, it, expect } from "vitest";

import {
  parseStlBuffer,
  parseBinaryStl,
  parseAsciiStl,
  isBinaryStl,
  signedMeshVolume,
} from "./stl";

/**
 * O parser é a porta de entrada do repositório 3D. Falha aqui não dá erro
 * visível: o modelo abre torto, com volume errado, ou é recusado com uma
 * mensagem que não ajuda. Daí a densidade de asserções.
 */

/** Cubo de 10 mm na origem: 12 triângulos, volume 1000 mm³ = 1 cm³. */
const CUBE_TRIS: number[][] = (() => {
  const v = [
    [0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0],
    [0, 0, 10], [10, 0, 10], [10, 10, 10], [0, 10, 10],
  ];
  // Faces com winding para fora (normal apontando para fora do sólido).
  const quads: Array<[number, number, number, number]> = [
    [0, 3, 2, 1], // base  (z=0)
    [4, 5, 6, 7], // topo  (z=10)
    [0, 1, 5, 4], // y=0
    [1, 2, 6, 5], // x=10
    [2, 3, 7, 6], // y=10
    [3, 0, 4, 7], // x=0
  ];
  const tris: number[][] = [];
  for (const [a, b, c, d] of quads) {
    tris.push([...v[a]!, ...v[b]!, ...v[c]!]);
    tris.push([...v[a]!, ...v[c]!, ...v[d]!]);
  }
  return tris;
})();

function binaryCube(): ArrayBuffer {
  const buffer = new ArrayBuffer(84 + CUBE_TRIS.length * 50);
  const view = new DataView(buffer);
  view.setUint32(80, CUBE_TRIS.length, true);
  let offset = 84;
  for (const t of CUBE_TRIS) {
    offset += 12; // normal zerada — o viewport recalcula
    for (let i = 0; i < 9; i++) {
      view.setFloat32(offset, t[i]!, true);
      offset += 4;
    }
    offset += 2;
  }
  return buffer;
}

function asciiCube(eol = "\n", indent = "  "): ArrayBuffer {
  const body = CUBE_TRIS.map((t) =>
    [
      `${indent}facet normal 0 0 0`,
      `${indent}${indent}outer loop`,
      `${indent}${indent}${indent}vertex ${t[0]} ${t[1]} ${t[2]}`,
      `${indent}${indent}${indent}vertex ${t[3]} ${t[4]} ${t[5]}`,
      `${indent}${indent}${indent}vertex ${t[6]} ${t[7]} ${t[8]}`,
      `${indent}${indent}endloop`,
      `${indent}endfacet`,
    ].join(eol),
  ).join(eol);
  const text = `solid cubo${eol}${body}${eol}endsolid cubo${eol}`;
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

describe("isBinaryStl", () => {
  it("reconhece binário pela aritmética 84 + n*50", () => {
    expect(isBinaryStl(binaryCube())).toBe(true);
  });

  it("NÃO se deixa enganar por 'solid' no cabeçalho binário", () => {
    // Exportadores binários escrevem "solid ..." nos 80 bytes de header. Decidir
    // o formato por essa palavra mandaria o arquivo para o parser ASCII, que
    // devolveria zero triângulos em silêncio.
    const buffer = binaryCube();
    new Uint8Array(buffer).set(new TextEncoder().encode("solid exportado por CAD"), 0);
    expect(isBinaryStl(buffer)).toBe(true);
    expect(parseStlBuffer(buffer).format).toBe("binary");
  });

  it("recusa ASCII e arquivo curto", () => {
    expect(isBinaryStl(asciiCube())).toBe(false);
    expect(isBinaryStl(new ArrayBuffer(10))).toBe(false);
  });
});

describe("parseStlBuffer — binário", () => {
  it("lê os 12 triângulos do cubo", () => {
    const r = parseStlBuffer(binaryCube());
    expect(r.format).toBe("binary");
    expect(r.numTriangles).toBe(12);
    expect(r.positions).toHaveLength(12 * 9);
  });

  it("calcula a bounding box correta", () => {
    const r = parseBinaryStl(binaryCube());
    expect(r.boundingBox.min).toEqual([0, 0, 0]);
    expect(r.boundingBox.max).toEqual([10, 10, 10]);
  });
});

describe("parseStlBuffer — ASCII", () => {
  it("lê o mesmo cubo em ASCII", () => {
    // REGRESSÃO: antes lançava "File size does not match binary STL structure".
    const r = parseStlBuffer(asciiCube());
    expect(r.format).toBe("ascii");
    expect(r.numTriangles).toBe(12);
    expect(r.boundingBox.max).toEqual([10, 10, 10]);
  });

  it("sobrevive a CRLF e indentação com tab", () => {
    // Parser por split/trim quebra em um desses; por isso é regex sobre o texto.
    expect(parseStlBuffer(asciiCube("\r\n", "\t")).numTriangles).toBe(12);
  });

  it("lê notação científica e sinal", () => {
    const text = `solid s
facet normal -1.0 0 0
 outer loop
  vertex 1.5e1 -2.5 0
  vertex 0 1e-2 0
  vertex 0 0 3
 endloop
endfacet
endsolid s`;
    const r = parseAsciiStl(new TextEncoder().encode(text).buffer as ArrayBuffer);
    expect(r.numTriangles).toBe(1);
    expect(r.boundingBox.max[0]).toBeCloseTo(15, 5);
    expect(r.boundingBox.min[1]).toBeCloseTo(-2.5, 5);
  });

  it("preserva a normal declarada", () => {
    const r = parseAsciiStl(asciiCube());
    expect(r.normals).toHaveLength(12 * 9);
  });

  it("descarta loop que não tem 3 vértices", () => {
    const text = `solid s
facet normal 0 0 1
 outer loop
  vertex 0 0 0
  vertex 1 0 0
 endloop
endfacet
facet normal 0 0 1
 outer loop
  vertex 0 0 0
  vertex 1 0 0
  vertex 0 1 0
 endloop
endfacet
endsolid s`;
    const r = parseAsciiStl(new TextEncoder().encode(text).buffer as ArrayBuffer);
    expect(r.numTriangles).toBe(1);
  });

  it("erro claro quando não há triângulo nenhum", () => {
    const empty = new TextEncoder().encode("solid vazio\nendsolid vazio\n").buffer as ArrayBuffer;
    expect(() => parseStlBuffer(empty)).toThrow(/vazio ou corrompido/i);
  });
});

describe("parseStlBuffer — erros legíveis", () => {
  it("arquivo minúsculo", () => {
    expect(() => parseStlBuffer(new ArrayBuffer(4))).toThrow(/pequeno demais/i);
  });

  it("binário truncado diz os números, não 'estrutura inválida'", () => {
    // A mensagem antiga não permitia ao usuário entender nada.
    const buffer = new ArrayBuffer(200);
    new DataView(buffer).setUint32(80, 9999, true);
    expect(() => parseStlBuffer(buffer)).toThrow(/9.999/);
    expect(() => parseStlBuffer(buffer)).toThrow(/200/);
  });
});

describe("signedMeshVolume", () => {
  it("cubo de 10 mm = 1000 mm³ (1 cm³)", () => {
    const r = parseStlBuffer(binaryCube());
    expect(signedMeshVolume(r.positions)).toBeCloseTo(1000, 3);
  });

  it("binário e ASCII dão o MESMO volume", () => {
    // Se divergissem, o mesmo modelo teria custo diferente conforme o formato.
    const bin = signedMeshVolume(parseStlBuffer(binaryCube()).positions);
    const ascii = signedMeshVolume(parseStlBuffer(asciiCube()).positions);
    expect(ascii).toBeCloseTo(bin, 3);
  });

  it("é positivo mesmo com winding invertido", () => {
    const r = parseStlBuffer(binaryCube());
    const flipped = new Float32Array(r.positions);
    for (let i = 0; i < flipped.length; i += 9) {
      for (let k = 0; k < 3; k++) {
        const tmp = flipped[i + k]!;
        flipped[i + k] = flipped[i + 3 + k]!;
        flipped[i + 3 + k] = tmp;
      }
    }
    expect(signedMeshVolume(flipped)).toBeCloseTo(1000, 3);
  });

  it("malha vazia = 0, sem NaN", () => {
    expect(signedMeshVolume(new Float32Array(0))).toBe(0);
  });
});

describe("bounding box", () => {
  it("malha vazia não vaza Infinity", () => {
    // ±Infinity chegaria ao jsonb do banco e ao viewport.
    const text = "solid s\nfacet normal 0 0 0\n outer loop\n  vertex 0 0 0\n endloop\nendfacet\nendsolid s";
    expect(() => parseAsciiStl(new TextEncoder().encode(text).buffer as ArrayBuffer)).toThrow();
  });
});
