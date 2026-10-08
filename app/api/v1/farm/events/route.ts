import { NextResponse } from "next/server";
import { dispatchCustomerUpdate } from "@/lib/ai/agents/cx";

// In-memory cache for event idempotency (retains recent processed event keys)
const processedEvents = new Map<string, { timestamp: number; response: any }>();
const MAX_CACHE_SIZE = 1000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function cleanOldEvents() {
  const now = Date.now();
  if (processedEvents.size > MAX_CACHE_SIZE) {
    for (const [key, value] of processedEvents.entries()) {
      if (now - value.timestamp > CACHE_TTL_MS) {
        processedEvents.delete(key);
      }
    }
  }
}

export type FarmEventType =
  | "job_started"
  | "progress_update"
  | "job_finished"
  | "print_error"
  | "filament_runout"
  | "heartbeat";

export interface FarmEventPayload {
  event_id?: string;
  idempotency_key?: string;
  machine_id: string;
  event: FarmEventType;
  job_id?: string;
  order_id?: string;
  progress_pct?: number;
  consumed_mass_g?: number;
  temperature_bed_c?: number;
  temperature_nozzle_c?: number;
  error_code?: string;
  error_message?: string;
  timestamp?: string;
}

export async function POST(req: Request) {
  try {
    const body: FarmEventPayload = await req.json();
    const {
      event_id,
      idempotency_key,
      machine_id,
      event,
      job_id,
      order_id,
      progress_pct,
      consumed_mass_g,
      error_code,
      error_message,
    } = body;

    if (!machine_id || !event) {
      return NextResponse.json(
        { ok: false, error: "Parâmetros obrigatórios ausentes: machine_id e event são necessários." },
        { status: 400 }
      );
    }

    // 1. Idempotency Check
    const uniqueKey = event_id || idempotency_key;
    if (uniqueKey && processedEvents.has(uniqueKey)) {
      const cached = processedEvents.get(uniqueKey)!;
      return NextResponse.json({
        ...cached.response,
        idempotent_replay: true,
      });
    }

    cleanOldEvents();

    let responsePayload: Record<string, any> = {
      ok: true,
      event,
      machine_id,
      job_id: job_id ?? null,
      processed_at: new Date().toISOString(),
    };

    switch (event) {
      case "job_started": {
        responsePayload = {
          ...responsePayload,
          machine_status: "printing",
          job_status: "printing",
          notification: order_id
            ? dispatchCustomerUpdate({
                order_id,
                event_type: "production_started",
              })
            : null,
        };
        break;
      }

      case "progress_update": {
        const pct = typeof progress_pct === "number" ? progress_pct : 0;
        const reached50 = pct >= 50 && pct < 55;

        responsePayload = {
          ...responsePayload,
          progress_pct: pct,
          milestone_50_reached: reached50 || pct >= 50,
          notification:
            reached50 && order_id
              ? dispatchCustomerUpdate({
                  order_id,
                  event_type: "progress_halfway",
                  progress_pct: pct,
                })
              : null,
        };
        break;
      }

      case "job_finished": {
        responsePayload = {
          ...responsePayload,
          machine_status: "idle",
          job_status: "completed",
          consumed_mass_g: consumed_mass_g ?? 0,
          notification: order_id
            ? dispatchCustomerUpdate({
                order_id,
                event_type: "print_finished",
              })
            : null,
        };
        break;
      }

      case "filament_runout": {
        responsePayload = {
          ...responsePayload,
          machine_status: "paused",
          alert: `Filamento esgotado ou sensor de fim de filamento disparado na máquina ${machine_id}.`,
          requires_operator_spool_swap: true,
        };
        break;
      }

      case "print_error": {
        responsePayload = {
          ...responsePayload,
          machine_status: "error",
          job_status: "failed",
          error_code: error_code || "UNKNOWN_HARDWARE_FAULT",
          error_message: error_message || "Erro durante execução da impressão",
        };
        break;
      }

      case "heartbeat": {
        responsePayload = {
          ...responsePayload,
          alive: true,
          last_heartbeat: new Date().toISOString(),
        };
        break;
      }

      default: {
        return NextResponse.json(
          { ok: false, error: `Tipo de evento de farm não suportado: ${event}` },
          { status: 400 }
        );
      }
    }

    if (uniqueKey) {
      processedEvents.set(uniqueKey, {
        timestamp: Date.now(),
        response: responsePayload,
      });
    }

    return NextResponse.json(responsePayload);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Erro interno no processamento de telemetria da farm" },
      { status: 500 }
    );
  }
}
