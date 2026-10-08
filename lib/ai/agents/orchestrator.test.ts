import { describe, it, expect } from "vitest";
import {
  matchOptimalMachine,
  sortQueueByPriority,
  allocateNextQueueJob,
  type MachineSpec,
  type QueueJobItem,
} from "./orchestrator";

describe("FarmOrchestratorAgent Tool Calling Module", () => {
  const farm: MachineSpec[] = [
    {
      id: "m-bambu-x1c",
      name: "Bambu Lab X1C #1",
      model: "Bambu Lab X1C",
      technology: "FDM",
      extrusion_type: "multi_material",
      nozzle_diameter_mm: 0.4,
      has_enclosure: true,
      has_multi_material: true,
      status: "idle",
      build_volume: { x: 256, y: 256, z: 256 },
      loaded_spool_id: "spool-petg-black",
      loaded_material: "PETG",
      loaded_color: "Preto",
    },
    {
      id: "m-ender-3",
      name: "Ender 3 V2 #1",
      model: "Ender 3",
      technology: "FDM",
      extrusion_type: "single_nozzle",
      nozzle_diameter_mm: 0.4,
      has_enclosure: false,
      has_multi_material: false,
      status: "idle",
      build_volume: { x: 220, y: 220, z: 250 },
      loaded_spool_id: "spool-pla-white",
      loaded_material: "PLA",
      loaded_color: "Branco",
    },
    {
      id: "m-bambu-p1p",
      name: "Bambu Lab P1P #1",
      model: "Bambu Lab P1P",
      technology: "FDM",
      extrusion_type: "single_nozzle",
      nozzle_diameter_mm: 0.6,
      has_enclosure: false,
      has_multi_material: false,
      status: "idle",
      build_volume: { x: 256, y: 256, z: 256 },
      loaded_spool_id: null,
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

  it("prioritizes machine with the matching spool or material already loaded", () => {
    // Both Ender 3 and Bambu X1C can print PLA 0.4 without enclosure,
    // but Ender 3 has PLA loaded.
    const matched = matchOptimalMachine(farm, {
      required_polymer: "PLA",
      required_color: "Branco",
      required_nozzle_diameter: 0.4,
      requires_enclosure: false,
      is_multi_material: false,
      build_volume_required_mm: { x: 100, y: 100, z: 100 },
    });

    expect(matched).toBeDefined();
    expect(matched?.id).toBe("m-ender-3");
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

  it("sorts queue putting urgent jobs first (fura-fila inteligente)", () => {
    const queue: QueueJobItem[] = [
      {
        id: "job-1",
        order_id: "ord-1",
        priority_level: "normal",
        created_at: "2026-10-07T10:00:00Z",
        required_material: "PLA",
        estimated_mass_g: 50,
      },
      {
        id: "job-2",
        order_id: "ord-2",
        priority_level: "low",
        created_at: "2026-10-07T09:00:00Z",
        required_material: "PETG",
        estimated_mass_g: 100,
      },
      {
        id: "job-3",
        order_id: "ord-3",
        priority_level: "urgent",
        created_at: "2026-10-07T11:00:00Z",
        required_material: "PETG",
        estimated_mass_g: 200,
      },
    ];

    const sorted = sortQueueByPriority(queue);
    expect(sorted[0]?.id).toBe("job-3"); // Urgent job jumped ahead
    expect(sorted[1]?.id).toBe("job-1"); // Normal job next
    expect(sorted[2]?.id).toBe("job-2"); // Low job last
  });

  it("allocates next jobs to available machines cleanly balancing load", () => {
    const queue: QueueJobItem[] = [
      {
        id: "job-urgent-petg",
        order_id: "ord-1",
        priority_level: "urgent",
        created_at: "2026-10-07T10:00:00Z",
        required_material: "PETG",
        required_nozzle_diameter: 0.4,
        estimated_mass_g: 150,
        build_volume_required_mm: { x: 100, y: 100, z: 100 },
      },
      {
        id: "job-normal-pla",
        order_id: "ord-2",
        priority_level: "normal",
        created_at: "2026-10-07T10:05:00Z",
        required_material: "PLA",
        required_nozzle_diameter: 0.4,
        estimated_mass_g: 80,
        build_volume_required_mm: { x: 100, y: 100, z: 100 },
      },
    ];

    const allocation = allocateNextQueueJob(queue, farm);
    expect(allocation.allocated.length).toBe(2);
    // Urgent PETG assigned to Bambu X1C (which has PETG loaded)
    expect(allocation.allocated[0]?.job.id).toBe("job-urgent-petg");
    expect(allocation.allocated[0]?.machine.id).toBe("m-bambu-x1c");
    // Normal PLA assigned to Ender 3
    expect(allocation.allocated[1]?.job.id).toBe("job-normal-pla");
    expect(allocation.allocated[1]?.machine.id).toBe("m-ender-3");
    expect(allocation.unallocated.length).toBe(0);
  });
});
