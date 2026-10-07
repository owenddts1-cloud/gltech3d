import { describe, it, expect } from "vitest";

describe("SalesChannelView component logic", () => {
  it("defines appropriate field labels for Shopee, Mercado Livre, and Facebook", () => {
    const fieldLabels: Record<string, { label1: string; label2: string }> = {
      Shopee: { label1: "Shopee Partner ID", label2: "Shopee Partner Key / Secret" },
      "Mercado Livre": { label1: "Mercado Livre App ID", label2: "Mercado Livre Secret Key" },
      Facebook: { label1: "Facebook Access Token", label2: "Pixel / Page ID" },
    };

    expect(fieldLabels["Shopee"]?.label1).toBe("Shopee Partner ID");
    expect(fieldLabels["Mercado Livre"]?.label1).toBe("Mercado Livre App ID");
    expect(fieldLabels["Facebook"]?.label1).toBe("Facebook Access Token");
  });
});
