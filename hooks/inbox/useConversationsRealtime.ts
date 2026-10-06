"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  realtimeRefetchInterval,
  useRealtimeChannel,
} from "@/hooks/realtime/useRealtimeChannel";
import { readBroadcastPayload, safeOrgChannel } from "@/lib/realtime/channels";
import { useThrottledInvalidate } from "@/hooks/realtime/throttle";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import type { Conversation } from "@/lib/types/messaging";

export interface ContactSummary {
  id: string;
  display_name: string | null;
  name: string | null;
  phone_number: string | null;
  tags: string[];
  is_blocked: boolean;
  is_anonymized: boolean;
}

export type ConversationWithContact = Conversation & {
  contacts?: ContactSummary | null;
};

export interface ConversationsFilters {
  status?: "open" | "claimed" | "ai_handling" | "closed" | "archived";
  assigned_to?: "me" | "unassigned" | string;
  search?: string;
  channel_session_id?: string;
}

interface ListResponse {
  data: ConversationWithContact[];
  meta?: { cursor?: string | null; has_more?: boolean };
}

/**
 * Conversation list. Realtime = server broadcast on `org:<orgId>:conversations`
 * (ids-only) — `postgres_changes` cannot work because the browser client has
 * no session (httpOnly cookie). Any signal invalidates the list; a fallback
 * poll covers a channel that is not delivering.
 */
export function useConversationsRealtime(
  filters: ConversationsFilters,
  orgId: string | null,
) {
  const queryKey = ["conversations", filters] as const;
  const channel = safeOrgChannel(orgId, "conversations");

  const invalidate = useThrottledInvalidate();
  const onChange = useCallback(
    (message: unknown) => {
      if (!readBroadcastPayload(message)) return;
      invalidate(["conversations"]);
    },
    [invalidate],
  );

  const { status } = useRealtimeChannel({
    name: channel ?? "inbox-disabled",
    broadcast: { event: "*" },
    onChange,
    enabled: !!channel,
  });

  const query = useInfiniteQuery({
    queryKey,
    refetchInterval: realtimeRefetchInterval(status),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const qs = new URLSearchParams();
      if (filters.status) qs.set("status", filters.status);
      if (filters.assigned_to) qs.set("assigned_to", filters.assigned_to);
      if (filters.search) qs.set("search", filters.search);
      if (filters.channel_session_id) qs.set("channel_session_id", filters.channel_session_id);
      if (pageParam) qs.set("cursor", pageParam);
      qs.set("limit", "50");
      try {
        return await apiClient.get<ListResponse>(`/api/v1/conversations?${qs.toString()}`);
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
