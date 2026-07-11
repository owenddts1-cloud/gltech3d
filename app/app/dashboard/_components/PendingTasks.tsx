"use client";

import { CheckCircle, ArrowRight } from "@/lib/ui/icons";

type Priority = "alta" | "media" | "baixa";

// Placeholder: tarefas de exemplo. Trocar por fonte real (OS com SLA, follow-ups
// de leads) quando existir um backend de tarefas.
const TASKS: { id: string; title: string; due: string; priority: Priority }[] = [
  { id: "t1", title: "Orçamento — luminária custom (Studio Belo)", due: "Vence hoje", priority: "alta" },
  { id: "t2", title: "Follow-up: lead do WhatsApp (action figure)", due: "Amanhã", priority: "media" },
  { id: "t3", title: "Repor filamento PETG preto", due: "Em 3 dias", priority: "baixa" },
];

const PRIORITY: Record<Priority, { label: string; cls: string }> = {
  alta: { label: "Alta", cls: "bg-red-500/10 text-red-600" },
  media: { label: "Média", cls: "bg-amber-500/10 text-amber-600" },
  baixa: { label: "Baixa", cls: "bg-emerald-500/10 text-emerald-600" },
};

export function PendingTasks() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Tarefas pendentes</h2>
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-text"
        >
          Ver todas <ArrowRight size={12} weight="bold" />
        </button>
      </div>

      <ul className="space-y-2.5">
        {TASKS.map((t) => {
          const p = PRIORITY[t.priority];
          return (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface-elevated/40 p-3 transition-colors hover:border-border-strong"
            >
              <CheckCircle size={18} weight="regular" className="shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-text">{t.title}</div>
                <div className="text-[11px] text-muted-foreground">{t.due}</div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.cls}`}>
                {p.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
