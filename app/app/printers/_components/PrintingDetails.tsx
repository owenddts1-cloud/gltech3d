"use client";

import { useEffect, useState } from "react";
import { Clock, ClipboardText, X } from "@/lib/ui/icons";
import { ServiceOrderDrawer, type ServiceOrderDetail } from "@/components/service-orders/ServiceOrderDrawer";

interface Props {
  filename: string;
  progress: number;
  /** segundos restantes estimados (do backend/telemetria). */
  timeRemaining: number;
  filament?: { name: string; color: string } | null;
  /** OS ativas para vincular a esta impressão. */
  serviceOrders: ServiceOrderDetail[];
  /** OS atualmente vinculada ao job ativo (resolvida do active_print_job). */
  linkedOs: ServiceOrderDetail | null;
  /** Persistir o vínculo (null = desvincular). */
  onAssign: (osId: string | null) => void;
}

function fmtEta(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/**
 * Card de impressão ativa: barra de progresso, ETA regressivo ao vivo, placeholder
 * geométrico da peça e vínculo com a Ordem de Serviço (chip clicável → drawer).
 */
export function PrintingDetails({ filename, progress, timeRemaining, filament, serviceOrders, linkedOs, onAssign }: Props) {
  const [eta, setEta] = useState(timeRemaining);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { setEta(timeRemaining); }, [timeRemaining]);
  useEffect(() => {
    if (eta <= 0) return;
    const t = setInterval(() => setEta((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(t);
  }, [eta]);

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-start gap-3">
        {/* Placeholder geométrico da peça (camadas até o progresso) */}
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-zinc-700/60 bg-zinc-900/60">
          <div
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-orange-500/80 to-amber-400/40 transition-[height] duration-700 ease-out"
            style={{ height: `${Math.min(100, Math.max(0, progress))}%` }}
          />
          <div
            className="absolute inset-0 opacity-60"
            style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.35) 3px, rgba(0,0,0,0.35) 4px)" }}
          />
          <div
            className="absolute inset-x-0 h-[2px] bg-orange-300 shadow-[0_0_6px_rgba(253,186,116,0.8)] animate-pulse transition-[bottom] duration-700 ease-out"
            style={{ bottom: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>

        {/* Progresso + ETA */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex justify-between text-xs font-semibold text-zinc-200">
            <span className="truncate max-w-[140px]">{filename}</span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
          <div className="w-full overflow-hidden rounded-full bg-zinc-800 h-2">
            <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
          <div className="flex items-center justify-between text-[10px] text-zinc-400">
            <span className="flex items-center gap-1 font-mono tabular-nums text-zinc-300">
              <Clock size={12} /> ETA {fmtEta(eta)}
            </span>
            {filament && (
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full border border-white/20" style={{ backgroundColor: filament.color }} />
                {filament.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Vínculo com a OS */}
      {linkedOs ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-[10px] font-semibold text-orange-300 transition-colors hover:bg-orange-500/20"
            title="Ver detalhes da OS"
          >
            <ClipboardText size={12} weight="fill" />
            <span className="truncate">{linkedOs.title}</span>
          </button>
          <button
            type="button"
            onClick={() => onAssign(null)}
            aria-label="Desvincular OS"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <X size={12} weight="bold" />
          </button>
        </div>
      ) : serviceOrders.length > 0 ? (
        <select
          value=""
          onChange={(e) => e.target.value && onAssign(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
        >
          <option value="" className="bg-zinc-950">Vincular Ordem de Serviço…</option>
          {serviceOrders.map((so) => (
            <option key={so.id} value={so.id} className="bg-zinc-950">
              {so.title}{so.contactName ? ` — ${so.contactName}` : ""}
            </option>
          ))}
        </select>
      ) : null}

      <ServiceOrderDrawer os={linkedOs} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
