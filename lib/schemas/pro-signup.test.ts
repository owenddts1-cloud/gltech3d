import { describe, it, expect } from "vitest";
import {
  proSignupRequestSchema,
  receiptSlotSchema,
  safeReceiptFilename,
  RECEIPT_MAX_BYTES,
} from "./pro-signup";

const VALID = {
  buyer_name: "Guilherme Teste",
  buyer_email: "Comprador@Exemplo.COM",
  buyer_phone: "(31) 99999-9999",
  plan: "pro" as const,
  declared_paid: true as const,
  consent: true as const,
};

const UUID_PREFIX = "11111111-1111-4111-8111-111111111111";

describe("proSignupRequestSchema", () => {
  it("aceita o payload mínimo e normaliza o e-mail", () => {
    const r = proSignupRequestSchema.safeParse(VALID);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.buyer_email).toBe("comprador@exemplo.com");
  });

  it("rejeita sem a declaração de pagamento", () => {
    const { declared_paid: _omitted, ...withoutDeclaration } = VALID;
    expect(proSignupRequestSchema.safeParse(withoutDeclaration).success).toBe(false);
  });

  it("rejeita declared_paid=false (checkbox desmarcado não é pedido)", () => {
    expect(proSignupRequestSchema.safeParse({ ...VALID, declared_paid: false }).success).toBe(false);
  });

  it("rejeita sem consentimento", () => {
    const { consent: _omitted, ...withoutConsent } = VALID;
    expect(proSignupRequestSchema.safeParse(withoutConsent).success).toBe(false);
  });

  it("rejeita o honeypot preenchido", () => {
    expect(proSignupRequestSchema.safeParse({ ...VALID, website: "http://spam" }).success).toBe(
      false,
    );
  });

  it("aceita o honeypot vazio", () => {
    expect(proSignupRequestSchema.safeParse({ ...VALID, website: "" }).success).toBe(true);
  });

  it("rejeita chave desconhecida — .strict() impede que algo entre pelo body", () => {
    expect(
      proSignupRequestSchema.safeParse({ ...VALID, organization_id: "qualquer-uuid" }).success,
    ).toBe(false);
  });

  it("não aceita amount_cents: o preço é derivado no servidor", () => {
    expect(proSignupRequestSchema.safeParse({ ...VALID, amount_cents: 1 }).success).toBe(false);
  });

  it("rejeita plano diferente de 'pro'", () => {
    expect(proSignupRequestSchema.safeParse({ ...VALID, plan: "enterprise" }).success).toBe(false);
  });

  it("rejeita e-mail inválido", () => {
    expect(proSignupRequestSchema.safeParse({ ...VALID, buyer_email: "nao-e-email" }).success).toBe(
      false,
    );
  });

  it("rejeita preenchimento instantâneo (robô)", () => {
    expect(proSignupRequestSchema.safeParse({ ...VALID, elapsed_ms: 50 }).success).toBe(false);
  });

  it("aceita receipt_path no formato uuid/arquivo", () => {
    const r = proSignupRequestSchema.safeParse({
      ...VALID,
      receipt_path: `${UUID_PREFIX}/comprovante.pdf`,
    });
    expect(r.success).toBe(true);
  });

  it.each([
    ["path traversal", `${UUID_PREFIX}/../../etc/passwd`],
    ["caminho absoluto", "/etc/passwd"],
    ["sem prefixo uuid", "comprovante.pdf"],
    ["prefixo não-uuid", "qualquer-pasta/comprovante.pdf"],
    ["subpasta extra", `${UUID_PREFIX}/sub/comprovante.pdf`],
  ])("rejeita receipt_path com %s", (_label, receipt_path) => {
    expect(proSignupRequestSchema.safeParse({ ...VALID, receipt_path }).success).toBe(false);
  });
});

describe("receiptSlotSchema", () => {
  it("aceita um PDF dentro do limite", () => {
    const r = receiptSlotSchema.safeParse({
      filename: "comprovante.pdf",
      content_type: "application/pdf",
      size: 1024,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita tipo fora da lista do bucket", () => {
    const r = receiptSlotSchema.safeParse({
      filename: "payload.exe",
      content_type: "application/x-msdownload",
      size: 1024,
    });
    expect(r.success).toBe(false);
  });

  it("rejeita acima de 5 MB", () => {
    const r = receiptSlotSchema.safeParse({
      filename: "grande.png",
      content_type: "image/png",
      size: RECEIPT_MAX_BYTES + 1,
    });
    expect(r.success).toBe(false);
  });
});

describe("safeReceiptFilename", () => {
  it("remove diretórios do nome enviado pelo cliente", () => {
    expect(safeReceiptFilename("../../etc/passwd")).toBe("passwd");
    expect(safeReceiptFilename("C:\\Users\\Gui\\nota.pdf")).toBe("nota.pdf");
  });

  it("remove acentos e caracteres perigosos", () => {
    expect(safeReceiptFilename("comprovante cópia.pdf")).toBe("comprovante copia.pdf");
  });

  it("nunca devolve string vazia", () => {
    expect(safeReceiptFilename("...")).toBe("comprovante");
    expect(safeReceiptFilename("/")).toBe("comprovante");
  });

  it("o resultado sempre casa com o regex aceito pelo schema", () => {
    const path = `${UUID_PREFIX}/${safeReceiptFilename("relatório final!!.pdf")}`;
    expect(proSignupRequestSchema.safeParse({ ...VALID, receipt_path: path }).success).toBe(true);
  });
});
