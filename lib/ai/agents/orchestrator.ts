/**
 * FarmOrchestratorAgent Tool Calling Module
 *
 * Ranks machines by nozzle size, enclosure capabilities, multi-material support,
 * and build volume constraints, then dispatches production jobs.
 */

export interface MachineSpec {
  id: string;
  name: string;
  model: string;
  nozzle_diameter_mm: number;
  has_enclosure: boolean;
  has_multi_material: boolean;
  status: "idle" | "printing" | "maintenance" | "error" | "offline";
  build_volume: { x: number; y: number; z: number };
}

export interface MatchCriteria {
  required_polymer: string;
  required_nozzle_diameter: number;
  requires_enclosure: boolean;
  is_multi_material: boolean;
  build_volume_required_mm: { x: number; y: number; z: number };
}

export function matchOptimalMachine(farm: MachineSpec[], criteria: MatchCriteria): MachineSpec | null {
  const polymerUpper = criteria.required_polymer.toUpperCase();
  const needsEnclosure = criteria.requires_enclosure || ["ABS", "ASA", "PA", "CF", "NYLON"].some((p) => polymerUpper.includes(p));

  const eligible = farm.filter((m) => {
    if (m.status === "offline" || m.status === "error" || m.status === "maintenance") return false;
    if (Math.abs(m.nozzle_diameter_mm - criteria.required_nozzle_diameter) > 0.05) return false;
    if (needsEnclosure && !m.has_enclosure) return false;
    if (criteria.is_multi_material && !m.has_multi_material) return false;

    if (
      criteria.build_volume_required_mm.x > m.build_volume.x ||
      criteria.build_volume_required_mm.y > m.build_volume.y ||
      criteria.build_volume_required_mm.z > m.build_volume.z
    ) {
      return false;
    }

    return true;
  });

  if (eligible.length === 0) return null;

  // Rank idle machines first
  eligible.sort((a, b) => {
    if (a.status === "idle" && b.status !== "idle") return -1;
    if (a.status !== "idle" && b.status === "idle") return 1;
    return 0;
  });

  return eligible[0];
}

export interface DispatchJobParams {
  order_item_id: string;
  target_machine_id: string;
  target_spool_id: string;
  gcode_file_url: string;
  priority_score: number;
}

export function dispatchProductionJob(params: DispatchJobParams) {
  return {
    ok: true as const,
    job: {
      id: "job-" + crypto.randomUUID().slice(0, 8),
      order_item_id: params.order_item_id,
      machine_id: params.target_machine_id,
      spool_id: params.target_spool_id,
      gcode_file_url: params.gcode_file_url,
      priority: Math.max(1, Math.min(5, params.priority_score)),
      allocated_agent: "FarmOrchestratorAgent",
      status: "allocated" as const,
      dispatched_at: new Date().toISOString(),
    },
  };
}
