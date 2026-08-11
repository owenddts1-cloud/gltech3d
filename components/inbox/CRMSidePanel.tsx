"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tag, Receipt, Users, ArrowRight } from "@/lib/ui/icons";
import type { ConversationWithContact } from "@/hooks/inbox/useConversationsRealtime";
import {
  fetchContactCrmSummary,
  type ContactLeadRow,
  type ContactOrderRow,
  type ContactActivityRow,
} from "@/app/actions/inbox/contact-summary";

interface Props {
  conversation: ConversationWithContact | null;
}

function formatMoney(cents: number | null, currency: string | null): string {
  if (cents == null) return "—";
  const cur = currency ?? "BRL";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: cur }).format(
      cents / 100,
    );
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
}

function shortDate(iso: string): string {
  return format(new Date(iso), "dd/MM/yy HH:mm", { locale: ptBR });
}

export function CRMSidePanel({ conversation }: Props) {
  const contact = conversation?.contacts ?? null;
  const contactId = contact?.id ?? null;

  const [leads, setLeads] = useState<ContactLeadRow[] | null>(null);
  const [orders, setOrders] = useState<ContactOrderRow[] | null>(null);
  const [activities, setActivities] = useState<ContactActivityRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!contactId) {
      setLeads(null);
      setOrders(null);
      setActivities(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    async function load() {
      // Server Action: o cliente do browser não tem sessão (cookie httpOnly) e
      // estas três tabelas têm RLS — de lá voltavam sempre vazias, sem erro.
      const res = await fetchContactCrmSummary({ contactId });
      if (cancelled) return;

      if (!res.ok) {
        setLoadError(res.error);
        setLeads([]);
        setOrders([]);
        setActivities([]);
      } else {
        setLeads(res.leads);
        setOrders(res.orders);
        setActivities(res.activities);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const tags = contact?.tags ?? [];
  const displayName =
    contact?.display_name?.trim() ||
    contact?.name?.trim() ||
    contact?.phone_number ||
    "—";

  const sectionsLoading = useMemo(
    () => loading || (leads === null && orders === null && activities === null),
    [loading, leads, orders, activities],
  );

  if (!conversation) {
    return (
      <aside className="flex h-full items-center justify-center border-l border-border p-4 text-center text-xs text-muted-foreground">
        Selecione uma conversa para ver detalhes do contato.
      </aside>
    );
  }

  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto border-l border-border bg-background p-4">
      {/* Falha de leitura precisa aparecer. Mostrar seção vazia quando na
          verdade a consulta falhou foi o que manteve este defeito invisível. */}
      {loadError && (
        <div className="rounded-md border border-red-500/40 bg-red-500/5 p-2 text-[11px] leading-snug text-red-400">
          Não consegui carregar o histórico deste contato.
          <span className="mt-0.5 block font-mono text-muted-foreground">{loadError}</span>
        </div>
      )}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Contato
        </h3>
        <Card className="mt-2 space-y-2 p-3 text-sm">
          <div className="font-medium">{displayName}</div>
          {contact?.phone_number && (
            <div className="text-xs text-muted-foreground">{contact.phone_number}</div>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
              <Tag size={12} className="mr-1" weight="regular" aria-hidden /> Tag
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
              <Users size={12} className="mr-1" weight="regular" aria-hidden /> Lead
            </Button>
            {contactId && (
              <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                <Link href={`/app/contacts/${contactId}`}>
                  Ver contato
                  <ArrowRight size={12} className="ml-1" weight="regular" aria-hidden />
                </Link>
              </Button>
            )}
          </div>
        </Card>
      </section>

      <Separator />

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Leads recentes
        </h3>
        {sectionsLoading ? (
          <Skeleton className="mt-2 h-14 w-full" />
        ) : leads && leads.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {leads.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between rounded-md border border-border p-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{l.title}</div>
                  <div className="text-muted-foreground">
                    {l.status} · {formatMoney(l.value_cents, l.currency)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Sem leads.</p>
        )}
      </section>

      <Separator />

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pedidos recentes
        </h3>
        {sectionsLoading ? (
          <Skeleton className="mt-2 h-14 w-full" />
        ) : orders && orders.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {orders.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between rounded-md border border-border p-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1 truncate font-medium">
                    <Receipt size={11} weight="regular" aria-hidden />
                    {o.external_id ?? o.id.slice(0, 8)}
                  </div>
                  <div className="text-muted-foreground">
                    {o.status ?? "—"} · {formatMoney(o.total_cents, o.currency)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Sem pedidos.</p>
        )}
      </section>

      <Separator />

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Atividade
        </h3>
        {sectionsLoading ? (
          <Skeleton className="mt-2 h-14 w-full" />
        ) : activities && activities.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {activities.map((a) => (
              <li key={a.id} className="rounded-md border border-border p-2 text-xs">
                <div className="font-medium">{a.type}</div>
                <div className="text-muted-foreground">
                  {a.source_module} · {shortDate(a.performed_at)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Sem atividade.</p>
        )}
      </section>
    </aside>
  );
}
