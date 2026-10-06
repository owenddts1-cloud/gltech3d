/**
 * Maps an agent-run realtime signal to a FIXED pt-BR toast.
 *
 * The signal arrives on a public channel (anyone who knows the org id can
 * publish), so nothing from the payload is ever interpolated into UI text:
 * `kind` and `status` are matched against closed enums and anything unknown
 * yields no toast.
 */
import type { RealtimeBroadcastPayload } from "@/lib/realtime/channels";

export type RunToastLevel = "info" | "success" | "error";

export interface RunToast {
  level: RunToastLevel;
  text: string;
}

// A Map, not an object literal: `obj["constructor"]` would hit the prototype.
const FAILED_STATUS_TEXT: ReadonlyMap<string, string> = new Map([
  ["failed", "Execução falhou."],
  ["aborted", "Execução abortada."],
  ["timeout", "Execução excedeu o tempo limite."],
]);

export function runToastFor(
  payload: Pick<RealtimeBroadcastPayload, "kind" | "status" | "is_dry_run">,
): RunToast | null {
  if (payload.is_dry_run) return null;
  switch (payload.kind) {
    case "run.started":
      return { level: "info", text: "Nova execução iniciada." };
    case "run.completed":
      return { level: "success", text: "Execução concluída." };
    case "run.failed": {
      const text = payload.status ? FAILED_STATUS_TEXT.get(payload.status) : undefined;
      return { level: "error", text: text ?? "Execução falhou." };
    }
    default:
      return null;
  }
}
