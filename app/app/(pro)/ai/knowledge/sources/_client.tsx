"use client";
import { useCallback } from "react";

import { useOptionalActiveOrg } from "@/hooks/auth/AuthProvider";
import {
  realtimeRefetchInterval,
  useRealtimeChannel,
} from "@/hooks/realtime/useRealtimeChannel";
import { readBroadcastPayload, safeOrgChannel } from "@/lib/realtime/channels";
import { useThrottledInvalidate } from "@/hooks/realtime/throttle";
import {
  sourcesQueryKey,
  useKnowledgeSources,
  useReindexSource,
  type SourceRow,
} from "@/hooks/ai/useKnowledgeSources";
import {
  KnowledgeSourceCard,
  type KnowledgeSourceType,
} from "@/components/ai/KnowledgeSourceCard";

interface Props {
  agentId: string;
  initialSources: SourceRow[];
}

const SLOTS: KnowledgeSourceType[] = ["faq", "policy", "conversations", "catalog"];

function canonicalType(t: string): KnowledgeSourceType | "other" {
  if (t === "faq") return "faq";
  if (t === "policy") return "policy";
  if (t === "conversation" || t === "conversations") return "conversations";
  if (t === "catalog" || t === "nuvemshop_catalog") return "catalog";
  return "other";
}

export function KnowledgeSourcesClient({ agentId, initialSources }: Props) {
  const reindex = useReindexSource(agentId);

  // Realtime: server broadcast on `org:<orgId>:kb-sources` (ids-only). The
  // browser client has no session (httpOnly cookie), so `postgres_changes`
  // under RLS would never deliver — see docs/runbooks/sessao-do-browser.md.
  const channel = safeOrgChannel(useOptionalActiveOrg()?.orgId, "kb-sources");
  const invalidate = useThrottledInvalidate();
  const onChange = useCallback(
    (message: unknown) => {
      const payload = readBroadcastPayload(message);
      if (!payload) return;
      if (payload.agent_id && payload.agent_id !== agentId) return;
      invalidate(sourcesQueryKey(agentId));
    },
    [invalidate, agentId],
  );
  const { status } = useRealtimeChannel({
    name: channel ?? "kb-sources-disabled",
    broadcast: { event: "*" },
    onChange,
    enabled: !!channel,
  });
  // Reindex runs in the background; poll as a safety net for a missed signal.
  const { data: sources } = useKnowledgeSources(agentId, {
    initialData: initialSources,
    refetchInterval: realtimeRefetchInterval(status),
  });

  const list = sources ?? [];

  const bySlot: Record<KnowledgeSourceType, SourceRow | undefined> = {
    faq: undefined,
    policy: undefined,
    conversations: undefined,
    catalog: undefined,
  };

  for (const s of list) {
    const t = canonicalType(s.source_type);
    if (t !== "other" && !bySlot[t]) {
      bySlot[t] = s;
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {SLOTS.map((slot) => {
        const source = bySlot[slot];
        const isReindexing =
          reindex.isPending && reindex.variables === source?.id;
        return (
          <KnowledgeSourceCard
            key={slot}
            type={slot}
            source={source ?? null}
            isReindexing={isReindexing}
            onReindex={source ? () => reindex.mutate(source.id) : undefined}
          />
        );
      })}
    </div>
  );
}
