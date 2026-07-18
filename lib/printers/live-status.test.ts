import { describe, it, expect } from "vitest";
import { parseMoonraker, parseOctoPrint, liveStateToPrinterStatus } from "./live-status";

describe("parseMoonraker", () => {
  it("lê temperaturas, estado imprimindo, progresso e nome do arquivo", () => {
    const s = parseMoonraker({
      result: { status: {
        extruder: { temperature: 214.6, target: 215 },
        heater_bed: { temperature: 59.8, target: 60 },
        print_stats: { state: "printing", filename: "gcodes/GL_Rocket.gcode" },
        display_status: { progress: 0.42 },
      } },
    });
    expect(s).toEqual({
      reachable: true, state: "printing", nozzleTemp: 214.6, bedTemp: 59.8,
      progress: 42, filename: "GL_Rocket.gcode", source: "moonraker",
    });
  });

  it("mapeia standby/complete para ociosa e tolera campos ausentes", () => {
    const s = parseMoonraker({ result: { status: { print_stats: { state: "standby" } } } });
    expect(s.state).toBe("idle");
    expect(s.nozzleTemp).toBeNull();
    expect(s.progress).toBeNull();
    expect(s.reachable).toBe(true);
  });

  it("estado 'error' vira error", () => {
    expect(parseMoonraker({ result: { status: { print_stats: { state: "error" } } } }).state).toBe("error");
  });
});

describe("parseOctoPrint", () => {
  it("lê temperaturas, flags e progresso do /api/job", () => {
    const s = parseOctoPrint(
      { temperature: { tool0: { actual: 210.1, target: 210 }, bed: { actual: 55.2, target: 55 } }, state: { flags: { printing: true } } },
      { progress: { completion: 73.4 }, job: { file: { name: "peca.gcode" } } },
    );
    expect(s).toEqual({
      reachable: true, state: "printing", nozzleTemp: 210.1, bedTemp: 55.2,
      progress: 73, filename: "peca.gcode", source: "octoprint",
    });
  });

  it("operacional (sem printing/paused) vira ociosa", () => {
    const s = parseOctoPrint({ state: { flags: { operational: true, ready: true } } }, {});
    expect(s.state).toBe("idle");
    expect(s.progress).toBeNull();
  });

  it("paused e error são detectados", () => {
    expect(parseOctoPrint({ state: { flags: { paused: true } } }, {}).state).toBe("paused");
    expect(parseOctoPrint({ state: { flags: { error: true } } }, {}).state).toBe("error");
  });
});

describe("liveStateToPrinterStatus", () => {
  it("mapeia para o enum persistido", () => {
    expect(liveStateToPrinterStatus("printing")).toBe("printing");
    expect(liveStateToPrinterStatus("paused")).toBe("printing");
    expect(liveStateToPrinterStatus("error")).toBe("error");
    expect(liveStateToPrinterStatus("idle")).toBe("idle");
    expect(liveStateToPrinterStatus("offline")).toBe("offline");
  });
});
