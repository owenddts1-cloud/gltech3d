/**
 * Normaliza o status ao vivo de uma impressora 3D lido por IP, a partir de dois firmwares:
 *  - Moonraker (Klipper): GET <url>/printer/objects/query?extruder&heater_bed&print_stats&display_status
 *  - OctoPrint:           GET <url>/api/printer  +  GET <url>/api/job   (header X-Api-Key)
 *
 * As funções de parse são PURAS (recebem o JSON já baixado) para serem testáveis sem rede.
 * O fetch (server-side ou pelo navegador) só chama estas funções com o payload.
 */

export type PrinterLiveState = "printing" | "paused" | "idle" | "error" | "offline";

export interface LiveStatus {
  reachable: boolean;
  state: PrinterLiveState;
  /** °C (actual). null se indisponível. */
  nozzleTemp: number | null;
  bedTemp: number | null;
  /** 0..100. null se indisponível. */
  progress: number | null;
  filename: string | null;
  source: "moonraker" | "octoprint" | null;
}

export const OFFLINE_STATUS: LiveStatus = {
  reachable: false, state: "offline", nozzleTemp: null, bedTemp: null, progress: null, filename: null, source: null,
};

// ── Acessores defensivos (o JSON vem de firmware externo, não confiável) ──
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const numOrNull = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const round1 = (n: number | null): number | null => (n == null ? null : Math.round(n * 10) / 10);

/** Normaliza o nome de arquivo (tira caminho). */
function baseName(name: string | null): string | null {
  if (!name) return null;
  const parts = name.split(/[\\/]/);
  return parts[parts.length - 1] || name;
}

/** Moonraker `/printer/objects/query` → LiveStatus. */
export function parseMoonraker(json: unknown): LiveStatus {
  const status = obj(obj(obj(json).result).status);
  const extruder = obj(status.extruder);
  const bed = obj(status.heater_bed);
  const printStats = obj(status.print_stats);
  const display = obj(status.display_status);

  const rawState = strOrNull(printStats.state)?.toLowerCase() ?? "";
  const state: PrinterLiveState =
    rawState === "printing" ? "printing" :
    rawState === "paused" ? "paused" :
    rawState === "error" ? "error" :
    "idle"; // complete / standby / cancelled / ready → ociosa

  // progress: display_status.progress (0..1) tem prioridade; senão print_stats não traz %.
  const prog = numOrNull(display.progress);

  return {
    reachable: true,
    state,
    nozzleTemp: round1(numOrNull(extruder.temperature)),
    bedTemp: round1(numOrNull(bed.temperature)),
    progress: prog == null ? null : Math.round(Math.max(0, Math.min(1, prog)) * 100),
    filename: baseName(strOrNull(printStats.filename)),
    source: "moonraker",
  };
}

/** OctoPrint `/api/printer` + `/api/job` → LiveStatus. */
export function parseOctoPrint(printerJson: unknown, jobJson: unknown): LiveStatus {
  const temp = obj(obj(printerJson).temperature);
  const tool0 = obj(temp.tool0);
  const bed = obj(temp.bed);
  const flags = obj(obj(obj(printerJson).state).flags);

  const state: PrinterLiveState =
    flags.printing === true ? "printing" :
    flags.paused === true ? "paused" :
    flags.error === true ? "error" :
    "idle"; // operational / ready → ociosa

  const progress = numOrNull(obj(obj(jobJson).progress).completion); // já 0..100
  const filename = strOrNull(obj(obj(obj(jobJson).job).file).name);

  return {
    reachable: true,
    state,
    nozzleTemp: round1(numOrNull(tool0.actual)),
    bedTemp: round1(numOrNull(bed.actual)),
    progress: progress == null ? null : Math.round(Math.max(0, Math.min(100, progress))),
    filename: baseName(filename),
    source: "octoprint",
  };
}

/** Mapeia o estado ao vivo para o `status` persistido da impressora (enum do banco). */
export function liveStateToPrinterStatus(state: PrinterLiveState): "idle" | "printing" | "error" | "offline" {
  if (state === "printing" || state === "paused") return "printing";
  if (state === "error") return "error";
  if (state === "offline") return "offline";
  return "idle";
}
