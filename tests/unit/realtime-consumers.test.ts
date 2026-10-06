/**
 * Consumer-side hardening for public realtime channels: refetch storms are
 * throttled, and forged agent-run signals can only produce fixed pt-BR toasts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runToastFor } from "@/hooks/ai/run-toast";
import { createKeyedThrottle } from "@/hooks/realtime/throttle";

describe("createKeyedThrottle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the first call now and collapses a burst into one trailing run", () => {
    const t = createKeyedThrottle(2_000);
    const fn = vi.fn();
    for (let i = 0; i < 500; i++) t.run("messages", fn);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2_000);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(10_000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("caps a sustained flood at one run per window", () => {
    const t = createKeyedThrottle(2_000);
    const fn = vi.fn();
    // 10 signals per second for 10 seconds.
    for (let i = 0; i < 100; i++) {
      t.run("board", fn);
      vi.advanceTimersByTime(100);
    }
    vi.advanceTimersByTime(2_000);
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(fn.mock.calls.length).toBeLessThanOrEqual(7);
  });

  it("throttles keys independently", () => {
    const t = createKeyedThrottle(2_000);
    const a = vi.fn();
    const b = vi.fn();
    t.run("a", a);
    t.run("b", b);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("runs again immediately once the window has passed", () => {
    const t = createKeyedThrottle(2_000);
    const fn = vi.fn();
    t.run("k", fn);
    vi.advanceTimersByTime(2_500);
    t.run("k", fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("cancelAll drops pending trailing runs", () => {
    const t = createKeyedThrottle(2_000);
    const fn = vi.fn();
    t.run("k", fn);
    t.run("k", fn);
    t.cancelAll();
    vi.advanceTimersByTime(5_000);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("runToastFor (fixed strings only)", () => {
  it("maps known kinds to fixed pt-BR text", () => {
    expect(runToastFor({ kind: "run.started" })).toEqual({ level: "info", text: "Nova execução iniciada." });
    expect(runToastFor({ kind: "run.completed" })).toEqual({ level: "success", text: "Execução concluída." });
    expect(runToastFor({ kind: "run.failed", status: "aborted" })).toEqual({
      level: "error",
      text: "Execução abortada.",
    });
    expect(runToastFor({ kind: "run.failed", status: "timeout" })?.text).toBe(
      "Execução excedeu o tempo limite.",
    );
  });

  it("never echoes an unknown status", () => {
    const t = runToastFor({ kind: "run.failed", status: "ligue_0800_agora" });
    expect(t).toEqual({ level: "error", text: "Execução falhou." });
    expect(t?.text).not.toContain("0800");
  });

  it("ignores prototype keys as statuses", () => {
    expect(runToastFor({ kind: "run.failed", status: "constructor" })?.text).toBe("Execução falhou.");
    expect(runToastFor({ kind: "run.failed", status: "__proto__" })?.text).toBe("Execução falhou.");
  });

  it("stays silent for dry runs and non-toast kinds", () => {
    expect(runToastFor({ kind: "run.completed", is_dry_run: true })).toBeNull();
    expect(runToastFor({ kind: "run.updated", status: "handoff" })).toBeNull();
    expect(runToastFor({ kind: "message.created" })).toBeNull();
  });
});
