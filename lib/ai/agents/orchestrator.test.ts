import { describe, it, expect } from "vitest";
import { matchOptimalMachine, type MachineSpec } from "./orchestrator";

describe("FarmOrchestratorAgent Tool Calling Module", () => {
  const farm: MachineSpec[] = [
    {
      id: "m-bambu-x1c",
      name: "Bambu Lab X1C #1",
      model: "Bambu Lab X1C",
      nozzle_diameter_mm: 0.4,
      has_enclosure: true,
      has_multi_material: true,
      status: "idle",
      build_volume: { x: 256, y: 256, z: 256 },
    },
    {
      id: "m-ender-3",
      name: "Ender 3 V2 #1",
      model: "Ender 3",
      nozzle_diameter_mm: 0.4,
      has_enclosure: false,
      has_multi_material: false,
      status: "idle",
      build_volume: { x: 220, y: 220, z: 250 },
    },
    {
      id: "m-bambu-p1p",
      name: "Bambu Lab P1P #1",
      model: "Bambu Lab P1P",
      nozzle_diameter_mm: 0.6,
      has_enclosure: false,
      has_multi_material: false,
      status: "idle",
      build_volume: { x: 256, y: 256, z: 256 },
    },
  ];

  it("matches enclosure machine for ABS polymer", () => {
    const matched = matchOptimalMachine(farm, {
      required_polymer: "ABS",
      required_nozzle_diameter: 0.4,
      requires_enclosure: true,
      is_multi_material: false,
      build_volume_required_mm: { x: 100, y: 100, z: 100 },
    });

    expect(matched).toBeDefined();
    expect(matched?.id).toBe("m-bambu-x1c");
  });

  it("filters out machines that fail nozzle size or enclosure constraint", () => {
    const matched = matchOptimalMachine(farm, {
      required_polymer: "PLA",
      required_nozzle_diameter: 0.6,
      requires_enclosure: false,
      is_multi_material: false,
      build_volume_required_mm: { x: 100, y: 100, z: 100 },
    });

    expect(matched).toBeDefined();
    expect(matched?.id).toBe("m-bambu-p1p");
  });

  it("returns null if no machine matches build volume requirements", () => {
    const matched = matchOptimalMachine(farm, {
      required_polymer: "PLA",
      required_nozzle_diameter: 0.4,
      requires_enclosure: false,
      is_multi_material: false,
      build_volume_required_mm: { x: 300, y: 300, z: 300 },
    });

    expect(matched).toBeNull();
  });
});
