"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  realtimeRefetchInterval,
  useRealtimeChannel,
} from "@/hooks/realtime/useRealtimeChannel";
import { useOptionalActiveOrg } from "@/hooks/auth/AuthProvider";
import { useThrottledInvalidate } from "@/hooks/realtime/throttle";
import { readBroadcastPayload, safeOrgChannel } from "@/lib/realtime/channels";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import type { Message } from "@/lib/types/messaging";

interface MessagesResponse {
  data: Message[];
  meta?: { cursor?: string | null; has_more?: boolean };
}

/**
 * Thread messages. Realtime = server broadcast on `org:<orgId>:messages`
 * (ids-only; filtered here by conversation_id) — `postgres_changes` cannot
 * work because the browser client has no session (httpOnly cookie).
 */
export function useMessagesRealtime(conversationId: string | null) {
  const queryKey = ["messages", conversationId] as const;
  const channel = safeOrgChannel(useOptionalActiveOrg()?.orgId, "messages");

  const invalidate = useThrottledInvalidate();
  const onChange = useCallback(
    (message: unknown) => {
      const payload = readBroadcastPayload(message);
      if (!conversationId || !payload) return;
      if (payload.conversation_id && payload.conversation_id !== conversationId) return;
      invalidate(["messages", conversationId]);
    },
    [invalidate, conversationId],
  );

  const { status } = useRealtimeChannel({
    name: channel ?? "messages-disabled",
    broadcast: { event: "*" },
    onChange,
    enabled: !!channel && !!conversationId,
  });

  const query = useInfiniteQuery({
    queryKey,
    enabled: !!conversationId,
    refetchInterval: realtimeRefetchInterval(status),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (!conversationId) {
        return { data: [], meta: { has_more: false, cursor: null } } as MessagesResponse;
      }
      const qs = new URLSearchParams();
      if (pageParam) qs.set("cursor", pageParam);
      qs.set("limit", "50");
      try {
        return await apiClient.get<MessagesResponse>(
          `/api/v1/conversations/${conversationId}/messages?${qs.toString()}`,
        );
      } catch (err) {
        showApiError(err);
        throw err;
      }
    },
    getNextPageParam: (last) =>
      last.meta?.has_more && last.meta.cursor ? last.meta.cursor : undefined,
  });

  return query;
}
