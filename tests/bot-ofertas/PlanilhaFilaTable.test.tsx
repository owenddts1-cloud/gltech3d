import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PlanilhaFilaTable } from "../../components/bot-ofertas/PlanilhaFilaTable";

describe("PlanilhaFilaTable V2", () => {
  it("renderiza tags de marketplace e filtro de nicho", () => {
    render(
      <PlanilhaFilaTable
        offers={[]}
        onDispatch={async () => {}}
        onDelete={async () => {}}
        onEdit={() => {}}
        onRefresh={async () => {}}
      />,
    );

    expect(screen.getByText("Mercado Livre")).toBeDefined();
    expect(screen.getByText("Shopee")).toBeDefined();
    expect(screen.getByText("Amazon")).toBeDefined();
    expect(screen.getByText("AliExpress")).toBeDefined();
    expect(screen.getByText("TikTok")).toBeDefined();
  });
});
