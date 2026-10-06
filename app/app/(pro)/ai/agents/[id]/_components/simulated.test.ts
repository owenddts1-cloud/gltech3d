import { describe, it, expect } from "vitest";
import { isSimulatedResult, SIMULATED_EXPLANATION } from "./simulated";

describe("isSimulatedResult", () => {
  it("flags the current `simulated` field", () => {
    expect(isSimulatedResult({ simulated: true })).toBe(true);
  });

  it("flags the legacy `stub` field", () => {
    expect(isSimulatedResult({ stub: true })).toBe(true);
  });

  it("does not flag a real run", () => {
    expect(isSimulatedResult({ simulated: false, stub: false })).toBe(false);
    expect(isSimulatedResult({})).toBe(false);
  });

  it("explains the simulation in customer-facing pt-BR", () => {
    expect(SIMULATED_EXPLANATION).toBe(
      "Resposta simulada: o motor de IA ainda não está ativado nesta conta.",
    );
  });
});
