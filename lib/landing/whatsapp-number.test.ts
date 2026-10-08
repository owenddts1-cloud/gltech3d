import { describe, expect, it } from "vitest";
import {
  STORE_WHATSAPP_FALLBACK,
  formatWhatsappDisplay,
  storeWhatsappUrl,
  whatsappDigitsFrom,
} from "./whatsapp-number";

describe("whatsappDigitsFrom", () => {
  it.each([
    ["https://wa.me/5531999284834", "5531999284834"],
    ["https://wa.me/5531999284834?text=oi", "5531999284834"],
    ["https://api.whatsapp.com/send?phone=5531999284834&text=oi", "5531999284834"],
    ["(31) 99928-4834", "5531999284834"],
    ["+55 31 99928-4834", "5531999284834"],
    ["https://wa.me/31999284834", "5531999284834"],
  ])("%s -> %s", (raw, expected) => {
    expect(whatsappDigitsFrom(raw)).toBe(expected);
  });

  it("returns null for empty input or a non-WhatsApp URL", () => {
    expect(whatsappDigitsFrom("")).toBeNull();
    expect(whatsappDigitsFrom(null)).toBeNull();
    expect(whatsappDigitsFrom("https://linktr.ee/gltech3d")).toBeNull();
    expect(whatsappDigitsFrom("123")).toBeNull();
  });
});

describe("storeWhatsappUrl / formatWhatsappDisplay", () => {
  it("encodes the message", () => {
    expect(storeWhatsappUrl("5531999284834", "Olá & tchau?")).toBe(
      "https://wa.me/5531999284834?text=Ol%C3%A1%20%26%20tchau%3F",
    );
    expect(storeWhatsappUrl("5531999284834")).toBe("https://wa.me/5531999284834");
  });

  it("formats Brazilian numbers and falls back to +digits", () => {
    expect(formatWhatsappDisplay(STORE_WHATSAPP_FALLBACK)).toBe("(31) 99928-4834");
    expect(formatWhatsappDisplay("553133334444")).toBe("(31) 3333-4444");
    expect(formatWhatsappDisplay("14155550100")).toBe("+14155550100");
  });
});
