"use client";

/**
 * Seção compacta de O.S. do Dashboard: abas Em andamento / Atrasadas / Concluídas
 * (classificação automática por status + SLA), 5 por página com paginação
 * NUMERADA — a seção nunca cresce com o volume. Clique → detalhe da O.S.
 * (deep-link ?os= já suportado pelo board).
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CaretLeft, CaretRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import type { OrderOverviewRow } from "@/app/actions/dashboard/analytics";
import {
  bucketOrders,
  paginate,
  slaLabel,
  type OrdersTab,
} from "../_lib/orders-overview";

const brl = (cents: number): string =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_LABEL: Record<string, string> = {
  orcamento: "Orçamento",
  aprovado: "Aprovado",
  em_producao: "Em produção",
  pos_processamento: "Pós-processo",
  pronto_entrega: "Pronto p/ entrega",
  concluido: "Concluído",
};

const SLA_TONE: Record<"danger" | "warning" | "neutral", string> = {
  danger: "text-error-fg font-semibold",
  warning: "text-warning-fg font-medium",
  neutral: "text-muted-foreground",
};

export function OrdersOverviewPanel({ orders }: { orders: OrderOverviewRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<OrdersTab>("andamento");
  // Página independente por aba (trocar de aba não perde onde estava).
  const [pages, setPages] = useState<Record<OrdersTab, number>>({
    andamento: 1,
    atrasadas: 1,
    concluidas: 1,
  });

  const now = useMemo(() => new Date(), []);
  const buckets = useMemo(() => bucketOrders(orders, now), [orders, now]);

  const TABS: { key: OrdersTab; label: string }[] = [
    { key: "andamento", label: `Em andamento (${buckets.andamento.length})` },
    { key: "atrasadas", label: `Atrasadas (${buckets.atrasadas.length})` },
    { key: "concluidas", label: `Concluídas (${buckets.concluidas.length})` },
  ];

  function renderList(key: OrdersTab) {
    const { items, page, totalPages } = paginate(buckets[key], pages[key]);

    if (items.length === 0) {
      return (
        <div className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">
          Nenhuma O.S. aqui.
        </div>
      );
    }

    return (
      <>
        <ul className="divide-y divide-border/70">
          {items.map((o) => {
            const sla = key === "concluidas" ? null : slaLabel(o.slaDueAt, now);
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/app/service-orders?os=${o.id}`)}
                  className="flex w-full items-center gap-3 py-2.5 text-left transition hover:bg-surface-elevated/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {o.code ? `${o.code} · ` : ""}{o.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {o.contactName} · {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-sm font-semibold">{brl(o.totalCents)}</span>
                    {sla ? (
                      <span className={cn("text-[10px]", SLA_TONE[sla.tone])}>{sla.text}</span>
                    ) : o.concludedAt ? (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(o.concludedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {totalPages > 1 && (
          <nav aria-label="Páginas de O.S." className="mt-2 flex items-center justify-center gap-1">
            <PageBtn
              disabled={page === 1}
              onClick={() => setPages((p) => ({ ...p, [key]: page - 1 }))}
              aria-label="Página anterior"
            >
              <CaretLeft size={12} aria-hidden />
            </PageBtn>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <PageBtn
                key={n}
                active={n === page}
                onClick={() => setPages((p) => ({ ...p, [key]: n }))}
                aria-label={`Página ${n}`}
                aria-current={n === page ? "page" : undefined}
              >
                {n}
              </PageBtn>
            ))}
            <PageBtn
              disabled={page === totalPages}
              onClick={() => setPages((p) => ({ ...p, [key]: page + 1 }))}
              aria-label="Próxima página"
            >
              <CaretRight size={12} aria-hidden />
            </PageBtn>
          </nav>
        )}
      </>
    );
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as OrdersTab)}>
      <TabsList className="grid w-full grid-cols-3">
        {TABS.map((t) => (
          <TabsTrigger key={t.key} value={t.key} className="text-[11px] sm:text-xs">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {TABS.map((t) => (
        <TabsContent key={t.key} value={t.key} className="mt-2">
          {renderList(t.key)}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function PageBtn({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-xs transition-colors",
        active
          ? "border-accent bg-accent text-accent-foreground font-semibold"
          : "border-border text-muted-foreground hover:bg-surface-elevated hover:text-text",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
