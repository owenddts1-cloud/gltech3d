"use client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { BuyerMembership } from "@/lib/pro-signup/buyer-membership";

export type ProSignupStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface ProSignupRow {
  id: string;
  status: ProSignupStatus;
  plan: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string | null;
  company_name: string | null;
  amount_cents: number;
  currency: string;
  pix_txid: string | null;
  declared_paid_at: string;
  receipt_storage_path: string | null;
  organization_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  invited_user_email: string | null;
  created_at: string;
}

/** O detalhe acrescenta a URL assinada do comprovante, emitida no servidor. */
export interface ProSignupDetail extends ProSignupRow {
  request_ip: string | null;
  receipt_url: string | null;
}

interface ListResponse {
  data: ProSignupRow[];
  meta?: { cursor?: string | null; has_more?: boolean };
}

export function useProSignups(status?: ProSignupStatus) {
  return useInfiniteQuery({
    queryKey: ["admin", "pro-signups", status ?? "all"] as const,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (pageParam) params.set("cursor", pageParam);
      const qs = params.toString();
      return apiClient.get<ListResponse>(`/api/v1/admin/pro-signups${qs ? `?${qs}` : ""}`);
    },
    getNextPageParam: (last) => (last.meta?.has_more ? (last.meta.cursor ?? undefined) : undefined),
  });
}

export function useProSignup(id: string) {
  return useQuery({
    queryKey: ["admin", "pro-signups", "detail", id] as const,
    queryFn: () => apiClient.get<{ data: ProSignupDetail }>(`/api/v1/admin/pro-signups/${id}`),
  });
}

export interface ApproveProSignupPayload {
  /** Só no modo CREATE: numa org que já existe não se escolhe nome. */
  display_name?: string;
  slug?: string;
  legal_name?: string;
  cnpj?: string;
  /** Desempate quando o e-mail pertence a mais de uma organização. */
  organization_id?: string;
}

/** Org existente ganhou PRO — não há link de ativação, ele já tem senha. */
export interface ApproveUpgradeResult {
  id: string;
  status: "approved";
  mode: "upgrade";
  organization_id: string;
  /** null = a org já tinha plano sem vencimento; a aprovação o manteve. */
  plan_expires_at: string | null;
  /** A aprovação nunca muda o papel; avisa quando o comprador está sem acesso. */
  buyer_membership: BuyerMembership;
  email_dispatched: boolean;
}

/** Tenant novo — a UI precisa mostrar o link de ativação. */
export interface ApproveCreateResult {
  id: string;
  status: "approved";
  mode: "create";
  organization: { id: string; slug: string; display_name: string };
  /**
   * Verdadeiro quando o e-mail já tinha conta: ele virou admin da org nova e
   * entra com a senha atual. Nesse caso NÃO há link de ativação.
   */
  existing_account: boolean;
  activation_url: string | null;
  activation_expires_at: string | null;
  plan_expires_at: string;
  /** Falso quando o Resend não está configurado — a UI precisa mostrar o link. */
  email_dispatched: boolean;
}

export interface ApproveProSignupResponse {
  data: ApproveUpgradeResult | ApproveCreateResult;
}

/** Candidatas devolvidas no 409 `ambiguous_org`. */
export interface AmbiguousOrgCandidate {
  organizationId: string;
  organizationName: string;
}

export function useApproveProSignup(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ApproveProSignupPayload) =>
      apiClient.post<ApproveProSignupResponse>(`/api/v1/admin/pro-signups/${id}/approve`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "pro-signups"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
  });
}

export function useRejectProSignup(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (review_note?: string) =>
      apiClient.patch<{ data: { id: string; status: "rejected" } }>(
        `/api/v1/admin/pro-signups/${id}`,
        { action: "reject", ...(review_note ? { review_note } : {}) },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "pro-signups"] });
    },
  });
}
