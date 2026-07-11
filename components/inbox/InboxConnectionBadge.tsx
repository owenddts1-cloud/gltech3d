"use client";

import { WifiHigh, WifiSlash } from "@/lib/ui/icons";
import {
  useChannelSessions,
  deriveOverallHealth,
  type ConnectionHealth,
} from "@/hooks/channels/useChannelSessions";

const META: Record<
  ConnectionHealth,
  { label: string; dot: string; text: string; pulse: boolean; icon: typeof WifiHigh }
> = {
  connected: { label: "Conectado", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", pulse: false, icon: WifiHigh },
  connecting: { label: "Conectando…", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", pulse: true, icon: WifiHigh },
  down: { label: "Reconectando…", dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", pulse: true, icon: WifiSlash },
  none: { label: "Sem número", dot: "bg-zinc-400", text: "text-muted-foreground", pulse: false, icon: WifiSlash },
};

/**
 * Sinal de saúde da conexão WAHA no Inbox. Dado real vindo de
 * `channel_sessions` (mesma fonte da sidebar e da Central de Conexões).
 */
export function InboxConnectionBadge() {
  const { data: sessions } = useChannelSessions({ refetchInterval: 20_000 });
  const health = deriveOverallHealth(sessions);
  const m = META[health];
  const Icon = m.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold ${m.text}`}
      title={m.label}
      aria-live="polite"
    >
      <span className="relative flex h-1.5 w-1.5">
        {m.pulse && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${m.dot}`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${m.dot}`} />
      </span>
      <Icon size={12} weight="bold" aria-hidden />
      <span className="hidden sm:inline">{m.label}</span>
    </span>
  );
}
