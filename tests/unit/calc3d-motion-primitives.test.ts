import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { NumberTicker } from "@/components/calc3d/NumberTicker";
import { MotionTabs } from "@/components/calc3d/MotionTabs";

describe("Calc3D Motion Control Primitives", () => {
  it("renders NumberTicker with initial value and currency formatting", () => {
    const { container } = render(
      React.createElement(NumberTicker, { value: 17.96, prefix: "R$ " })
    );

    expect(container).toBeDefined();
    expect(screen.getByText(/R\$/i)).toBeDefined();
    expect(screen.getByText(/17/i)).toBeDefined();
  });

  it("renders MotionTabs with provided presets and highlights active tab", () => {
    const presets = [
      { id: "chaveiro", label: "Chaveiro", description: "Peça rápida" },
      { id: "miniatura", label: "Miniatura", description: "Alta resolução" },
    ];

    render(
      React.createElement(MotionTabs, {
        tabs: presets,
        activeTab: "chaveiro",
        onSelect: () => {},
      })
    );

    const activeBtn = screen.getByRole("button", { name: /Chaveiro/i });
    expect(activeBtn).toBeDefined();
    expect(activeBtn.getAttribute("data-active")).toBe("true");

    const inactiveBtn = screen.getByRole("button", { name: /Miniatura/i });
    expect(inactiveBtn).toBeDefined();
    expect(inactiveBtn.getAttribute("data-active")).toBe("false");
  });
});
