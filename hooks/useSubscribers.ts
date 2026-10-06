"use client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { Role } from "@/lib/auth/types";
import type { PlanState, PlanTier } from "@/lib/plan/types";
import type { SubscriberFilter } from "@/lib/plan/subscribers";

export type { SubscriberFilter };

export interface SubscriberRow {
  id: string;
  display_name: string;
  slug: string;
  org_status: string;
  plan: string | null;
  trial_ends_at: string | null;
  plan_expires_at: string | null;
  state: PlanState | null;
  members_count: number;
  owner: { user_id: string; email: string | null } | null;
  last_request: { id: string; status: string; created_at: string } | null;
  created_at: string;
}

interface ListResponse {
  data: SubscriberRow[];
  meta?: { cursor?: string | null; has_more?: boolean };
}

export interface SubscriberMember {
  user_id: string;
  email: string | null;
  role: Role;
  accepted_at: string | null;
  revoked_at: string | null;
}

export interface SubscriberRequest {
  id: string;
  status: string;
  buyer_name: string;
  buyer_email: string;
  amount_cents: number;
  currency: string;
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
}

export interface SubscriberAuditEntry {
  id: string;
  created_at: string;
  action: string;
  actor_user_id: string | null;
  acting_as_platform_admin: boolean;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface SubscriberDetail {
  organization: {
    id: string;
    slug: string;
    display_name: string;
    status: string;
    created_at: string;
    plan: string | null;
    trial_ends_at: string | null;
    plan_expires_at: string | null;
  };
  state: PlanState | null;
  members: SubscriberMember[];
  requests: SubscriberRequest[];
  audit: SubscriberAuditEntry[];
}

export type PlanMutation =
  | { action: "set"; plan: PlanTier; expires_at: string | null; reason: string }
  | { action: "extend"; days: number; reason: string }
  | { action: "revoke"; reason: string };

const KEY = ["admin", "subscribers"] as const;

export function useSubscribers(status: SubscriberFilter, q: string) {
  return useInfiniteQuery({
    queryKey: [...KEY, "list", status, q] as const,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ status });
      if (q.trim()) params.set("q", q.trim());
      if (pageParam) params.set("cursor", pageParam);
      return apiClient.get<ListResponse>(`/api/v1/admin/subscribers?${params.toString()}`);
    },
    getNextPageParam: (last) => (last.meta?.has_more ? (last.meta.cursor ?? undefined) : undefined),
  });
}

export function useSubscriber(orgId: string) {
  return useQuery({
    queryKey: [...KEY, "detail", orgId] as const,
    queryFn: () => apiClient.get<{ data: SubscriberDetail }>(`/api/v1/admin/subscribers/${orgId}`),
    enabled: !!orgId,
  });
}

function useInvalidate(orgId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: KEY });
    void queryClient.invalidateQueries({ queryKey: ["admin", "tenant", orgId] });
  };
}

export function useUpdateSubscriberPlan(orgId: string) {
  const invalidate = useInvalidate(orgId);
  return useMutation({
    mutationFn: (payload: PlanMutation) =>
      apiClient.patch<{ data: { organization_id: string; state: PlanState | null } }>(
        `/api/v1/admin/subscribers/${orgId}/plan`,
        payload,
      ),
    onSuccess: invalidate,
  });
}

export function useUpdateSubscriberMemberRole(orgId: string) {
  const invalidate = useInvalidate(orgId);
  return useMutation({
    mutationFn: (payload: { userId: string; role: Role; reason: string }) =>
      apiClient.patch<{ data: { user_id: string; role: Role; changed: boolean } }>(
        `/api/v1/admin/subscribers/${orgId}/members/${payload.userId}`,
        { role: payload.role, reason: payload.reason },
      ),
    onSuccess: invalidate,
  });
}
