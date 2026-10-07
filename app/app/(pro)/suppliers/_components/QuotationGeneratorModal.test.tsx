import { describe, it, expect } from "vitest";

function buildQuotationWhatsAppUrl(supplierPhone: string, items: Array<{ name: string; qty: number }>) {
  const cleanPhone = supplierPhone.replace(/\D/g, "");
  const lines = [
    "Olá! Gostaria de solicitar uma cotação de compra para os seguintes insumos:",
    "",
    ...items.map((i) => `• ${i.name} — Qtd: ${i.qty}`),
    "",
    "Pode nos enviar os valores e prazos de entrega? Obrigado!",
  ];
  const message = lines.join("\n");
  const encoded = encodeURIComponent(message);
  return cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

describe("QuotationGeneratorModal WhatsApp Encoding", () => {
  it("formats WhatsApp quotation message with items and phone correctly", () => {
    const url = buildQuotationWhatsAppUrl("+55 11 99999-8888", [
      { name: "PLA Black Premium", qty: 2 },
      { name: "PETG Red 1.75mm", qty: 1 },
    ]);

    expect(url).toContain("https://wa.me/5511999998888?text=");
    expect(url).toContain(encodeURIComponent("• PLA Black Premium — Qtd: 2"));
  });

  it("handles empty phone number gracefully", () => {
    const url = buildQuotationWhatsAppUrl("", [{ name: "PLA Silk Gold", qty: 3 }]);
    expect(url).toBe("https://wa.me/?text=" + encodeURIComponent("Olá! Gostaria de solicitar uma cotação de compra para os seguintes insumos:\n\n• PLA Silk Gold — Qtd: 3\n\nPode nos enviar os valores e prazos de entrega? Obrigado!"));
  });
});
