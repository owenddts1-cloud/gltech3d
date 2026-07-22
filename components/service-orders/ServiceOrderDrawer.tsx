"use client";

import Link from "next/link";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardText, Cube, Clock } from "@/lib/ui/icons";

export interface ServiceOrderDetail {
  id: string;
  title: string;
  contactName: string | null;
  status: string;
  priority: string;
  material: string | null;
  totalCents: number;
  slaDueAt: string | null;
}

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const STATUS_META: Record<string, { label: string; variant: "warning" | "info" | "default" | "success" | "neutral" }> = {
  orcamento: { label: "Orçamento", variant: "warning" },
  aprovado: { label: "Aprovado / Fila", variant: "info" },
  em_producao: { label: "Em Produção", variant: "default" },
  pronto_entrega: { label: "Pronto p/ Entrega", variant: "info" },
  concluido: { label: "Concluído", variant: "success" },
};

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  alta: { label: "Alta", cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  media: { label: "Média", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  baixa: { label: "Baixa", cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300" },
};

function slaLabel(iso: string | null): string {
  if (!iso) return "Sem prazo";
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `Atrasada ${-days}d`;
  if (days === 0) return "Vence hoje";
  return `Em ${days}d`;
}

interface Props {
  os: ServiceOrderDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ServiceOrderDrawer({ os, open, onOpenChange }: Props) {
  const status = os ? STATUS_META[os.status] ?? { label: os.status, variant: "neutral" as const } : null;
  const priority = os ? PRIORITY_META[os.priority] ?? { label: os.priority, cls: "bg-muted text-muted-foreground" } : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-md">
        {os && status && priority && (
          <div className="flex flex-col">
            <SheetHeader className="space-y-0 border-b border-border p-6 text-left">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <ClipboardText size={22} weight="duotone" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate text-base">{os.title}</SheetTitle>
                  <SheetDescription className="truncate">{os.contactName ?? "Sem cliente vinculado"}</SheetDescription>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${priority.cls}`}>
                      {priority.label}
                    </span>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-3 border-b border-border p-6 text-sm">
              <Row label="Valor total" value={brl(os.totalCents)} strong />
              <Row label="Prazo (SLA)" value={slaLabel(os.slaDueAt)} icon={<Clock size={13} className="text-muted-foreground" />} />
              <Row label="Material" value={os.material ?? "—"} icon={<Cube size={13} className="text-muted-foreground" />} />
            </div>

            <div className="p-6">
              <Button asChild className="w-full gap-1.5 rounded-lg text-xs font-semibold">
                <Link href="/app/service-orders">Abrir no quadro de Ordens</Link>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value, strong, icon }: { label: string; value: string; strong?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</dt>
      <dd className={`text-right ${strong ? "text-base font-bold text-foreground tabular-nums" : "font-medium text-foreground"}`}>{value}</dd>
    </div>
  );
}
