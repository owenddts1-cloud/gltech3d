"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/browser";
import type { AlertKind } from "@/app/api/v1/admin/dashboard/kpis/route";

const KIND_LABELS: Record<AlertKind, string> = {
  waha_ban: "Alerta WAHA",
  lgpd_at_risk: "Prazo LGPD",
  ai_budget: "Budget IA",
  tenant_pending_overflow: "Overflow de conversas",
};

interface AlertBroadcast {
  kind?: AlertKind;
  message?: string;
}

export function useAlertsRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("alerts-platform")
      .on("broadcast", { event: "*" }, (payload: { payload?: AlertBroadcast }) => {
        const data = payload?.payload;
        const kind = data?.kind;
        const label = kind ? (KIND_LABELS[kind] ?? kind) : "alerta";
        toast.warning(`Novo ${label}`, {
          description: data?.message,
        });
        qc.invalidateQueries({ queryKey: ["admin", "dashboard", "kpis"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
