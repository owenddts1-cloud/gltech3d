"use client";

/**
 * Orders placed through the public filament cart (/filamentos). The shop
 * talks to the customer on WhatsApp, then confirms/cancels here and converts a
 * paid order into sales (one sale per item — feeds stock and reports).
 */
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, X, Receipt, ArrowRight, ChatCircle, CircleNotch } from "@/lib/ui/icons";
import {
  convertSiteOrderToSales,
  updateSiteOrderStatus,
  type SiteOrderView,
} from "@/app/actions/site-orders/actions";
import { SITE_ORDER_STATUS_LABEL, type SiteOrderStatus } from "@/lib/site-orders/core";
import { formatBRL } from "@/lib/pricing/pro-plans";
import { formatWhatsappDisplay, storeWhatsappUrl } from "@/lib/landing/whatsapp-number";

const TABS: ReadonlyArray<{ value: SiteOrderStatus; label: string }> = [
  { value: "novo", label: "Novos / Pendentes" },
  { value: "confirmado", label: "Confirmados / Pagos" },
  { value: "cancelado", label: "Cancelados" },
];

const STATUS_VARIANT: Record<SiteOrderStatus, "info" | "success" | "neutral"> = {
  novo: "info",
  confirmado: "success",
  cancelado: "neutral",
};

export function getPaymentMethodBadge(notes: string | null): { label: string; variant: "success" | "info" | "neutral" } | null {
  if (!notes) return null;
  if (notes.includes("[Pagamento: Pix Imediato]")) return { label: "Pix Imediato", variant: "success" };
  if (notes.includes("[Pagamento: Cartão de Crédito]")) return { label: "Cartão de Crédito", variant: "info" };
  if (notes.includes("[Pagamento: A Combinar no WhatsApp]")) return { label: "WhatsApp", variant: "neutral" };
  return null;
}

