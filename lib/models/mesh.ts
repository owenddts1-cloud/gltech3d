/**
 * Porta de entrada única para malha: escolhe o parser certo.
 *
 * Existe para o resto do sistema não precisar saber de formato. Antes disto,
 * cada worker chamava `parseStlBuffer` direto, e acrescentar 3MF significaria
 * repetir a decisão em cada ponto de entrada — que é como um formato acaba
 * suportado num lugar e não no outro.
 */

import { parseStlBuffer, type ParsedStl } from "./stl";
import { parse3mf } from "./threemf";

/** Assinatura de arquivo ZIP: "PK\x03\x04". 3MF é um pacote ZIP. */
function isZip(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const b = new Uint8Array(buffer, 0, 4);
  return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

/**
 * Lê STL (binário ou ASCII) ou 3MF.
 *
 * A extensão é uma DICA, não a decisão: arquivo renomeado é comum, e o conteúdo
 * não mente. Se o buffer começa com a assinatura de ZIP, é 3MF, tenha o nome que
 * tiver.
 */
export async function parseMeshBuffer(buffer: ArrayBuffer, filename = ""): Promise<ParsedStl> {
  if (isZip(buffer)) return parse3mf(buffer);

  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "3mf") {
    throw new Error("O arquivo tem extensão .3mf mas não é um pacote ZIP válido.");
  }
  return parseStlBuffer(buffer);
}
