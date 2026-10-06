"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import { showApiError } from "@/components/feedback/ApiErrorToast";

interface DeleteContactResponse {
  data: { id: string; deleted: true };
}

/** 409 from DELETE /api/v1/contacts/[id] when the contact has history. */
export function isContactHasHistoryError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.code === "contact_has_history";
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contactId: string) =>
      apiClient.delete<DeleteContactResponse>(`/api/v1/contacts/${encodeURIComponent(contactId)}`),
    // The "has history" conflict is explained inline by the dialog, not as a toast.
    onError: (err) => {
      if (!isContactHasHistoryError(err)) showApiError(err);
    },
    onSuccess: (_data, contactId) => {
      qc.removeQueries({ queryKey: ["contact", contactId] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}
