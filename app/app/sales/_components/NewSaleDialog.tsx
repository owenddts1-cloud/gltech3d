"use client";

/**
 * "Nova venda" dialog — extracted verbatim from the old SalesClient (same
 * behavior, same createSale contract). Only the trigger label and the icon
 * source (@/lib/ui/icons, ADR-05) changed in stage E1.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { ContactPicker } from "./ContactPicker";
import { createSale } from "@/app/actions/sales/actions";
import type { ContactOption } from "@/app/actions/contacts/actions";
import { quickCreateSaleChannel, type SaleChannelOption } from "@/app/actions/sale-channels/actions";
import {
  SALES_STATUSES,
  type SaleProductOption,
  type SaleRow,
} from "@/lib/sales/config";
import { STATUS_LABEL } from "../_lib/view-model";

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

const brl = (cents: number): string =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fixedPlatform?: string;
  /** Catálogo p/ vincular produto (custo/margem reais — E5). */
  productOptions?: SaleProductOption[];
  /** Contatos da org — combobox de cliente com busca + "Outro cliente". */
  contactOptions?: ContactOption[];
  /** Canais de venda da org — combobox de canal com busca + "novo canal". */
  channelOptions?: SaleChannelOption[];
  onChannelCreated?: (c: SaleChannelOption) => void;
  onCreated: (s: SaleRow) => void;
}

export default function NewSaleDialog({
  open,
  onOpenChange,
  fixedPlatform,
  productOptions = [],
  contactOptions = [],
  channelOptions = [],
  onChannelCreated,
  onCreated,
}: Props) {
  const [platform, setPlatform] = useState(fixedPlatform ?? channelOptions[0]?.name ?? "");
  const [contactId, setContactId] = useState("");
  const [customer, setCustomer] = useState("");
  const [status, setStatus] = useState("pago");
  const [total, setTotal] = useState("");
  const [commission, setCommission] = useState("");
  const [soldAt, setSoldAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [saving, setSaving] = useState(false);

  // Lucro Estimado ao vivo: total − comissão − (custo do produto vinculado × qtd).
  // Comissão continua sendo o campo real (taxa do canal) — isto é só um preview.
  const totalCents = Math.round((Number(total.replace(",", ".")) || 0) * 100);
  const commissionCents = Math.round((Number(commission.replace(",", ".")) || 0) * 100);
  const selectedProduct = productOptions.find((p) => p.id === productId);
  const productCostCents = selectedProduct ? selectedProduct.unitCostCents * (Number(qty) || 1) : 0;
  const estimatedProfitCents = totalCents - commissionCents - productCostCents;

  async function submit() {
    if (!total.trim()) {
      toast.error("Informe o valor total.");
      return;
    }
    setSaving(true);
    const chosenPlatform = fixedPlatform ?? platform;
    const channelId = channelOptions.find((c) => c.name === chosenPlatform)?.id ?? null;
    const r = await createSale({
      platform: chosenPlatform,
      channelId,
      contactId: contactId || null,
      customerName: customer,
      status,
      total: Number(total.replace(",", ".")),
      commission: commission ? Number(commission.replace(",", ".")) : 0,
      soldAt,
      notes,
      productId: productId || null,
      qty: Number(qty) || 1,
    });
    setSaving(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    onCreated(r.sale);
    toast.success("Venda lançada.");
    setContactId("");
    setCustomer("");
    setTotal("");
    setCommission("");
    setNotes("");
    setProductId("");
    setQty("1");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" />
          Nova venda
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lançar venda{fixedPlatform ? ` · ${fixedPlatform}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!fixedPlatform && (
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Combobox
                value={platform}
                onChange={setPlatform}
                options={channelOptions.map((c) => ({ value: c.name, label: c.name }))}
                searchPlaceholder="Buscar ou digitar novo canal…"
                allowCreate={channelAllowCreate((c) => {
                  onChannelCreated?.(c);
                  setPlatform(c.name);
                })}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-total">Valor total (R$)</Label>
              <Input
                id="s-total"
                inputMode="decimal"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-comm">Comissão (R$)</Label>
              <Input
                id="s-comm"
                inputMode="decimal"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-date">Data</Label>
              <Input id="s-date" type="date" value={soldAt} onChange={(e) => setSoldAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Combobox
                value={status}
                onChange={setStatus}
                options={SALES_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] ?? s }))}
                searchPlaceholder="Buscar status…"
              />
            </div>
          </div>
          {/* Produto do catálogo (opcional) — liga o custo real da engine à venda. */}
          {productOptions.length > 0 && (
            <div className="grid grid-cols-[1fr_84px] gap-3">
              <div className="space-y-1.5">
                <Label>Produto (opcional)</Label>
                <Combobox
                  value={productId}
                  onChange={setProductId}
                  options={[
                    { value: "", label: "— Sem produto —" },
                    ...productOptions.map((p) => ({
                      value: p.id,
                      label: p.name,
                      hint: `custo ${(p.unitCostCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/un`,
                    })),
                  ]}
                  searchPlaceholder="Buscar produto…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-qty">Qtd</Label>
                <Input id="s-qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="s-cust">Cliente</Label>
            <ContactPicker
              id="s-cust"
              contacts={contactOptions}
              value={contactId}
              onChange={(id, name) => {
                setContactId(id);
                setCustomer(name);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-notes">Observações (opcional)</Label>
            <Textarea id="s-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* Preview ao vivo — não é gravado, só orienta antes de lançar. */}
          {totalCents > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs">
              <span className="font-medium text-muted-foreground">Lucro Estimado</span>
              <span className={`font-mono font-semibold ${estimatedProfitCents >= 0 ? "text-emerald-500" : "text-error-fg"}`}>
                {brl(estimatedProfitCents)}
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando…" : "Lançar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
