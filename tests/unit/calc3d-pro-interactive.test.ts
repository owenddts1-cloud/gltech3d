import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { CalculatorBlock } from "@/app/(marketing)/calc3d-pro/_components/CalculatorBlock";

// Mock analytics
vi.mock("@/lib/analytics/track", () => ({
  track: vi.fn(),
}));

describe("Calc3D PRO Public Interactive Block", () => {
  it("renders with laser dropzone and motion tabs integrated", () => {
    const { container } = render(
      React.createElement(CalculatorBlock, {
        defaults: {
          pesoPeca: 50,
          tempoImpressao: 3,
        },
      })
    );

    expect(container).toBeDefined();

    // Verify Dropzone presence
    const dropzonePrompt = screen.getByText(/Arraste o arquivo fatiado/i);
    expect(dropzonePrompt).toBeDefined();

    // Verify Presets presence
    const chaveiroPreset = screen.getByRole("button", { name: /Chaveiro/i });
    expect(chaveiroPreset).toBeDefined();

    // Verify Price Section
    const precoSugeridoHeader = screen.getByText(/Preço sugerido/i);
    expect(precoSugeridoHeader).toBeDefined();

    // Verify CTA Button for PRO Proposal
    const ctaButton = screen.getByText(/Transformar isso em venda no PRO/i);
    expect(ctaButton).toBeDefined();
  });
});
