import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShopeeStatusCard } from "./ShopeeStatusCard";

/**
 * There is no Shopee integration code. Whatever the env says, the card must not
 * promise automatic sync nor ask the paying customer to edit env vars.
 */
describe("ShopeeStatusCard", () => {
  for (const configured of [true, false]) {
    it(`never promises automatic sync (configured=${configured})`, () => {
      const { container } = render(<ShopeeStatusCard configured={configured} />);
      const text = container.textContent ?? "";
      expect(screen.getByText(/registradas manualmente/i)).toBeInTheDocument();
      expect(text).toMatch(/planejada/i);
      expect(text).not.toMatch(/sincronizad[oa]s? automaticamente/i);
      expect(text).not.toMatch(/SHOPEE_PARTNER/);
    });
  }

  it("mentions the provided credentials only when configured", () => {
    const { rerender } = render(<ShopeeStatusCard configured />);
    expect(screen.getByText(/credenciais da Shopee já foram informadas/i)).toBeInTheDocument();
    rerender(<ShopeeStatusCard configured={false} />);
    expect(screen.queryByText(/credenciais da Shopee já foram informadas/i)).not.toBeInTheDocument();
  });
});
