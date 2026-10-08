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

/**
 * Line breaks (anywhere) and spaces at the ends appear when copying from a bank
 * app or pasting into an env var. Spaces INSIDE are kept: the receiver name and
 * city legitimately contain them ("5916GUILHERME LANUCI") and the CRC covers
 * them — stripping every space broke every code whose name had one.
 */
export function normalizeBrCodeInput(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[\r\n\t]+/g, "").trim();
}

export function parseBrCode(raw: string | null | undefined): BrCodeResult {
  const input = normalizeBrCodeInput(raw);
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

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export interface PixPayloadInput {
  /** Pix key (e-mail, CPF/CNPJ digits, +55 phone or random key). */
  key: string;
  /** Receiver name. Sanitized to ASCII uppercase and cut to 25 chars. */
  receiverName: string;
  /** Receiver city. Sanitized to ASCII uppercase and cut to 15 chars. */
  city: string;
  /** Fixed amount in cents. `null`/`0` produces a code without amount (payer types it). */
  amountCents: number | null;
  /** Up to 25 alphanumeric chars. Default `***` (no identifier, per the BCB manual). */
  txid?: string | null;
}

/** One EMV TLV field: 2-digit id, 2-digit length, value. */
function tlv(id: string, value: string): string {
  if (value.length > 99) throw new Error(`BR Code field ${id} longer than 99 chars`);
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** ASCII uppercase without accents, only letters/digits/space, trimmed and cut. */
export function sanitizePixText(value: string, max: number): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

function sanitizeTxid(value: string | null | undefined): string {
  const clean = (value ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25);
  return clean.length > 0 ? clean : "***";
}

/**
 * Builds a STATIC Pix BR Code ("copia e cola") with the amount embedded.
 *
 * Replaces the hand-pasted `NEXT_PUBLIC_PIX_COPIA_E_COLA`: that code had the
 * price frozen inside it, so every price change needed someone to regenerate it
 * in the bank app. Generated here, the code always carries the current price
 * (platform_settings) and `parseBrCode` validates it in the tests.
 *
 * Throws on input that cannot produce a payable code (empty key/name/city,
 * negative amount) — the caller decides the fallback.
 */
export function buildPixPayload(input: PixPayloadInput): string {
  const key = input.key.trim();
  if (!key) throw new Error("Pix key is empty");
  if (key.length > 77) throw new Error("Pix key too long");

  const name = sanitizePixText(input.receiverName, 25);
  const city = sanitizePixText(input.city, 15);
  if (!name) throw new Error("Pix receiver name is empty after sanitizing");
  if (!city) throw new Error("Pix city is empty after sanitizing");

  const cents = input.amountCents ?? 0;
  if (!Number.isInteger(cents) || cents < 0) throw new Error("Pix amount must be a non-negative integer of cents");

  const merchantAccount = tlv("00", "br.gov.bcb.pix") + tlv("01", key);
  const parts = [
    tlv("00", "01"),
    tlv("26", merchantAccount),
    tlv("52", "0000"),
    tlv("53", "986"),
    cents > 0 ? tlv("54", (cents / 100).toFixed(2)) : "",
    tlv("58", "BR"),
    tlv("59", name),
    tlv("60", city),
    tlv("62", tlv("05", sanitizeTxid(input.txid))),
  ];
  const withoutCrc = `${parts.join("")}6304`;
  return `${withoutCrc}${crc16(withoutCrc)}`;
}
