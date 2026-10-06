/**
 * Leitura e validação do "Pix copia e cola" (BR Code, padrão EMV do Banco Central).
 *
 * POR QUE VALIDAR em vez de só exibir o texto: o copia-e-cola carrega o VALOR
 * gravado dentro dele. Se o preço do plano mudar e ninguém regerar o código, a
 * página continuaria cobrando o valor antigo — em silêncio, porque o código
 * continua válido para o banco. Esta checagem compara o valor do código com o
 * preço do plano e esconde o copia-e-cola quando divergem.
 *
 * Também confere o CRC: um caractere a mais ou a menos ao colar o código na
 * variável de ambiente produz um código que TODOS os bancos recusam, e o
 * comprador acha que o problema é com ele.
 *
 * Função pura, sem dependência: roda no servidor, no cliente e nos testes.
 */

export interface BrCode {
  /** Chave Pix (campo 26 > 01). */
  key: string | null;
  /** Valor em centavos, ou null quando o código não fixa valor. */
  amountCents: number | null;
  /** Nome do recebedor gravado no código (campo 59). */
  merchantName: string | null;
  /** Cidade (campo 60). */
  merchantCity: string | null;
  /** Identificador da transação (campo 62 > 05). */
  txid: string | null;
}

export type BrCodeResult =
  | { ok: true; code: BrCode }
  | { ok: false; reason: "empty" | "malformed" | "bad_crc" | "not_pix" };

/** Separa os campos TLV: 2 dígitos de id, 2 de tamanho, e o valor. */
function parseTlv(input: string): Map<string, string> | null {
  const out = new Map<string, string>();
  let i = 0;
  while (i < input.length) {
    if (i + 4 > input.length) return null;
    const id = input.slice(i, i + 2);
    const len = Number(input.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || !Number.isInteger(len)) return null;
    const value = input.slice(i + 4, i + 4 + len);
    if (value.length !== len) return null;
    out.set(id, value);
    i += 4 + len;
  }
  return out;
}

/** CRC16-CCITT-FALSE, o algoritmo que o padrão do Banco Central exige. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  const bytes = new TextEncoder().encode(payload);
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let k = 0; k < 8; k++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function parseBrCode(raw: string | null | undefined): BrCodeResult {
  // Quebras de linha e espaços nas pontas aparecem ao copiar do app do banco.
  const input = (raw ?? "").replace(/\s+/g, "");
  if (!input) return { ok: false, reason: "empty" };

  // O CRC são os 4 últimos caracteres e cobre tudo antes deles, INCLUSIVE o
  // cabeçalho "6304" do próprio campo.
  if (input.length < 8 || input.slice(-8, -4) !== "6304") return { ok: false, reason: "malformed" };
  if (crc16(input.slice(0, -4)) !== input.slice(-4).toUpperCase()) {
    return { ok: false, reason: "bad_crc" };
  }

  const fields = parseTlv(input);
  if (!fields) return { ok: false, reason: "malformed" };

  const account = fields.get("26");
  const accountFields = account ? parseTlv(account) : null;
  if (!accountFields || accountFields.get("00")?.toLowerCase() !== "br.gov.bcb.pix") {
    return { ok: false, reason: "not_pix" };
  }

  const amountRaw = fields.get("54");
  const amount = amountRaw ? Number(amountRaw) : NaN;

  const extra = fields.get("62");
  const extraFields = extra ? parseTlv(extra) : null;

  return {
    ok: true,
    code: {
      key: accountFields.get("01") ?? null,
      amountCents: Number.isFinite(amount) ? Math.round(amount * 100) : null,
      merchantName: fields.get("59") ?? null,
      merchantCity: fields.get("60") ?? null,
      txid: extraFields?.get("05") ?? null,
    },
  };
}

export type CopiaEColaCheck =
  | { usable: true; code: BrCode }
  | {
      usable: false;
      reason: "empty" | "malformed" | "bad_crc" | "not_pix" | "amount_mismatch" | "key_mismatch";
    };

/**
 * O copia-e-cola pode ser mostrado ao comprador?
 *
 * Exige: código íntegro, valor igual ao preço do plano (ou sem valor fixo), e a
 * mesma chave que a página exibe. Qualquer divergência esconde o copia-e-cola —
 * a chave copiável continua na tela, então o comprador ainda consegue pagar.
 */
export function checkCopiaECola(
  raw: string | null | undefined,
  expected: { amountCents: number; key?: string | null },
): CopiaEColaCheck {
  const parsed = parseBrCode(raw);
  if (!parsed.ok) return { usable: false, reason: parsed.reason };

  const { code } = parsed;
  if (code.amountCents !== null && code.amountCents !== expected.amountCents) {
    return { usable: false, reason: "amount_mismatch" };
  }
  if (expected.key && code.key && code.key.toLowerCase() !== expected.key.trim().toLowerCase()) {
    return { usable: false, reason: "key_mismatch" };
  }
  return { usable: true, code };
}
