import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  calculateLiveCmv,
  Step3LiveCmv,
} from "@/app/app/(pro)/calculator/_components/Step3LiveCmv";
import {
  calculateBatchFeasibility,
  Step4BatchFeasibility,
} from "@/app/app/(pro)/calculator/_components/Step4BatchFeasibility";
import type { SlicedFilamentInfo } from "@/lib/slicer/3d-file-parser";

describe("Calc3D Wizard Steps 3 & 4", () => {
  const filaments: SlicedFilamentInfo[] = [
    { name: "PLA Branco", colorHex: "#FFFFFF", material: "PLA", weightGrams: 100, usedMeters: 33 },
  ];
  const stockMap: Record<number, { costPerGram: number }> = {
    0: { costPerGram: 0.12 }, // R$ 120/kg
  };

  describe("calculateLiveCmv", () => {
    it("computes materials, machine, finishing costs and markup", () => {
      const result = calculateLiveCmv({
        filaments,
        stockMap,
        printHours: 4,
        powerDrawW: 350,
        energyTariff: 1.0, // R$ 1,00 por kWh -> 0.35 * 1.0 = 0.35 R$/h
        depreciationPerHour: 1.5,
        maintenancePerHour: 0.65, // total machine = 0.35 + 1.50 + 0.65 = 2.50 R$/h * 4h = 10.00
        manualHours: 0.5,
        manualRatePerHour: 20.0, // finishing = 10.00
        markup: 2.0,
      });

      // Material: 100g * 0.12 = 12.00
      expect(result.materialCost).toBe(12.0);
      // Machine: 4h * (0.35 + 1.5 + 0.65) = 4 * 2.50 = 10.00
      expect(result.machineCost).toBe(10.0);
      // Finishing: 0.5h * 20 = 10.00
      expect(result.finishingCost).toBe(10.0);
      // Total CMV: 12 + 10 + 10 = 32.00
      expect(result.totalCmv).toBe(32.0);
      // Suggested Price (2.0x): 64.00
      expect(result.suggestedPrice).toBe(64.0);
      // Unit Profit: 32.00
      expect(result.unitProfit).toBe(32.0);
      // Profit per Machine Hour: 32 / 4 = 8.00 R$/h
      expect(result.profitPerHour).toBe(8.0);
    });
  });

  describe("calculateBatchFeasibility", () => {
    it("projects batch requirements, time and material deficit", () => {
      const feasibility = calculateBatchFeasibility({
        quantity: 20,
        weightGramsPerPiece: 100,
        printHoursPerPiece: 4,
        unitCmv: 32.0,
        unitPrice: 64.0,
        stockAvailableGrams: 1500, // 1.5kg disponível (precisa de 2000g = 2.0kg)
        costPerGram: 0.12,
        activePrintersCount: 2,
        dailyOperatingHours: 16,
      });

      // Total weight: 20 * 100 = 2000g (2.0kg)
      expect(feasibility.totalWeightKg).toBe(2.0);
      // Deficit: 2000 - 1500 = 500g (0.5kg)
      expect(feasibility.deficitGrams).toBe(500);
      expect(feasibility.deficitCost).toBe(60.0); // 500g * 0.12
      expect(feasibility.stockSufficient).toBe(false);

      // Total machine hours: 20 * 4 = 80 hours
      expect(feasibility.totalHours).toBe(80);
      // Days with 2 printers @ 16h/day = 32h/day -> 80 / 32 = 2.5 days (ceil 3 days)
      expect(feasibility.totalDays).toBe(3);

      // Batch Financials
      expect(feasibility.totalRevenue).toBe(1280.0);
      expect(feasibility.totalProfit).toBe(640.0);
    });
  });

  describe("Step3LiveCmv UI Component", () => {
    it("renders CMV and markup selectors", () => {
      render(
        React.createElement(Step3LiveCmv, {
          filaments,
          stockMap,
          printHours: 4,
          onNext: () => {},
          onBack: () => {},
        })
      );

      expect(screen.getByText(/ETAPA 3 \/ 4/i)).toBeDefined();
      expect(screen.getByText(/CMV Total/i)).toBeDefined();
      expect(screen.getByText(/Preço Sugerido \(Unitário\)/i)).toBeDefined();
      expect(screen.getByText(/Lucro por Hora/i)).toBeDefined();
      expect(screen.getByRole("button", { name: /2\.0x/i })).toBeDefined();
    });
  });

  describe("Step4BatchFeasibility UI Component", () => {
    it("renders batch simulator and action buttons", () => {
      render(
        React.createElement(Step4BatchFeasibility, {
          unitWeightGrams: 100,
          unitPrintHours: 4,
          unitCmv: 32.0,
          unitPrice: 64.0,
          costPerGram: 0.12,
          stockAvailableGrams: 2500,
          activePrintersCount: 2,
          onBack: () => {},
          onSaveProposal: async () => {},
          onCreateServiceOrder: async () => {},
        })
      );

      expect(screen.getByText(/ETAPA 4 \/ 4/i)).toBeDefined();
      expect(screen.getByText(/Viabilidade em Lote/i)).toBeDefined();
      expect(screen.getByText(/Salvar como Proposta/i)).toBeDefined();
      expect(screen.getByText(/Emitir Ordem de Serviço/i)).toBeDefined();
      expect(screen.getByText(/Gerar PDF com a sua Marca/i)).toBeDefined();
    });
  });
});
