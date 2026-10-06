"use client";
/**
 * useAgentRuns — lista runs de um agent (S-13.12).
 *
 * Compõe TanStack Query (GET /api/v1/ai/agents/:id/runs) com o broadcast do
 * servidor em `org:<orgId>:agent-runs` (lib/realtime/broadcast.ts — payload só
 * com ids + status; filtrado aqui por agent_id). `postgres_changes` não serve:
 * o cliente Supabase do browser não tem sessão (cookie httpOnly). Cada sinal
 * invalida a query e dispara um toast leve. Toggle `realtime` controla
 * subscribe/unsubscribe pra não vazar canais quando a tab Runs não está ativa.
 */
import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { useOptionalActiveOrg } from "@/hooks/auth/AuthProvider";
import { runToastFor } from "@/hooks/ai/run-toast";
import {
  REALTIME_INVALIDATE_INTERVAL_MS,
  createKeyedThrottle,
  useThrottledInvalidate,
} from "@/hooks/realtime/throttle";
import {
  realtimeRefetchInterval,
  useRealtimeChannel,
} from "@/hooks/realtime/useRealtimeChannel";
import { apiClient } from "@/lib/api/client";
import { readBroadcastPayload, safeOrgChannel } from "@/lib/realtime/channels";

export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "aborted"
  | "timeout";

export interface AgentRunRow {
  id: string;
  organization_id: string;
  agent_id: string;
  agent_version_id: string;
  conversation_id: string | null;
  contact_id: string | null;
  channel_session_id: string | null;
  inbound_message_id: string | null;
  outbound_message_id: string | null;
  status: RunStatus;
  abort_reason: string | null;
  error_code: string | null;
  error_message: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_cents: number | null;
  latency_ms: number | null;
  steps_count: number | null;
  tool_calls: unknown;
  is_dry_run: boolean;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

interface ListResponse {
  data: AgentRunRow[];
  meta?: { cursor: string | null; has_more: boolean };
}

export const agentRunsKey = (agentId: string) =>
  ["ai", "agents", agentId, "runs"] as const;

export function useAgentRuns(
  agentId: string,
  opts?: { enabled?: boolean; realtime?: boolean; limit?: number },
) {
  const enabled = opts?.enabled ?? true;
  const realtime = opts?.realtime ?? enabled;
  const limit = opts?.limit ?? 25;
  const channel = safeOrgChannel(useOptionalActiveOrg()?.orgId, "agent-runs");
  const invalidate = useThrottledInvalidate();
  // Toasts are throttled per level too: a flood of (possibly forged) signals
  // on the public channel must not become a flood of toasts.
  const toastThrottle = useMemo(
    () => createKeyedThrottle(REALTIME_INVALIDATE_INTERVAL_MS),
    [],
  );
  useEffect(() => () => toastThrottle.cancelAll(), [toastThrottle]);

  const onChange = useCallback(
    (message: unknown) => {
      const payload = readBroadcastPayload(message);
      if (!payload || (payload.agent_id && payload.agent_id !== agentId)) return;
      invalidate(agentRunsKey(agentId));
      // Only toast for signals explicitly about THIS agent; text is fixed.
      if (payload.agent_id !== agentId) return;
      const t = runToastFor(payload);
      if (!t) return;
      toastThrottle.run(t.level, () => {
        if (t.level === "info") toast.info(t.text);
        else if (t.level === "success") toast.success(t.text);
        else toast.error(t.text);
      });
    },
    [invalidate, toastThrottle, agentId],
  );

  const { status } = useRealtimeChannel({
    name: channel ?? "agent-runs-disabled",
    broadcast: { event: "*" },
    onChange,
    enabled: !!channel && !!agentId && realtime,
  });

  const query = useQuery({
    queryKey: [...agentRunsKey(agentId), limit] as const,
    queryFn: async () => {
      const res = await apiClient.get<ListResponse>(
        `/api/v1/ai/agents/${agentId}/runs?limit=${limit}`,
      );
      return res;
    },
    enabled: !!agentId && enabled,
    refetchInterval: realtime ? realtimeRefetchInterval(status) : false,
  });

  return query;
}
