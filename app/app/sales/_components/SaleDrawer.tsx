"use client";

/**
 * Sale detail drawer (stage E3) — right-side Sheet with the full order view:
 * production stepper, Detalhes/Itens/Docs tabs, payment toggle, editable notes,
 * inline edit form and footer actions (advance stage, mark paid, edit, print,
 * cancel). Every mutation patches the parent `sales` state optimistically via
 * `onPatch`, persists with `updateSale` and rolls back on failure — so the
 * table, kanban and timeline always read the same source of truth.
 *
 * The inner body is keyed by sale id: drafts (notes/edit form) reset when a
 * different sale opens, but survive optimistic patches to the same sale.
 */

import { Fragment, useState } from "react";
import { toast } from "sonner";
import { updateSale } from "@/app/actions/sales/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  Check,
  FloppyDisk,
  PencilSimple,
  Printer,
  Warning,
  X,
} from "@/lib/ui/icons";
import {
  FULFILLMENT_LABEL,
  KANBAN_STAGES,
  PAYMENT_LABEL,
  SALES_PLATFORMS,
  type SalePayment,
  type SaleRow,
} from "@/lib/sales/config";
import { brl, orderCode } from "../_lib/view-model";

interface Props {
  /** Null = drawer closed. */
  sale: SaleRow | null;
  onClose: () => void;
  /** Applies a partial patch to one sale in the parent state (optimistic + rollback). */
  onPatch: (id: string, patch: Partial<SaleRow>) => void;
}

const PAYMENT_VARIANT: Record<SalePayment, "success" | "warning" | "error"> = {
  pago: "success",
  pendente: "warning",
  estornado: "error",
};

