import { describe, it, expect, vi } from "vitest";
import { POST } from "./route";

describe("Farm Telemetry & Events Pipeline (/api/v1/farm/events)", () => {
  it("processes job_started event idempotently", async () => {
    const req = new Request("http://localhost/api/v1/farm/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_id: "evt-001",
        machine_id: "mach-bambu-01",
        event: "job_started",
        job_id: "job-101",
        timestamp: new Date().toISOString(),
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.event).toBe("job_started");
    expect(json.machine_status).toBe("printing");

    // Second call with same event_id should be idempotent
    const retryReq = new Request("http://localhost/api/v1/farm/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_id: "evt-001",
        machine_id: "mach-bambu-01",
        event: "job_started",
        job_id: "job-101",
      }),
    });

    const retryRes = await POST(retryReq);
    const retryJson = await retryRes.json();
    expect(retryRes.status).toBe(200);
    expect(retryJson.idempotent_replay).toBe(true);
  });

  it("processes progress_update and detects 50% milestone", async () => {
    const req = new Request("http://localhost/api/v1/farm/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_id: "evt-002",
        machine_id: "mach-bambu-01",
        event: "progress_update",
        job_id: "job-101",
        progress_pct: 50.2,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.progress_pct).toBe(50.2);
    expect(json.milestone_50_reached).toBe(true);
  });

  it("processes job_finished, returning machine to idle and finalizes spool deduction", async () => {
    const req = new Request("http://localhost/api/v1/farm/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_id: "evt-003",
        machine_id: "mach-bambu-01",
        event: "job_finished",
        job_id: "job-101",
        consumed_mass_g: 145.5,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.machine_status).toBe("idle");
    expect(json.job_status).toBe("completed");
    expect(json.consumed_mass_g).toBe(145.5);
  });

  it("handles filament_runout by pausing machine without dropping connection", async () => {
    const req = new Request("http://localhost/api/v1/farm/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_id: "evt-004",
        machine_id: "mach-bambu-01",
        event: "filament_runout",
        job_id: "job-101",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.machine_status).toBe("paused");
    expect(json.alert).toContain("Filamento esgotado");
  });

  it("handles print_error with resilience", async () => {
    const req = new Request("http://localhost/api/v1/farm/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_id: "evt-005",
        machine_id: "mach-bambu-01",
        event: "print_error",
        job_id: "job-101",
        error_code: "ERR_NOZZLE_CLOG",
        error_message: "Extruder temp dropped or heater failure",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.machine_status).toBe("error");
    expect(json.job_status).toBe("failed");
  });
});
