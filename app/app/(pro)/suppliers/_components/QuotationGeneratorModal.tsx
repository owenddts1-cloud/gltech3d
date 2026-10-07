"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Phone, Receipt, Package, Plus, Trash, Warning } from "@/lib/ui/icons";
import type { SupplierView } from "@/app/actions/suppliers/actions";

export interface QuotationItem {
  name: string;
  qty: number;
}

export function buildQuotationWhatsAppUrl(supplierPhone: string, items: QuotationItem[], notes?: string) {
  const cleanPhone = supplierPhone.replace(/\D/g, "");
  const lines = [
    "Olá! Gostaria de solicitar uma cotação de compra para os seguintes insumos:",
    "",
    ...items.map((i) => `• ${i.name} — Qtd: ${i.qty}`),
  ];
  if (notes && notes.trim()) {
    lines.push("", `Observações: ${notes.trim()}`);
  }
  lines.push("", "Pode nos enviar os valores e prazos de entrega? Obrigado!");

  const message = lines.join("\n");
  const encoded = encodeURIComponent(message);
  return cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

interface QuotationGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: SupplierView[];
  filaments?: Array<{ id: string; name: string; weightGrams?: number; minWeightAlert?: number; supplier?: string }>;
}

export function QuotationGeneratorModal({
  open,
  onOpenChange,
  suppliers,
  filaments = [],
}: QuotationGeneratorModalProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [customPhone, setCustomPhone] = useState<string>("");
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [newItemName, setNewItemName] = useState<string>("");
  const [newItemQty, setNewItemQty] = useState<number>(1);
  const [notes, setNotes] = useState<string>("");

  const lowStockItems = useMemo(() => {
    return filaments.filter(
      (f) => Number(f.weightGrams ?? 0) <= Number(f.minWeightAlert ?? 0)
    );
  }, [filaments]);

  const activeSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === selectedSupplierId);
  }, [suppliers, selectedSupplierId]);

  const targetPhone = activeSupplier?.phone || customPhone;

  const whatsappUrl = useMemo(() => {
    return buildQuotationWhatsAppUrl(targetPhone, items, notes);
  }, [targetPhone, items, notes]);

  function handleAddLowStockItem(name: string) {
    if (items.some((i) => i.name === name)) return;
    setItems((prev) => [...prev, { name, qty: 1 }]);
  }

  function handleAddCustomItem() {
    if (!newItemName.trim()) return;
    setItems((prev) => [...prev, { name: newItemName.trim(), qty: Math.max(1, newItemQty) }]);
    setNewItemName("");
    setNewItemQty(1);
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleUpdateQty(index: number, qty: number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, qty: Math.max(1, qty) } : item))
    );
  }

  function handleCopyMessage() {
    const lines = [
      "Olá! Gostaria de solicitar uma cotação de compra para os seguintes insumos:",
      "",
      ...items.map((i) => `• ${i.name} — Qtd: ${i.qty}`),
    ];
    if (notes.trim()) lines.push("", `Observações: ${notes.trim()}`);
    lines.push("", "Pode nos enviar os valores e prazos de entrega? Obrigado!");

    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Mensagem de cotação copiada para a área de transferência!");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-surface border-border p-6 rounded-xl space-y-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Receipt className="h-5 w-5 text-accent" />
            Gerador de Cotação de Compras
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm text-foreground">
          {/* Supplier Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Fornecedor Cadastrado</Label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">Selecione um fornecedor...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phone ? `(${s.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Telefone / WhatsApp (Outro)</Label>
              <Input
                placeholder="Ex: 11999998888"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Low Stock Suggestions */}
          {lowStockItems.length > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-500">
                <Warning className="h-4 w-4" /> Insumos com Estoque Baixo ({lowStockItems.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {lowStockItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddLowStockItem(item.name)}
                    className="text-xs px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-md transition-colors flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Items List */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Itens da Cotação ({items.length})</Label>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum item adicionado à cotação ainda.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 p-2 bg-muted/40 border border-border/50 rounded-lg text-xs"
                  >
                    <span className="font-medium truncate flex-1">{item.name}</span>
                    <div className="flex items-center gap-1">
                      <Label className="text-[10px] text-muted-foreground">Qtd:</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(e) => handleUpdateQty(idx, parseInt(e.target.value) || 1)}
                        className="w-16 h-7 text-xs text-center"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(idx)}
                        className="h-7 w-7 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Custom Item */}
            <div className="flex items-center gap-2 pt-1">
              <Input
                placeholder="Nome do item / filamento..."
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="flex-1 text-xs"
              />
              <Input
                type="number"
                min={1}
                value={newItemQty}
                onChange={(e) => setNewItemQty(parseInt(e.target.value) || 1)}
                className="w-16 text-xs text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCustomItem}
                className="text-xs gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs text-muted-foreground">Observações Adicionais (opcional)</Label>
            <Input
              placeholder="Ex: Entrega para CEP 01000-000, pagamento via PIX..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={handleCopyMessage}
            disabled={items.length === 0}
            className="w-full sm:w-auto text-xs"
          >
            Copiar Texto
          </Button>
          <a
            href={items.length > 0 ? whatsappUrl : "#"}
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto"
          >
            <Button
              type="button"
              disabled={items.length === 0}
              className="w-full text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Phone className="h-4 w-4" /> Enviar via WhatsApp
            </Button>
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
