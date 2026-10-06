"use client";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  realtimeRefetchInterval,
  useRealtimeChannel,
} from "@/hooks/realtime/useRealtimeChannel";
import { useOptionalActiveOrg } from "@/hooks/auth/AuthProvider";
import { useThrottledInvalidate } from "@/hooks/realtime/throttle";
import { readBroadcastPayload, safeOrgChannel } from "@/lib/realtime/channels";
import { apiClient } from "@/lib/api/client";
import type { BoardData } from "@/lib/kanban/types";

/**
 * Fetch board via API route (NOT direct supabase-js).
 *
 * Why: the auth cookie `sb-deskcomm-auth` is httpOnly so the browser Supabase
 * client cannot read it — auth.uid() ends up null, RLS hides the pipeline,
 * and PostgREST returns PGRST116. Routing through /api/v1/pipelines/[id]/board
 * uses the server-side cookie reader, identical to every other authed query.
 */
async function fetchBoard(pipelineId: string): Promise<BoardData> {
  const res = await apiClient.get<{ data: BoardData }>(
    `/api/v1/pipelines/${pipelineId}/board`,
  );
  // apiClient unwraps { data, meta } envelope already in some helpers;
  // ours returns the parsed JSON literally. Handle both shapes safely.
  if (res && typeof res === "object" && "data" in res) {
    return (res as { data: BoardData }).data;
  }
  return res as unknown as BoardData;
}

/**
 * Realtime = server broadcast on `org:<orgId>:leads` (ids-only, carries
 * pipeline_id) — `postgres_changes` cannot work because the browser client has
 * no session (httpOnly cookie). Signals for other pipelines are ignored.
 */
export function useBoard(pipelineId: string | null) {
  const channel = safeOrgChannel(useOptionalActiveOrg()?.orgId, "leads");

  const invalidate = useThrottledInvalidate();
  const onChange = useCallback(
    (message: unknown) => {
      const payload = readBroadcastPayload(message);
      if (!pipelineId || !payload) return;
      // A signal without pipeline_id (e.g. bulk across pipelines) still refreshes.
      if (payload.pipeline_id && payload.pipeline_id !== pipelineId) return;
      // Optimistic patches arrive faster via useMoveCard's onMutate; this just
      // reconciles cross-user changes.
      invalidate(["board", pipelineId]);
    },
    [invalidate, pipelineId],
  );

  const { status } = useRealtimeChannel({
    name: channel ?? "kanban-disabled",
    broadcast: { event: "*" },
    onChange,
    enabled: !!channel && !!pipelineId,
  });

  const query = useQuery({
    queryKey: ["board", pipelineId] as const,
    queryFn: () => fetchBoard(pipelineId as string),
    enabled: !!pipelineId,
    refetchInterval: realtimeRefetchInterval(status),
  });

  return query;
}
