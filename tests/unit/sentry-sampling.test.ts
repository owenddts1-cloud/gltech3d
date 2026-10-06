import { describe, expect, it, vi } from "vitest";

import {
  baseTracesSampleRate,
  createTracesSampler,
  isDroppedTransaction,
} from "@/lib/sentry/sampling";

describe("Sentry traces sampling", () => {
  it("samples 10% in production and 100% elsewhere", () => {
    expect(baseTracesSampleRate("production")).toBe(0.1);
    expect(baseTracesSampleRate("development")).toBe(1);
    expect(baseTracesSampleRate("test")).toBe(1);
    expect(createTracesSampler("production")({ name: "GET /app/inbox" })).toBe(0.1);
    expect(createTracesSampler("development")({ name: "GET /app/inbox" })).toBe(1);
  });

  it("never traces the Sentry tunnel or health checks", () => {
    const sample = createTracesSampler("development");
    expect(sample({ name: "POST /monitoring" })).toBe(0);
    expect(sample({ name: "GET /api/v1/health" })).toBe(0);
    expect(sample({ name: "GET /api/health" })).toBe(0);
    expect(sample({ name: "x", normalizedRequest: { url: "https://app.example.com/monitoring?o=1" } })).toBe(0);
    expect(sample({ name: "x", attributes: { "url.path": "/api/v1/health" } })).toBe(0);
    expect(sample({ name: "x", attributes: { "http.target": "/monitoring?o=123&p=456" } })).toBe(0);
    expect(sample({ name: "pageload", location: { pathname: "/monitoring" } })).toBe(0);
  });

  it("does not drop look-alike paths", () => {
    expect(isDroppedTransaction({ name: "GET /api/v1/healthcheck-report" })).toBe(false);
    expect(isDroppedTransaction({ name: "GET /app/monitoring-dashboard" })).toBe(false);
    expect(isDroppedTransaction({ name: "GET /api/v1/health/deep" })).toBe(true);
  });

  it("inherits the incoming trace decision for everything else", () => {
    const inherit = vi.fn().mockReturnValue(1);
    expect(createTracesSampler("production")({ name: "GET /app", inheritOrSampleWith: inherit })).toBe(1);
    expect(inherit).toHaveBeenCalledWith(0.1);
    // ...but a dropped path stays dropped even with a sampled parent.
    expect(
      createTracesSampler("production")({ name: "GET /api/v1/health", inheritOrSampleWith: inherit }),
    ).toBe(0);
  });
});
