"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { PlanPatch, PlatformSettingsJson } from "@/lib/admin/platform-settings-form";

export interface PlatformSettingsResponse extends PlatformSettingsJson {
  /** true = the row could not be read; the values are the factory defaults. */
  is_fallback: boolean;
  defaults?: PlatformSettingsJson;
}

const KEY = ["admin", "platform-settings"] as const;

export function usePlatformSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiClient.get<{ data: PlatformSettingsResponse }>("/api/v1/admin/platform-settings"),
  });
}

export function useUpdatePlatformSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: PlanPatch) =>
      apiClient.patch<{ data: PlatformSettingsResponse }>("/api/v1/admin/platform-settings", patch),
    onSuccess: (res) => {
      queryClient.setQueryData(KEY, (prev: { data: PlatformSettingsResponse } | undefined) => ({
        data: { ...res.data, defaults: prev?.data.defaults ?? res.data.defaults },
      }));
    },
  });
}
