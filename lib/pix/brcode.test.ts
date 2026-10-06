import { describe, it, expect } from "vitest";
import { parseBrCode, checkCopiaECola, crc16 } from "./brcode";
import { PRO_PLANS } from "@/lib/pricing/pro-plans";

/** O código real do plano, gerado no app do banco. */
const CODIGO_REAL =
  "00020126580014br.gov.bcb.pix0136eb2082ad-a521-4ff7-9670-7760988d3126520400005303986540589.005802BR5901N6001C62120508GLTECH3D63044F34";
const CHAVE = "eb2082ad-a521-4ff7-9670-7760988d3126";

/** Monta um código válido trocando só o valor — para simular preço desatualizado. */
function comValor(valor: string): string {
  const semCrc = CODIGO_REAL.slice(0, -4).replace(
    "540589.00",
    `54${String(valor.length).padStart(2, "0")}${valor}`,
  );
  return semCrc + crc16(semCrc);
}

describe("parseBrCode — o código real", () => {
  it("é válido e lê os campos certos", () => {
    const r = parseBrCode(CODIGO_REAL);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code.key).toBe(CHAVE);
    expect(r.code.amountCents).toBe(8900);
    expect(r.code.txid).toBe("GLTECH3D");
  });

  it("aceita quebras de linha e espaços que vêm ao copiar do app do banco", () => {
    const sujo = `  ${CODIGO_REAL.slice(0, 40)}\n${CODIGO_REAL.slice(40)}  `;
    expect(parseBrCode(sujo).ok).toBe(true);
  });
});

describe("parseBrCode — códigos quebrados", () => {
  it("um caractere a menos derruba o CRC", () => {
    const r = parseBrCode(CODIGO_REAL.replace("GLTECH3D", "GLTECH3"));
    expect(r.ok).toBe(false);
  });

  it("um caractere trocado derruba o CRC", () => {
    const r = parseBrCode(CODIGO_REAL.replace("89.00", "88.00"));
    expect(r).toEqual({ ok: false, reason: "bad_crc" });
  });

  it.each(["", "   ", null, undefined])("vazio: %s", (v) => {
    expect(parseBrCode(v)).toEqual({ ok: false, reason: "empty" });
  });

  it("texto que não é BR Code", () => {
    expect(parseBrCode("isto nao e um pix").ok).toBe(false);
  });
});

describe("checkCopiaECola", () => {
  it("o código real casa com o preço atual do plano", () => {
    const r = checkCopiaECola(CODIGO_REAL, { amountCents: PRO_PLANS.pro.amountCents, key: CHAVE });
    expect(r.usable).toBe(true);
  });

  /**
   * O caso que esta validação existe para pegar: o preço muda em
   * `pro-plans.ts`, o código continua o antigo, e o site passaria a cobrar o
   * valor velho sem ninguém notar — porque o código segue válido para o banco.
   */
  it("esconde o copia-e-cola quando o preço do plano mudou", () => {
    const r = checkCopiaECola(CODIGO_REAL, { amountCents: 9900, key: CHAVE });
    expect(r).toEqual({ usable: false, reason: "amount_mismatch" });
  });

  it("esconde quando o código é de outra chave Pix", () => {
    const r = checkCopiaECola(CODIGO_REAL, { amountCents: 8900, key: "outra@chave.com" });
    expect(r).toEqual({ usable: false, reason: "key_mismatch" });
  });

  it("aceita código sem valor fixo (a pessoa digita o valor no banco)", () => {
    const semValor = (() => {
      const base = CODIGO_REAL.slice(0, -4).replace("540589.00", "");
      return base + crc16(base);
    })();
    const r = checkCopiaECola(semValor, { amountCents: 8900, key: CHAVE });
    expect(r.usable).toBe(true);
    if (r.usable) expect(r.code.amountCents).toBeNull();
  });

  it("valor reescrito com CRC recalculado é lido corretamente", () => {
    const r = parseBrCode(comValor("99.90"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.code.amountCents).toBe(9990);
  });

  it("código corrompido nunca é mostrado", () => {
    const r = checkCopiaECola(CODIGO_REAL.slice(0, -1), { amountCents: 8900 });
    expect(r.usable).toBe(false);
  });
});