/** "17 de julho de 2026" — long pt-BR date for the header. */
function longDateBR(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** "1234,56" — cents → editable pt-BR decimal string. */
function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Captures the pre-patch values of exactly the fields a patch touches. */
function pickSnapshot(sale: SaleRow, patch: Partial<SaleRow>): Partial<SaleRow> {
  const snapshot: Partial<SaleRow> = {};
  for (const key of Object.keys(patch) as (keyof SaleRow)[]) {
    (snapshot as Record<string, unknown>)[key] = sale[key];
  }
  return snapshot;
}

export default function SaleDrawer({ sale, onClose, onPatch }: Props) {
  return (
    <Sheet
      open={sale !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {sale && (
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden border-border bg-surface p-0 sm:max-w-lg"
        >
          {/* Key by id: reopening with another sale resets drafts cleanly. */}
          <SaleDrawerBody key={sale.id} sale={sale} onPatch={onPatch} />
        </SheetContent>
      )}
    </Sheet>
  );
}

function SaleDrawerBody({
  sale,
  onPatch,
}: {
  sale: SaleRow;
  onPatch: (id: string, patch: Partial<SaleRow>) => void;
}) {
  const [notesDraft, setNotesDraft] = useState(sale.notes ?? "");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => ({
    customer: sale.customerName ?? "",
    platform: sale.platform,
    total: centsToInput(sale.totalCents),
    commission: centsToInput(sale.commissionCents),
    soldAt: sale.soldAt,
  }));

  const cancelled = sale.fulfillmentStatus === "cancelada";
  const currentIdx = KANBAN_STAGES.indexOf(sale.fulfillmentStatus);
  const nextStage = cancelled ? undefined : KANBAN_STAGES[currentIdx + 1];
  const netCents = sale.totalCents - sale.commissionCents;

  /** Optimistic patch + persist + rollback with toast on failure. */
  function persist(patch: Partial<SaleRow>, server: Record<string, unknown>, okMsg?: string) {
    const snapshot = pickSnapshot(sale, patch);
    onPatch(sale.id, patch);
    void updateSale(sale.id, server).then((res) => {
      if (!res.ok) {
        onPatch(sale.id, snapshot);
        toast.error(res.error);
      } else if (okMsg) {
        toast.success(okMsg);
      }
    });
  }

  function togglePayment() {
    const next: SalePayment = sale.paymentStatus === "pago" ? "pendente" : "pago";
    persist(
      { paymentStatus: next },
      { paymentStatus: next },
      next === "pago" ? "Pagamento confirmado." : "Pagamento marcado como pendente.",
    );
  }

  function advanceStage() {
    if (!nextStage) return;
    persist(
      { fulfillmentStatus: nextStage },
      { fulfillmentStatus: nextStage },
      `Pedido #${orderCode(sale)} avançou para ${FULFILLMENT_LABEL[nextStage]}.`,
    );
  }

  function cancelSale() {
    if (!window.confirm(`Cancelar o pedido #${orderCode(sale)}? Ele sai do fluxo de produção.`)) {
      return;
    }
    persist(
      { fulfillmentStatus: "cancelada" },
      { fulfillmentStatus: "cancelada" },
      "Pedido cancelado.",
    );
  }

  function saveNotes() {
    const trimmed = notesDraft.trim();
    persist({ notes: trimmed || null }, { notes: trimmed }, "Notas salvas.");
  }

  function saveEdit() {
    const total = Number(form.total.replace(",", "."));
    const commission = form.commission.trim() ? Number(form.commission.replace(",", ".")) : 0;
    if (!form.total.trim() || Number.isNaN(total) || total < 0) {
      toast.error("Informe um valor total válido.");
      return;
    }
    if (Number.isNaN(commission) || commission < 0) {
      toast.error("Comissão inválida.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.soldAt)) {
      toast.error("Data inválida.");
      return;
    }
    persist(
      {
        customerName: form.customer.trim() || null,
        platform: form.platform,
        totalCents: Math.round(total * 100),
        commissionCents: Math.round(commission * 100),
        soldAt: form.soldAt,
      },
      // updateSale expects money in REAIS (server converts to cents).
      {
        customerName: form.customer,
        platform: form.platform,
        total,
        commission,
        soldAt: form.soldAt,
      },
      "Venda atualizada.",
    );
    setEditing(false);
  }

  const notesDirty = notesDraft !== (sale.notes ?? "");

  return (
    <>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <SheetHeader className="border-b border-border p-5 pr-12 text-left">
        <SheetTitle className="flex items-center gap-2 font-mono text-base">
          VENDA #{orderCode(sale)}
          {cancelled && (
            <Badge variant="error" className="px-2 py-0 font-sans text-[10px]">
              Cancelada
            </Badge>
          )}
        </SheetTitle>
        <SheetDescription className="text-xs">
          {sale.customerName ?? "Sem cliente"} · {longDateBR(sale.soldAt)}
        </SheetDescription>
      </SheetHeader>

      {/* ─── Scrollable body ─────────────────────────────────────────────── */}
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {/* Status stepper (production pipeline) */}
        {cancelled ? (
          <div className="flex items-center gap-2 rounded-xl border border-error/30 bg-error-bg p-3 text-xs font-medium text-error-fg">
            <Warning className="h-4 w-4 shrink-0" aria-hidden />
            Pedido cancelado — fora do fluxo de produção.
          </div>
        ) : (
          <ol aria-label="Etapas de produção" className="flex items-start">
            {KANBAN_STAGES.map((stage, i) => {
              const done = i < currentIdx;
              const current = i === currentIdx;
              return (
                <Fragment key={stage}>
                  {i > 0 && (
                    <li
                      aria-hidden
                      className={`mt-3 h-px min-w-2 flex-1 ${
                        i <= currentIdx ? "bg-accent" : "bg-border"
                      }`}
                    />
                  )}
                  <li className="flex flex-col items-center gap-1">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold ${
                        done
                          ? "border-accent bg-accent text-accent-foreground"
                          : current
                            ? "border-accent bg-accent-soft text-accent ring-2 ring-accent/30"
                            : "border-border text-muted-foreground"
                      }`}
                    >
                      {done ? <Check className="h-3 w-3" weight="bold" aria-hidden /> : i + 1}
                    </span>
                    <span
                      className={`text-[10px] ${
                        current ? "font-semibold text-accent" : "text-muted-foreground"
                      }`}
                    >
                      {FULFILLMENT_LABEL[stage]}
                    </span>
                  </li>
                </Fragment>
              );
            })}
          </ol>
        )}

        {/* Inline edit form (compact — client/channel/values/date) */}
        {editing && (
          <div className="space-y-3 rounded-2xl border border-accent/40 bg-surface-elevated p-4">
            <p className="text-xs font-semibold">Editar venda</p>
            <div className="space-y-1.5">
              <Label htmlFor="d-cust">Cliente</Label>
              <Input
                id="d-cust"
                value={form.customer}
                onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))}
                placeholder="Nome do comprador"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Canal</Label>
                <Select
                  value={form.platform}
                  onValueChange={(v) => setForm((f) => ({ ...f, platform: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SALES_PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-date">Data</Label>
                <Input
                  id="d-date"
                  type="date"
                  value={form.soldAt}
                  onChange={(e) => setForm((f) => ({ ...f, soldAt: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="d-total">Valor total (R$)</Label>
                <Input
                  id="d-total"
                  inputMode="decimal"
                  value={form.total}
                  onChange={(e) => setForm((f) => ({ ...f, total: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-comm">Comissão (R$)</Label>
                <Input
                  id="d-comm"
                  inputMode="decimal"
                  value={form.commission}
                  onChange={(e) => setForm((f) => ({ ...f, commission: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={saveEdit}>
                <FloppyDisk className="h-3.5 w-3.5" />
                Salvar
              </Button>
            </div>
          </div>
        )}

        {/* Tabs: Detalhes · Itens · Docs */}
        <Tabs defaultValue="detalhes">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
            <TabsTrigger value="itens">Itens</TabsTrigger>
            <TabsTrigger value="docs">Docs</TabsTrigger>
          </TabsList>

          <TabsContent value="detalhes" className="mt-3 space-y-4">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Pagamento</span>
                <Badge variant={PAYMENT_VARIANT[sale.paymentStatus]} className="px-2 py-0 text-[10px]">
                  {PAYMENT_LABEL[sale.paymentStatus]}
                </Badge>
              </div>
              <Button size="sm" variant="secondary" onClick={togglePayment}>
                {sale.paymentStatus === "pago" ? "Marcar pendente" : "Marcar pago"}
              </Button>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
              <span className="text-xs text-muted-foreground">Frete</span>
              {/* Static for now — shipping ownership per-order is a later stage. */}
              <span className="text-xs font-medium">Cliente</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="d-notes">Notas</Label>
              <Textarea
                id="d-notes"
                rows={3}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Observações do pedido…"
              />
              {notesDirty && (
                <div className="flex justify-end">
                  <Button size="sm" variant="secondary" onClick={saveNotes}>
                    <FloppyDisk className="h-3.5 w-3.5" />
                    Salvar notas
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-border p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">{brl(sale.totalCents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Comissão do canal</span>
                <span className="font-mono">− {brl(sale.commissionCents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Custo de produção</span>
                {/* E5: per-order cost/margin computation lands in stage E5. */}
                <span className="font-mono text-muted-foreground">{brl(0)} · —</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="font-medium">Total</span>
                <span className="font-mono font-semibold">{brl(sale.totalCents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Lucro Líquido</span>
                <span className="font-mono font-semibold text-emerald-500">{brl(netCents)}</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="itens" className="mt-3">
            {/* No line-items model yet: a sale is a single order row. Real items
                arrive when sales link to products/quantities (future stage). */}
            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">1 item</span>
                <span className="font-mono text-xs font-semibold">{brl(sale.totalCents)}</span>
              </div>
              {sale.notes ? (
                <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">
                  {sale.notes}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Sem descrição do produto — use as notas em Detalhes.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="docs" className="mt-3">
            {/* Future: attachments (NF, etiquetas, arquivos de impressão). */}
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Nenhum documento
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Footer actions ──────────────────────────────────────────────── */}
      <div className="space-y-2 border-t border-border p-4">
        {nextStage && (
          <Button className="w-full" onClick={advanceStage}>
            Avançar para {FULFILLMENT_LABEL[nextStage]}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          {sale.paymentStatus !== "pago" && (
            <Button variant="secondary" onClick={togglePayment}>
              <Check className="h-4 w-4" />
              Marcar pago
            </Button>
          )}
          <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
            <PencilSimple className="h-4 w-4" />
            Editar venda
          </Button>
          <Button variant="ghost" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimir pedido
          </Button>
          {!cancelled && (
            <Button
              variant="ghost"
              className="text-error hover:bg-error-bg hover:text-error-fg"
              onClick={cancelSale}
            >
              <X className="h-4 w-4" />
              Cancelar
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
