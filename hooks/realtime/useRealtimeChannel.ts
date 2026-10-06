"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { subscribeBroadcast } from "@/hooks/realtime/broadcast-registry";

export type RealtimeStatus =
  | "connecting"
  | "subscribed"
  | "channel_error"
  | "timed_out"
  | "closed";

/** Poll interval when the channel is NOT delivering (joining, error, closed). */
export const REALTIME_FALLBACK_POLL_MS = 30_000;
/**
 * Slow heartbeat while subscribed: a broadcast the server failed to send
 * (it never retries — see lib/realtime/broadcast.ts) is still reconciled.
 */
export const REALTIME_HEARTBEAT_POLL_MS = 120_000;

/** React Query `refetchInterval` for a list kept fresh by a realtime channel. */
export function realtimeRefetchInterval(status: RealtimeStatus): number {
  return status === "subscribed" ? REALTIME_HEARTBEAT_POLL_MS : REALTIME_FALLBACK_POLL_MS;
}

export interface UseRealtimeChannelOpts {
  name: string;
  postgresChanges?: {
    event: "INSERT" | "UPDATE" | "DELETE" | "*";
    schema?: string;
    table: string;
    filter?: string;
  };
  broadcast?: { event: string };
  onChange: (payload: unknown) => void;
  enabled?: boolean;
}

export function useRealtimeChannel(opts: UseRealtimeChannelOpts): { status: RealtimeStatus } {
  const { name, postgresChanges, broadcast, onChange, enabled = true } = opts;

  // ref makes onChange identity-stable so changing handler doesn't re-subscribe
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [status, setStatus] = useState<RealtimeStatus>(enabled ? "connecting" : "closed");

  // React 19 strict mode mounts effects twice in dev. If two consumers ever
  // share the same logical channel name (or the same component re-mounts),
  // Supabase reuses the existing channel object — calling `.on()` after the
  // prior `.subscribe()` errors out. Append a stable per-instance suffix so
  // every hook call owns its own channel topology.
  const instanceId = useId();

  // Broadcast-only subscriptions join the EXACT topic the server sends to
  // (`lib/realtime/broadcast.ts`), through a ref-counted registry so several
  // hook instances on one topic share a single channel.
  const broadcastOnly = !!broadcast && !postgresChanges;

  useEffect(() => {
    if (!broadcastOnly || !broadcast) return;
    if (!enabled) {
      setStatus("closed");
      return;
    }
    return subscribeBroadcast(
      name,
      broadcast.event,
      (message) => onChangeRef.current(message),
      setStatus,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcastOnly, name, enabled, broadcast?.event]);

  useEffect(() => {
    if (broadcastOnly) return;
    if (!enabled) {
      setStatus("closed");
      return;
    }
    const supabase = createClient();
    const channelName = `${name}::${instanceId}`;
    let channel: RealtimeChannel | null = supabase.channel(channelName);

    const handler = (payload: unknown) => {
      onChangeRef.current(payload);
    };

    if (postgresChanges) {
      channel = channel.on(
        "postgres_changes",
        {
          event: postgresChanges.event,
          schema: postgresChanges.schema ?? "public",
          table: postgresChanges.table,
          ...(postgresChanges.filter ? { filter: postgresChanges.filter } : {}),
        },
        handler,
      );
    }

    if (broadcast) {
      channel = channel.on("broadcast", { event: broadcast.event }, handler);
    }

    setStatus("connecting");
    channel.subscribe((s) => {
      // s is one of "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED"
      const map: Record<string, RealtimeStatus> = {
        SUBSCRIBED: "subscribed",
        CHANNEL_ERROR: "channel_error",
        TIMED_OUT: "timed_out",
        CLOSED: "closed",
      };
      setStatus(map[s] ?? "connecting");
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };
    // intentionally omit onChange (ref); only re-subscribe when channel topology changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcastOnly, name, enabled, instanceId, postgresChanges?.event, postgresChanges?.table, postgresChanges?.filter, postgresChanges?.schema, broadcast?.event]);

  return { status };
}
