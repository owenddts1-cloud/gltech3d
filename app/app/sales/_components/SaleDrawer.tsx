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
  type SalePayment,
  type SaleProductOption,
  type SaleRow,
} from "@/lib/sales/config";
import { brl, orderCode } from "../_lib/view-model";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { ContactPicker } from "./ContactPicker";
import type { ContactOption } from "@/app/actions/contacts/actions";
import { quickCreateSaleChannel, type SaleChannelOption } from "@/app/actions/sale-channels/actions";

/** allowCreate do combobox de canal: cadastra um canal de venda novo pra org. */
function channelAllowCreate(onCreated: (c: SaleChannelOption) => void) {
  return {
    label: (q: string) => `Adicionar "${q}" como novo canal`,
    onCreate: async (name: string): Promise<ComboboxOption | null> => {
      const res = await quickCreateSaleChannel({ name });
      if (!res.ok) {
        toast.error(res.error);
        return null;
      }
      if (!res.existed) {
        toast.success("Canal de venda criado.");
        onCreated(res.channel);
      }
      return { value: res.channel.name, label: res.channel.name };
    },
  };
}

interface Props {
  /** Null = drawer closed. */
  sale: SaleRow | null;
  onClose: () => void;
  /** Applies a partial patch to one sale in the parent state (optimistic + rollback). */
  onPatch: (id: string, patch: Partial<SaleRow>) => void;
  /** Catálogo p/ vincular produto (custo/margem reais — E5). */
  productOptions?: SaleProductOption[];
  /** Contatos da org — combobox de cliente com busca + "Outro cliente". */
  contactOptions?: ContactOption[];
  /** Canais de venda da org — combobox de canal com busca + "novo canal". */
  channelOptions?: SaleChannelOption[];
  onChannelCreated?: (c: SaleChannelOption) => void;
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

export default function SaleDrawer({
  sale,
  onClose,
  onPatch,
  productOptions = [],
  contactOptions = [],
  channelOptions = [],
  onChannelCreated,
}: Props) {
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
          <SaleDrawerBody
            key={sale.id}
            sale={sale}
            onPatch={onPatch}
            productOptions={productOptions}
            contactOptions={contactOptions}
            channelOptions={channelOptions}
            onChannelCreated={onChannelCreated ?? (() => {})}
          />
        </SheetContent>
      )}
    </Sheet>
  );
}