type PendingAction = { kind: "convert" | "cancel"; order: SiteOrderView } | null;

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export function SiteOrdersClient({
  initialOrders,
  loadError,
}: {
  initialOrders: SiteOrderView[];
  loadError: string | null;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [tab, setTab] = useState<SiteOrderStatus>("novo");
  const [pending, setPending] = useState<PendingAction>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c: Record<SiteOrderStatus, number> = { novo: 0, confirmado: 0, cancelado: 0 };
    for (const o of orders) c[o.status] += 1;
    return c;
  }, [orders]);
  const visible = orders.filter((o) => o.status === tab);

  function replace(next: SiteOrderView) {
    setOrders((list) => list.map((o) => (o.id === next.id ? next : o)));
  }

  function changeStatus(order: SiteOrderView, status: SiteOrderStatus) {
    setBusyId(order.id);
    startTransition(async () => {
      const r = await updateSiteOrderStatus({ id: order.id, status });
      setBusyId(null);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      replace(r.order);
      toast.success(`Pedido #${order.shortId} ${status === "confirmado" ? "confirmado" : status === "cancelado" ? "cancelado" : "reaberto"}.`);
    });
  }

  function convert(order: SiteOrderView) {
    setBusyId(order.id);
    startTransition(async () => {
      const r = await convertSiteOrderToSales(order.id);
      setBusyId(null);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      replace(r.order);
      toast.success(
        `Pedido #${order.shortId} virou ${r.salesCreated} ${r.salesCreated === 1 ? "venda" : "vendas"}.`,
        { action: { label: "Ver vendas", onClick: () => window.location.assign("/app/sales") } },
      );
    });
  }

  function confirmPending() {
    if (!pending) return;
    if (pending.kind === "convert") convert(pending.order);
    else changeStatus(pending.order, "cancelado");
    setPending(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos do site</h1>
        <p className="text-sm text-text-muted">
          Carrinhos enviados pela vitrine de filamentos. Combine estoque, frete e pagamento no WhatsApp e registre aqui o
          resultado.
        </p>
      </header>

      {loadError ? (
        <p role="alert" className="rounded-md border border-error/40 bg-error-bg px-4 py-3 text-sm text-error-fg">
          {loadError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar pedidos por situação">
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.value)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-text-muted hover:border-accent hover:text-text"
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-1.5 text-xs tabular-nums ${active ? "bg-black/15" : "bg-surface-elevated"}`}
              >
                {counts[t.value]}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <Receipt size={36} className="text-text-muted" aria-hidden />
          <p className="font-medium">
            {tab === "novo" ? "Nenhum pedido novo." : `Nenhum pedido ${SITE_ORDER_STATUS_LABEL[tab].toLowerCase()}.`}
          </p>
          <p className="max-w-md text-sm text-text-muted">
            Os pedidos chegam aqui quando um cliente monta o carrinho em{" "}
            <Link href="/filamentos" target="_blank" className="text-accent underline underline-offset-4">
              /filamentos
            </Link>{" "}
            e clica em “Finalizar pelo WhatsApp”. Publique filamentos com preço em{" "}
            <Link href="/app/filamentos" className="text-accent underline underline-offset-4">
              Filamentos
            </Link>{" "}
            para a vitrine funcionar.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {visible.map((o) => {
            const busy = busyId === o.id;
            return (
              <li key={o.id} className="flex flex-col rounded-lg border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">#{o.shortId}</span>
                      <Badge variant={STATUS_VARIANT[o.status]}>
                        {o.status === "novo" ? "Pendente" : SITE_ORDER_STATUS_LABEL[o.status]}
                      </Badge>
                      {o.convertedAt ? <Badge variant="success">Faturado (Venda & Baixa de Estoque)</Badge> : null}
                      {(() => {
                        const pay = getPaymentMethodBadge(o.notes);
                        return pay ? <Badge variant={pay.variant}>{pay.label}</Badge> : null;
                      })()}
                      <span className="text-xs text-text-muted">
                        ({o.items.reduce((s, it) => s + it.qty, 0)} {o.items.reduce((s, it) => s + it.qty, 0) === 1 ? "carretel" : "carretéis"})
                      </span>
                    </div>
                    <p className="mt-1 truncate font-medium">{o.customerName}</p>
                    <a
                      href={storeWhatsappUrl(o.customerWhatsapp, `Olá, ${o.customerName}! Sobre o seu pedido #${o.shortId}…`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                    >
                      <ChatCircle size={14} aria-hidden />
                      {formatWhatsappDisplay(o.customerWhatsapp)}
                    </a>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tabular-nums">{formatBRL(o.totalCents)}</p>
                    <p className="text-xs text-text-muted">{formatWhen(o.createdAt)}</p>
                  </div>
                </div>

                <ul className="mt-4 divide-y divide-border rounded-md border border-border text-sm">
                  {o.items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="min-w-0 truncate">
                        <span className="font-semibold tabular-nums">{it.qty}×</span> {it.productName}
                      </span>
                      <span className="shrink-0 tabular-nums text-text-muted">{formatBRL(it.lineTotalCents)}</span>
                    </li>
                  ))}
                </ul>
                {o.notes ? <p className="mt-3 rounded-md bg-surface-elevated px-3 py-2 text-sm">{o.notes}</p> : null}

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  {busy ? <CircleNotch size={16} className="animate-spin text-text-muted" aria-label="Salvando" /> : null}
                  {o.status === "novo" ? (
                    <>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPending({ kind: "cancel", order: o })}>
                        <X /> Cancelar
                      </Button>
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => changeStatus(o, "confirmado")}>
                        <Check /> Confirmar Pagamento
                      </Button>
                    </>
                  ) : null}
                  {o.status === "confirmado" && !o.convertedAt ? (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPending({ kind: "cancel", order: o })}>
                      <X /> Cancelar
                    </Button>
                  ) : null}
                  {o.status === "cancelado" ? (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => changeStatus(o, "novo")}>
                      Reabrir
                    </Button>
                  ) : null}
                  {o.status !== "cancelado" && !o.convertedAt ? (
                    <Button size="sm" disabled={busy} onClick={() => setPending({ kind: "convert", order: o })}>
                      Converter em venda <ArrowRight />
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === "convert"
                ? `Converter o pedido #${pending.order.shortId} em venda?`
                : `Cancelar o pedido #${pending?.order.shortId ?? ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "convert"
                ? `Cada item vira uma venda paga com a data de hoje (${pending.order.items.length} ${
                    pending.order.items.length === 1 ? "venda" : "vendas"
                  }, total ${formatBRL(pending.order.totalCents)}) e o estoque é baixado. Faça isso só depois de receber o pagamento.`
                : "O pedido sai da lista de novos. Você pode reabri-lo depois, se o cliente voltar."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPending}>
              {pending?.kind === "convert" ? "Converter em venda" : "Cancelar pedido"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
