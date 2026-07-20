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
import { Combobox } from "@/components/ui/combobox";
import { createSale } from "@/app/actions/sales/actions";
import {
  SALES_PLATFORMS,
  SALES_STATUSES,
  type SaleProductOption,
  type SaleRow,
} from "@/lib/sales/config";
import { STATUS_LABEL } from "../_lib/view-model";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fixedPlatform?: string;
  /** Catálogo p/ vincular produto (custo/margem reais — E5). */
  productOptions?: SaleProductOption[];
  onCreated: (s: SaleRow) => void;
}

export default function NewSaleDialog({ open, onOpenChange, fixedPlatform, productOptions = [], onCreated }: Props) {
  const [platform, setPlatform] = useState(fixedPlatform ?? "Shopee");
  const [customer, setCustomer] = useState("");
  const [status, setStatus] = useState("pago");
  const [total, setTotal] = useState("");
  const [commission, setCommission] = useState("");
  const [soldAt, setSoldAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!total.trim()) {
      toast.error("Informe o valor total.");
      return;
    }
    setSaving(true);
    const r = await createSale({
      platform: fixedPlatform ?? platform,
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
                options={SALES_PLATFORMS.map((p) => ({ value: p, label: p }))}
                searchPlaceholder="Buscar canal…"
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
            <Label htmlFor="s-cust">Cliente (opcional)</Label>
            <Input
              id="s-cust"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Nome do comprador"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-notes">Observações (opcional)</Label>
            <Textarea id="s-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
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