function SaleDrawerBody({
  sale,
  onPatch,
  productOptions,
  contactOptions,
  channelOptions,
  onChannelCreated,
}: {
  sale: SaleRow;
  onPatch: (id: string, patch: Partial<SaleRow>) => void;
  productOptions: SaleProductOption[];
  contactOptions: ContactOption[];
  channelOptions: SaleChannelOption[];
  onChannelCreated: (c: SaleChannelOption) => void;
}) {
  const [notesDraft, setNotesDraft] = useState(sale.notes ?? "");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => ({
    contactId: sale.contactId ?? "",
    customer: sale.customerName ?? "",
    platform: sale.platform,
    total: centsToInput(sale.totalCents),
    commission: centsToInput(sale.commissionCents),
    soldAt: sale.soldAt,
  }));

  // Lucro Estimado ao vivo no form de edição — mesma fórmula do E5/NewSaleDialog.
  const editTotalCents = Math.round((Number(form.total.replace(",", ".")) || 0) * 100);
  const editCommissionCents = Math.round((Number(form.commission.replace(",", ".")) || 0) * 100);
  const editProductCostCents = sale.productId
    ? (productOptions.find((p) => p.id === sale.productId)?.unitCostCents ?? 0) * sale.qty
    : 0;
  const editEstimatedProfitCents = editTotalCents - editCommissionCents - editProductCostCents;

  const cancelled = sale.fulfillmentStatus === "cancelada";
  const currentIdx = KANBAN_STAGES.indexOf(sale.fulfillmentStatus);
  const nextStage = cancelled ? undefined : KANBAN_STAGES[currentIdx + 1];
  // Líquido REAL (E5): total − comissão − custo de produção (quando conhecido).
  const netCents = sale.totalCents - sale.commissionCents - (sale.costCents ?? 0);
  const marginPct = sale.totalCents > 0 ? (netCents / sale.totalCents) * 100 : null;

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

  /** Vincula/desvincula produto (e qty) — custo recalculado do catálogo. */
  function linkProduct(nextProductId: string, nextQty: number) {
    const info = nextProductId ? productOptions.find((p) => p.id === nextProductId) : undefined;
    persist(
      {
        productId: nextProductId || null,
        productName: info?.name ?? null,
        qty: nextQty,
        costCents: info ? info.unitCostCents * nextQty : null,
      },
      { productId: nextProductId || null, qty: nextQty },
      info ? `Produto vinculado — custo ${brl(info.unitCostCents * nextQty)}.` : "Produto desvinculado.",
    );
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
    const channelId = channelOptions.find((c) => c.name === form.platform)?.id ?? null;
    persist(
      {
        contactId: form.contactId || null,
        customerName: form.customer.trim() || null,
        platform: form.platform,
        channelId,
        totalCents: Math.round(total * 100),
        commissionCents: Math.round(commission * 100),
        soldAt: form.soldAt,
      },
      // updateSale expects money in REAIS (server converts to cents).
      {
        contactId: form.contactId || null,
        customerName: form.customer,
        platform: form.platform,
        channelId,
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
              <ContactPicker
                id="d-cust"
                contacts={contactOptions}
                value={form.contactId}
                onChange={(id, name) => setForm((f) => ({ ...f, contactId: id, customer: name }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Canal</Label>
                <Combobox
                  className="h-9 text-xs"
                  value={form.platform}
                  onChange={(v) => setForm((f) => ({ ...f, platform: v }))}
                  options={channelOptions.map((c) => ({ value: c.name, label: c.name }))}
                  searchPlaceholder="Buscar ou digitar novo canal…"
                  allowCreate={channelAllowCreate((c) => {
                    onChannelCreated(c);
                    setForm((f) => ({ ...f, platform: c.name }));
                  })}
                />
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
            {/* Preview ao vivo — não é gravado, só orienta antes de salvar. */}
            {editTotalCents > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs">
                <span className="font-medium text-muted-foreground">Lucro Estimado</span>
                <span
                  className={`font-mono font-semibold ${editEstimatedProfitCents >= 0 ? "text-emerald-500" : "text-error-fg"}`}
                >
                  {brl(editEstimatedProfitCents)}
                </span>
              </div>
            )}

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

            {/* Produto do catálogo — vínculo que dá o custo/margem reais (E5). */}
            {productOptions.length > 0 && (
              <div className="space-y-2 rounded-xl border border-border p-3">
                <div className="grid grid-cols-[1fr_72px] items-end gap-2">
                  <div className="space-y-1.5">
                    <Label>Produto</Label>
                    <Combobox
                      className="h-9 text-xs"
                      value={sale.productId ?? ""}
                      onChange={(v) => linkProduct(v, sale.qty)}
                      options={[
                        { value: "", label: "— Sem produto —" },
                        ...productOptions.map((p) => ({
                          value: p.id,
                          label: p.name,
                          hint: `custo ${brl(p.unitCostCents)}/un`,
                        })),
                      ]}
                      searchPlaceholder="Buscar produto…"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="d-qty">Qtd</Label>
                    <Input
                      id="d-qty"
                      inputMode="numeric"
                      defaultValue={String(sale.qty)}
                      onBlur={(e) => {
                        const q = Math.max(1, Number(e.target.value) || 1);
                        if (q !== sale.qty) linkProduct(sale.productId ?? "", q);
                      }}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

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
                {sale.costCents != null ? (
                  <span className="font-mono">
                    − {brl(sale.costCents)}
                    {sale.productName ? (
                      <span className="ml-1 text-muted-foreground">· {sale.qty}× {sale.productName}</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="font-mono text-muted-foreground">— vincule um produto</span>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="font-medium">Total</span>
                <span className="font-mono font-semibold">{brl(sale.totalCents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Lucro Líquido</span>
                <span className={`font-mono font-semibold ${netCents >= 0 ? "text-emerald-500" : "text-error-fg"}`}>
                  {brl(netCents)}
                  {marginPct !== null && sale.costCents != null && (
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                      ({marginPct.toFixed(1).replace(".", ",")}%)
                    </span>
                  )}
                </span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="itens" className="mt-3">
            {/* No line-items model yet: a sale is a single order row. Real items
                arrive when sales link to products/quantities (future stage). */}
            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">
                  {sale.productName ? `${sale.qty}× ${sale.productName}` : "1 item"}
                </span>
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
