/**
 * FarmOrchestratorAgent Tool Calling Module
 *
 * Ranks machines by nozzle size, enclosure capabilities, multi-material support,
 * loaded spool compatibility, bed geometry, and schedules jobs with urgent priority handling.
 */

export interface MachineSpec {
  id: string;
  name: string;
  model: string;
  technology?: "FDM" | "Resina" | "SLA" | "SLS";
  extrusion_type?: "single_nozzle" | "multi_material" | "dual_extruder" | "toolchanger" | "resin_vat";
  nozzle_diameter_mm: number;
  has_enclosure: boolean;
  has_multi_material: boolean;
  status: "idle" | "preheating" | "printing" | "paused" | "maintenance" | "error" | "offline";
  build_volume: { x: number; y: number; z: number };
  loaded_spool_id?: string | null;
  loaded_material?: string;
  loaded_color?: string;
}

export interface MatchCriteria {
  required_polymer: string;
  required_color?: string;
  preferred_spool_id?: string;
  required_nozzle_diameter: number;
  requires_enclosure?: boolean;
  is_multi_material?: boolean;
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

  // Score eligible machines
  const scored = eligible.map((m) => {
    let score = 0;
    if (m.status === "idle") score += 100;

    // Loaded spool bonus (avoids manual intervention & purging)
    if (criteria.preferred_spool_id && m.loaded_spool_id === criteria.preferred_spool_id) {
      score += 50;
    } else if (m.loaded_material && m.loaded_material.toUpperCase() === polymerUpper) {
      score += 30;
      if (criteria.required_color && m.loaded_color && m.loaded_color.toLowerCase() === criteria.required_color.toLowerCase()) {
        score += 20;
      }
    }

    // Tightest fit for bed size (preserve larger beds for larger parts)
    const bedVolume = m.build_volume.x * m.build_volume.y * m.build_volume.z;
    const volumeEfficiency = 1 / Math.max(1, bedVolume);

    return { machine: m, score, volumeEfficiency };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.volumeEfficiency - a.volumeEfficiency;
  });

  return scored[0]?.machine ?? null;
}

export interface QueueJobItem {
  id: string;
  order_id: string;
  priority_level: "urgent" | "normal" | "low";
  priority?: number;
  created_at: string;
  required_material: string;
  required_color?: string;
  required_nozzle_diameter?: number;
  requires_enclosure?: boolean;
  is_multi_material?: boolean;
  estimated_mass_g: number;
  estimated_print_time_hours?: number;
  build_volume_required_mm?: { x: number; y: number; z: number };
}

const PRIORITY_SCORES: Record<string, number> = {
  urgent: 300,
  normal: 100,
  low: 10,
};

export function sortQueueByPriority(jobs: QueueJobItem[]): QueueJobItem[] {
  return [...jobs].sort((a, b) => {
    const scoreA = PRIORITY_SCORES[a.priority_level] ?? 100;
    const scoreB = PRIORITY_SCORES[b.priority_level] ?? 100;

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    // FIFO tie-breaker for same priority level
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export interface AllocationResult {
  allocated: { job: QueueJobItem; machine: MachineSpec }[];
  unallocated: QueueJobItem[];
}

export function allocateNextQueueJob(queue: QueueJobItem[], farm: MachineSpec[]): AllocationResult {
  const sortedQueue = sortQueueByPriority(queue);
  const allocated: { job: QueueJobItem; machine: MachineSpec }[] = [];
  const unallocated: QueueJobItem[] = [];

  // Working copy of idle machines
  const availableMachines = [...farm.filter((m) => m.status === "idle")];

  for (const job of sortedQueue) {
    const criteria: MatchCriteria = {
      required_polymer: job.required_material,
      required_color: job.required_color,
      required_nozzle_diameter: job.required_nozzle_diameter ?? 0.4,
      requires_enclosure: job.requires_enclosure,
      is_multi_material: job.is_multi_material,
      build_volume_required_mm: job.build_volume_required_mm ?? { x: 100, y: 100, z: 100 },
    };

    const matched = matchOptimalMachine(availableMachines, criteria);
    if (matched) {
      allocated.push({ job, machine: matched });
      const idx = availableMachines.findIndex((m) => m.id === matched.id);
      if (idx !== -1) availableMachines.splice(idx, 1);
    } else {
      unallocated.push(job);
    }
  }

  return { allocated, unallocated };
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
