"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import type { BulkLeadActionInput } from "@/lib/schemas/leads";

export function useBulkAction(pipelineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BulkLeadActionInput) =>
      apiClient.post<{ data: { updated_count: number } }>(
        "/api/v1/leads/bulk",
        input,
      ),
    onError: showApiError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", pipelineId] }),
  });
}
