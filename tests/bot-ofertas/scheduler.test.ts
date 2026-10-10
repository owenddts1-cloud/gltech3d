import { describe, it, expect } from "vitest";
const scheduler = require("../../services/bot_ofertas/src/services/scheduler");

describe("Scheduler Fast Warming & Recycling Mode", () => {
  it("calcula próximo intervalo orgânico entre minInterval e maxInterval em ms", () => {
    for (let i = 0; i < 20; i++) {
      const intervalMs = scheduler.calculateNextIntervalMs(2, 15);
      expect(intervalMs).toBeGreaterThanOrEqual(2 * 60 * 1000);
      expect(intervalMs).toBeLessThanOrEqual(15 * 60 * 1000 + 500);
    }
  });

  it("calcula próximo intervalo com fallback se valores não forem informados", () => {
    const intervalMs = scheduler.calculateNextIntervalMs();
    expect(intervalMs).toBeGreaterThanOrEqual(2 * 60 * 1000);
    expect(intervalMs).toBeLessThanOrEqual(15 * 60 * 1000 + 500);
  });

  it("retorna status detalhado com modo rodízio e janela comercial", () => {
    const status = scheduler.getSchedulerStatus();
    expect(status).toHaveProperty("autoDispatchEnabled");
    expect(status).toHaveProperty("window");
    expect(status).toHaveProperty("minIntervalMinutes");
    expect(status).toHaveProperty("maxIntervalMinutes");
    expect(status).toHaveProperty("recycleMode");
  });
});
