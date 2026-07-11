"use client";

import Link from "next/link";
import { ArrowRight } from "@/lib/ui/icons";

interface Order {
  id: string;
  title: string;
  contactName: string | null;
  status: string;
  totalCents: number;
  slaDueAt: string | null;
}

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const STATUS_META: Record<string, { label: string; cls: string }> = {
  orcamento: { label: "Orçamento", cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300" },
  aprovado: { label: "Aprovada", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  em_producao: { label: "Em produção", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  concluido: { label: "Concluída", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
};

function sla(iso: string | null): { label: string; cls: string } {
  if (!iso) return { label: "Sem prazo", cls: "text-muted-foreground" };
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `Atrasada ${-days}d`, cls: "text-red-600 dark:text-red-400 font-medium" };
  if (days === 0) return { label: "Vence hoje", cls: "text-amber-600 dark:text-amber-400 font-medium" };
  if (days <= 3) return { label: `Em ${days}d`, cls: "text-amber-600 dark:text-amber-400" };
  return { label: `Em ${days}d`, cls: "text-muted-foreground" };
}

function initials(name: string | null): string {
  const t = name?.trim() || "OS";
  return t.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export function ActiveOrdersTable({ orders }: { orders: Order[] }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Ordens ativas</h2>
        <Link
          href="/app/service-orders"
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-text"
        >
          Ver todas <ArrowRight size={12} weight="bold" />
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma ordem ativa — crie uma OS para começar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-3 font-semibold">Cliente</th>
                <th className="pb-2 pr-3 font-semibold">Ordem</th>
                <th className="pb-2 pr-3 font-semibold">Prazo</th>
                <th className="pb-2 pr-3 text-right font-semibold">Valor</th>
                <th className="pb-2 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const s = STATUS_META[o.status] ?? { label: o.status, cls: "bg-muted text-muted-foreground" };
                const d = sla(o.slaDueAt);
                return (
                  <tr key={o.id} className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/40">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3b82f6]/10 text-[11px] font-bold text-[#2563eb]">
                          {initials(o.contactName)}
                        </span>
                        <span className="truncate font-medium text-text">{o.contactName ?? "—"}</span>
                      </div>
                    </td>
                    <td className="max-w-[180px] truncate py-2.5 pr-3 text-muted-foreground">{o.title}</td>
                    <td className={`whitespace-nowrap py-2.5 pr-3 text-xs ${d.cls}`}>{d.label}</td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-right font-semibold tabular-nums text-text">{brl(o.totalCents)}</td>
                    <td className="py-2.5 text-right">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
                        {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
