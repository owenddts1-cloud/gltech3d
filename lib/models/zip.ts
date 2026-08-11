/**
 * Leitura e escrita de ZIP — o suficiente para 3MF.
 *
 * POR QUE SEM BIBLIOTECA. O `CLAUDE.md` exige justificar dependência nova, e
 * aqui não há o que justificar: a plataforma já entrega a parte difícil.
 * `DecompressionStream("deflate-raw")` é padrão web, existe no Node 20 e em todo
 * browser que roda o resto deste módulo, e é ele que faz o descompactar. O que
 * sobra é o formato do contêiner — cabeçalhos de tamanho fixo — e escrever isso
 * custa menos que carregar um pacote e a cadeia de suprimento junto.
 *
 * O QUE NÃO SUPORTA, de propósito e com erro explícito:
 *  - ZIP64 (arquivo ou entrada acima de 4 GB)
 *  - entrada criptografada
 *  - métodos além de "armazenado" (0) e "deflate" (8)
 *
 * Falha ALTO nesses casos. O jeito errado seria devolver entrada vazia e deixar
 * o 3MF virar uma peça sem triângulo nenhum, sem ninguém saber por quê.
 */

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;
const SIG_ZIP64_END = 0x06064b50;

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** CRC-32, tabela montada uma vez. O ZIP exige o checksum em cada entrada. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Este ambiente não tem DecompressionStream; não consigo ler ZIP comprimido.");
  }
  // Fonte montada à mão em vez de `new Blob([...]).stream()`: o Blob do jsdom
  // (o ambiente dos testes) não implementa `.stream()`, e o código quebrava só
  // lá. `ReadableStream` é global no Node 18+ e em todo browser alvo.
  // Cópia para um buffer próprio: `data` é uma janela sobre o arquivo inteiro
  // (`subarray`), e o tipo de `BufferSource` exige respaldo em `ArrayBuffer`
  // simples — um `SharedArrayBuffer` não serve. A cópia é do tamanho da entrada,
  // não do pacote.
  const owned = new Uint8Array(data.length);
  owned.set(data);

  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(owned);
      controller.close();
    },
  });
  const stream = source.pipeThrough<Uint8Array>(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Lê as entradas do ZIP.
 *
 * Percorre o DIRETÓRIO CENTRAL, no fim do arquivo, e não os cabeçalhos locais.
 * Os locais podem ter tamanho zerado quando o escritor usou descritor de dados
 * (comum em ZIP gerado em fluxo); o diretório central sempre tem o tamanho real.
 */
export async function readZip(buffer: ArrayBuffer): Promise<ZipEntry[]> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // O fim do diretório central tem comentário de tamanho variável no fim, então
  // a busca é de trás para frente.
  let end = -1;
  const from = Math.max(0, bytes.length - 22 - 0xffff);
  for (let i = bytes.length - 22; i >= from; i--) {
    if (view.getUint32(i, true) === SIG_END) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("Não parece um arquivo ZIP/3MF válido (fim do índice não achado).");

  // Zip64 põe 0xFFFF/0xFFFFFFFF nos campos do registro clássico.
  const count = view.getUint16(end + 10, true);
  const centralOffset = view.getUint32(end + 16, true);
  if (count === 0xffff || centralOffset === 0xffffffff) {
    throw new Error("ZIP64 não é suportado. Reexporte o arquivo sem compactação em 64 bits.");
  }
  if (view.byteLength > 8 && centralOffset >= bytes.length) {
    throw new Error("Índice do ZIP aponta para fora do arquivo — arquivo truncado?");
  }
  if (centralOffset >= 4 && view.getUint32(centralOffset - 4, true) === SIG_ZIP64_END) {
    throw new Error("ZIP64 não é suportado.");
  }

  const entries: ZipEntry[] = [];
  let p = centralOffset;

  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== SIG_CENTRAL) {
      throw new Error("Índice do ZIP corrompido.");
    }
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const nameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLength));

    if (flags & 0x1) throw new Error(`Entrada "${name}" está criptografada.`);
    if (method !== 0 && method !== 8) {
      throw new Error(`Entrada "${name}" usa compressão não suportada (método ${method}).`);
    }

    if (view.getUint32(localOffset, true) !== SIG_LOCAL) {
      throw new Error(`Cabeçalho local de "${name}" corrompido.`);
    }
    // O extra field LOCAL costuma ter tamanho diferente do central: tem de ser
    // lido do próprio cabeçalho local, não reaproveitado do índice.
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);

    entries.push({ name, data: method === 0 ? raw : await inflateRaw(raw) });
    p += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

/**
 * Escreve um ZIP com entradas ARMAZENADAS, sem compressão.
 *
 * Sem compressão de propósito: `CompressionStream` existe, mas um 3MF é XML que
 * o destino vai reabrir na hora, e entrada armazenada é ZIP perfeitamente válido
 * — todo leitor aceita. Economiza o caminho assíncrono de compressão e uma
 * classe inteira de erro sutil por poucos megabytes a mais em disco.
 */
export function writeZip(files: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.data);

    const local = new Uint8Array(30 + nameBytes.length + file.data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, SIG_LOCAL, true);
    lv.setUint16(4, 20, true); // versão necessária
    lv.setUint16(8, 0, true); // método: armazenado
    lv.setUint32(14, crc, true);
    lv.setUint32(18, file.data.length, true);
    lv.setUint32(22, file.data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(file.data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, SIG_CENTRAL, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, file.data.length, true);
    cv.setUint32(24, file.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((sum, c) => sum + c.length, 0);
  const endRecord = new Uint8Array(22);
  const ev = new DataView(endRecord.buffer);
  ev.setUint32(0, SIG_END, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const total = offset + centralSize + endRecord.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const chunk of [...locals, ...centrals, endRecord]) {
    out.set(chunk, p);
    p += chunk.length;
  }
  return out;
}
