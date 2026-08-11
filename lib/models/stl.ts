/**
 * Parser de STL — binário e ASCII.
 *
 * Módulo PURO (sem `self`, sem DOM), para rodar tanto dentro do Web Worker
 * quanto no Vitest. A versão anterior vivia solta em `public/workers/` como
 * script clássico, o que a tornava impossível de testar: um arquivo em `public/`
 * não é importável.
 *
 * REGRESSÃO QUE ISTO CORRIGE: só existia o caminho BINÁRIO. Um STL ASCII —
 * metade do que circula, e o que a maioria dos CADs exporta por padrão — era
 * recusado com "File size does not match binary STL structure", uma mensagem que
 * não diz ao usuário o que fazer.
 */

export interface StlBoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

export interface ParsedStl {
  positions: Float32Array;
  normals: Float32Array;
  boundingBox: StlBoundingBox;
  numTriangles: number;
  format: "binary" | "ascii";
}

/**
 * Decide se o buffer é STL binário.
 *
 * NÃO basta procurar "solid" no começo: exportadores binários também escrevem
 * "solid" nos 80 bytes de cabeçalho, e cair no parser ASCII por causa disso
 * devolveria zero triângulos em silêncio. O teste confiável é aritmético — se
 * `84 + n*50` bate com o tamanho do arquivo, é binário.
 */
export function isBinaryStl(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 84) return false;
  const view = new DataView(buffer);
  const numTriangles = view.getUint32(80, true);
  return 84 + numTriangles * 50 === buffer.byteLength;
}

/** Caixa envolvente. Exportada porque girar a peça invalida a do arquivo. */
export function boundsOf(positions: Float32Array): StlBoundingBox {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!, y = positions[i + 1]!, z = positions[i + 2]!;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  // Malha vazia deixaria ±Infinity vazando para o viewport e para o banco.
  if (!Number.isFinite(minX)) {
    return { min: [0, 0, 0], max: [0, 0, 0] };
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

export function parseBinaryStl(buffer: ArrayBuffer): ParsedStl {
  const view = new DataView(buffer);
  const numTriangles = view.getUint32(80, true);
  const positions = new Float32Array(numTriangles * 9);
  const normals = new Float32Array(numTriangles * 9);

  let offset = 84;
  let p = 0;
  let n = 0;

  for (let i = 0; i < numTriangles; i++) {
    const nx = view.getFloat32(offset, true);
    const ny = view.getFloat32(offset + 4, true);
    const nz = view.getFloat32(offset + 8, true);
    offset += 12;

    for (let v = 0; v < 3; v++) {
      positions[p++] = view.getFloat32(offset, true);
      positions[p++] = view.getFloat32(offset + 4, true);
      positions[p++] = view.getFloat32(offset + 8, true);
      offset += 12;
      normals[n++] = nx;
      normals[n++] = ny;
      normals[n++] = nz;
    }
    offset += 2; // attribute byte count
  }

  return { positions, normals, boundingBox: boundsOf(positions), numTriangles, format: "binary" };
}

/**
 * STL ASCII.
 *
 * Lê por regex sobre o texto inteiro em vez de linha a linha: exportadores
 * variam indentação, quebra de linha (CRLF) e espaçamento, e um parser por
 * `split("\n")` com `trim().split(" ")` quebra em qualquer um desses.
 * `facet normal` é opcional em arquivos malformados — nesse caso a normal sai
 * zerada e o viewport a recalcula.
 */
export function parseAsciiStl(buffer: ArrayBuffer): ParsedStl {
  const text = new TextDecoder().decode(buffer);
  const num = String.raw`[-+]?[\d.]+(?:[eE][-+]?\d+)?`;
  const facetRe = new RegExp(
    String.raw`facet(?:\s+normal\s+(${num})\s+(${num})\s+(${num}))?` +
      String.raw`[\s\S]*?outer\s+loop([\s\S]*?)endloop`,
    "g",
  );
  const vertexRe = new RegExp(String.raw`vertex\s+(${num})\s+(${num})\s+(${num})`, "g");

  const pos: number[] = [];
  const nor: number[] = [];
  let numTriangles = 0;

  for (const facet of text.matchAll(facetRe)) {
    const nx = Number(facet[1] ?? 0);
    const ny = Number(facet[2] ?? 0);
    const nz = Number(facet[3] ?? 0);

    const verts = [...(facet[4] ?? "").matchAll(vertexRe)];
    // Loop com número de vértices diferente de 3 não é triângulo; pular é
    // melhor que emitir geometria torta.
    if (verts.length !== 3) continue;

    for (const v of verts) {
      pos.push(Number(v[1]), Number(v[2]), Number(v[3]));
      nor.push(nx, ny, nz);
    }
    numTriangles++;
  }

  if (numTriangles === 0) {
    throw new Error("Nenhum triângulo encontrado. O arquivo parece um STL ASCII vazio ou corrompido.");
  }

  const positions = new Float32Array(pos);
  return {
    positions,
    normals: new Float32Array(nor),
    boundingBox: boundsOf(positions),
    numTriangles,
    format: "ascii",
  };
}

/** Detecta o formato e delega. É a única porta de entrada do parser. */
export function parseStlBuffer(buffer: ArrayBuffer): ParsedStl {
  if (buffer.byteLength < 15) {
    throw new Error("Arquivo pequeno demais para ser um STL válido.");
  }
  if (isBinaryStl(buffer)) return parseBinaryStl(buffer);

  const head = new TextDecoder().decode(buffer.slice(0, 256)).trimStart().toLowerCase();
  if (head.startsWith("solid")) return parseAsciiStl(buffer);

  // Nem binário coerente nem ASCII: dizer o que foi encontrado ajuda mais que
  // "estrutura inválida".
  const declared = buffer.byteLength >= 84 ? new DataView(buffer).getUint32(80, true) : 0;
  throw new Error(
    `Não reconheci o arquivo como STL. O cabeçalho binário declara ${declared.toLocaleString("pt-BR")} triângulos, ` +
      `o que exigiria ${(84 + declared * 50).toLocaleString("pt-BR")} bytes, mas o arquivo tem ${buffer.byteLength.toLocaleString("pt-BR")}.`,
  );
}

/**
 * Volume por soma de tetraedros com sinal, em mm³.
 *
 * Vale para malha fechada e orientada. Malha aberta ou com normais invertidas
 * devolve número sem sentido — por isso o resultado é exibido como "aproximado".
 */
export function signedMeshVolume(positions: Float32Array): number {
  let volume = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const ax = positions[i]!,     ay = positions[i + 1]!, az = positions[i + 2]!;
    const bx = positions[i + 3]!, by = positions[i + 4]!, bz = positions[i + 5]!;
    const cx = positions[i + 6]!, cy = positions[i + 7]!, cz = positions[i + 8]!;
    volume +=
      (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return Math.abs(volume);
}
