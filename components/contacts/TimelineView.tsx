"use client";
import { useMemo } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChatCircle, Users, Storefront, Robot, Gear } from "@/lib/ui/icons";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTimeline } from "@/hooks/contacts/useTimeline";
import type { TimelineItem } from "@/lib/types/contacts";

interface Props {
  contactId: string;
  types?: string[];
}

const ICON_MAP: Record<string, PhosphorIcon> = {
  whatsapp: ChatCircle,
  crm: Users,
  nuvemshop: Storefront,
  ai: Robot,
  system: Gear,
};

const TYPE_LABELS: Record<string, string> = {
  "message.inbound": "Mensagem recebida",
  "message.outbound": "Mensagem enviada",
  "lead.created": "Lead criado",
  "lead.stage_changed": "Estágio alterado",
  "lead.won": "Lead ganho",
  "lead.lost": "Lead perdido",
  "order.created": "Pedido criado",
  "order.paid": "Pedido pago",
  "order.cancelled": "Pedido cancelado",
  "ai.responded": "IA respondeu",
  "handoff.triggered": "Handoff ativado",
  "system.contact_blocked_by_stop": "Contato bloqueou (STOP)",
  "contact.anonymized": "Contato anonimizado",
};

function dayHeader(d: Date): string {
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

function summarizePayload(p: Record<string, unknown>): string {
  if (!p) return "";
  if (typeof p.body === "string") return String(p.body).slice(0, 200);
  if (typeof p.text === "string") return String(p.text).slice(0, 200);
  if (typeof p.summary === "string") return String(p.summary).slice(0, 200);
  try {
    const s = JSON.stringify(p);
    return s.length > 200 ? s.slice(0, 200) + "…" : s;
  } catch {
    return "";
  }
}

export function TimelineView({ contactId, types }: Props) {
  const q = useTimeline(contactId, types);

  const grouped = useMemo(() => {
    const items: TimelineItem[] = q.data?.pages.flatMap((p) => p.data) ?? [];
    const map = new Map<string, TimelineItem[]>();
    for (const it of items) {
      const d = new Date(it.performed_at);
      const key = format(d, "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [q.data]);

  if (q.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (q.isError) {
    return (
      <Card className="p-4">
        <p className="text-sm text-error-fg">Erro ao carregar timeline.</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => q.refetch()}>
          Tentar novamente
        </Button>
      </Card>
    );
  }

  if (grouped.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Nenhuma atividade registrada ainda.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(([key, items]) => {
        const date = new Date(key);
        return (
          <section key={key} className="space-y-2">
            <h3 className="sticky top-0 z-10 bg-background py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {dayHeader(date)}
            </h3>
            <ul className="space-y-2">
              {items.map((it) => {
                const Icon = ICON_MAP[it.source_module] ?? Gear;
                const label = TYPE_LABELS[it.type] ?? it.type;
                const time = format(new Date(it.performed_at), "HH:mm", { locale: ptBR });
                return (
                  <li
                    key={it.id}
                    className="flex items-start gap-3 rounded-md border border-border bg-card p-3"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <Icon size={16} weight="duotone" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground">{time}</span>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {summarizePayload(it.payload)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {q.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
          >
            {q.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
          </Button>
        </div>
      )}
    </div>
  );
}
