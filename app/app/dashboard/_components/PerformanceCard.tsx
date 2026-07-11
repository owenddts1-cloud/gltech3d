"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { CheckCircle } from "@/lib/ui/icons";

interface Props {
  successRate: number; // 0-100
  goals: { label: string; done: boolean }[];
}

const TRACK = "var(--color-border)";

export function PerformanceCard({ successRate, goals }: Props) {
  const pct = Math.max(0, Math.min(100, successRate));
  // Semi-círculo: fatia preenchida (pct) + trilho (resto).
  const data = [
    { name: "done", value: pct },
    { name: "rest", value: 100 - pct },
  ];
  const tone = pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Sua performance</h2>
        <span className="text-xs text-muted-foreground">OS concluídas</span>
      </div>

      <div className="relative mx-auto h-28 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              startAngle={180}
              endAngle={0}
              cx="50%"
              cy="100%"
              innerRadius={64}
              outerRadius={88}
              paddingAngle={0}
              stroke="none"
              isAnimationActive={false}
            >
              <Cell fill={tone} />
              <Cell fill={TRACK} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-x-0 bottom-1 flex flex-col items-center">
          <span className="text-3xl font-bold leading-none text-text">{pct}%</span>
          <span className="mt-1 text-[11px] text-muted-foreground">taxa de sucesso</span>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5 border-t border-border pt-3">
        {goals.length === 0 ? (
          <li className="text-xs text-muted-foreground">Sem metas para exibir ainda.</li>
        ) : (
          goals.map((g) => (
            <li key={g.label} className="flex items-center justify-between gap-2 text-xs">
              <span className={g.done ? "text-text" : "text-muted-foreground"}>{g.label}</span>
              {g.done ? (
                <CheckCircle size={18} weight="fill" className="shrink-0 text-emerald-500" />
              ) : (
                <span className="h-[15px] w-[15px] shrink-0 rounded-full border-2 border-border-strong" aria-hidden />
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
