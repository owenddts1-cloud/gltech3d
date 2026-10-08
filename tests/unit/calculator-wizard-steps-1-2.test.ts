import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { autoMatchFilament } from "@/app/app/(pro)/calculator/_components/Step2StockLink";
import { Step1XRay } from "@/app/app/(pro)/calculator/_components/Step1XRay";
import { Step2StockLink } from "@/app/app/(pro)/calculator/_components/Step2StockLink";
import type { Parsed3DFile, SlicedFilamentInfo } from "@/lib/slicer/3d-file-parser";

describe("Calc3D Wizard Steps 1 & 2", () => {
  const mockStock = [
    { id: "fil_1", name: "PLA Branco Neve Voolt", color: "Branco", material: "PLA", costPerGram: 0.12 },
    { id: "fil_2", name: "PETG Preto Premium", color: "Preto", material: "PETG", costPerGram: 0.15 },
    { id: "fil_3", name: "ABS Vermelho", color: "Vermelho", material: "ABS", costPerGram: 0.11 },
  ];

  describe("autoMatchFilament", () => {
    it("matches filament by color and material", () => {
      const parsedFilament: SlicedFilamentInfo = {
        name: "PLA Basic White",
        colorHex: "#FFFFFF",
        material: "PLA",
        weightGrams: 85,
        usedMeters: 28.5,
      };

      const matchedId = autoMatchFilament(parsedFilament, mockStock);
      expect(matchedId).toBe("fil_1");
    });

    it("matches filament by material fallback if color is unknown", () => {
      const parsedFilament: SlicedFilamentInfo = {
        name: "PETG Translucent",
        colorHex: "#00000000",
        material: "PETG",
        weightGrams: 40,
        usedMeters: 12,
      };

      const matchedId = autoMatchFilament(parsedFilament, mockStock);
      expect(matchedId).toBe("fil_2");
    });

    it("returns null or first available if no material matches", () => {
      const parsedFilament: SlicedFilamentInfo = {
        name: "Nylon PA12",
        colorHex: "#333333",
        material: "Nylon",
        weightGrams: 50,
        usedMeters: 15,
      };

      const matchedId = autoMatchFilament(parsedFilament, []);
      expect(matchedId).toBeNull();
    });
  });

  describe("Step1XRay Component", () => {
    it("renders project metrics and layer breakdown", () => {
      const mockParsed: Parsed3DFile = {
        format: "3mf",
        fileName: "suporte_articulado.3mf",
        weightGrams: 142.5,
        printTimeMinutes: 245, // ~4h 5m
        plateCount: 2,
        filaments: [
          { name: "PLA Branco", colorHex: "#FFFFFF", material: "PLA", weightGrams: 142.5, usedMeters: 45 },
        ],
        slicerSoftware: "BambuStudio",
      };

      render(
        React.createElement(Step1XRay, {
          parsedData: mockParsed,
          onParsed: () => {},
          onNext: () => {},
        })
      );

      // Verify file name badge
      expect(screen.getByText(/suporte_articulado\.3mf/i)).toBeDefined();

      // Verify 3 key metrics: Massa, Horas de máquina, Placas
      expect(screen.getByText(/142\.5/i)).toBeDefined();
      expect(screen.getByText(/Massa de filamento/i)).toBeDefined();
      expect(screen.getByText(/Tempo estimado/i)).toBeDefined();
      expect(screen.getByText(/Placas \/ Mesas/i)).toBeDefined();
      expect(screen.getByText(/2 mesas/i)).toBeDefined();

      // Verify breakdown legend
      expect(screen.getByText(/Paredes/i)).toBeDefined();
      expect(screen.getByText(/Preenchimento/i)).toBeDefined();
    });
  });

  describe("Step2StockLink Component", () => {
    it("renders 2-column layout with visual matching", () => {
      const parsedFilaments: SlicedFilamentInfo[] = [
        { name: "Extrusor 1 (Branco)", colorHex: "#FFFFFF", material: "PLA", weightGrams: 85, usedMeters: 28 },
      ];

      render(
        React.createElement(Step2StockLink, {
          parsedFilaments,
          stockFilaments: mockStock,
          mappings: { 0: "fil_1" },
          onUpdateMapping: () => {},
          onNext: () => {},
          onBack: () => {},
        })
      );

      expect(screen.getByText(/NO ARQUIVO/i)).toBeDefined();
      expect(screen.getByText(/NO SEU ESTOQUE/i)).toBeDefined();
      expect(screen.getByText(/Extrusor 1 \(Branco\)/i)).toBeDefined();
      expect(screen.getByText(/85g consumidos/i)).toBeDefined();
    });
  });
});
