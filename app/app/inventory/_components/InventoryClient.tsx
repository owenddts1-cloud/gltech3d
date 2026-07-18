"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toolbox, Printer, Receipt, Warning, Plus, Trash, PencilSimple, Drop } from "@/lib/ui/icons";
import {
  createInventoryAsset, updateInventoryAsset, deleteInventoryAsset,
  type InventoryAssetView, type InventoryData,
} from "@/app/actions/inventory/actions";
import type { ConsumablesData } from "@/app/actions/consumables/actions";
import { ConsumablesClient } from "@/app/app/consumables/_components/ConsumablesClient";
import { INVENTORY_CATEGORIES, INVENTORY_STATUSES, type InventoryCategory, type InventoryStatus } from "@/lib/schemas/inventory";

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const CATEGORY_LABEL: Record<InventoryCategory, string> = {
  impressora: "Impressora", ferramenta: "Ferramenta", movel: "Móvel",
  computador: "Computador", estufa: "Estufa", eletronico: "Eletrônico", outro: "Outro",
};

/** Sugestões de destino/uso (o campo é livre — datalist só sugere). */
const PURPOSE_SUGGESTIONS = ["Produção", "Manutenção", "Revenda", "Consumo", "Ferramenta", "Peça", "Insumo", "Outro"];

const STATUS_META: Record<InventoryStatus, { label: string; variant: "success" | "warning" | "neutral" }> = {
  ativo: { label: "Ativo", variant: "success" },
  manutencao: { label: "Manutenção", variant: "warning" },
  inativo: { label: "Inativo", variant: "neutral" },
};

export function InventoryClient({ data, consumables }: { data: InventoryData; consumables: ConsumablesData }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryAssetView | null>(null);
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<"ativos" | "consumiveis">("ativos");

  const { assets, kpis } = data;

  function onDelete(id: string) {
    startTransition(async () => {
      const res = await deleteInventoryAsset(id);
      if (!res.ok) toast.error(res.error || "Não foi possível excluir");
      else {
        toast.success("Ativo excluído");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6 p-6 mx-auto max-w-7xl animate-in fade-in duration-200">
      {/* Header */}
      <header className="relative overflow-hidden rounded-xl border border-border bg-surface p-6">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-24" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent border border-accent/20 shadow-sm">
              <Toolbox size={26} weight="duotone" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Inventário</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Ativos fixos (impressoras, ferramentas, móveis) e consumíveis (filamentos, resinas) da oficina.
              </p>
            </div>
          </div>
          {tab === "ativos" && (
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-1.5 font-semibold shadow-sm">
              <Plus size={16} weight="bold" /> Novo ativo
            </Button>
          )}
        </div>
      </header>

      {/* Sub-abas: Ativos | Consumíveis */}
      <div className="flex w-fit items-center gap-0.5 rounded-xl border border-border bg-muted/50 p-0.5">
        {([
          { key: "ativos", label: "Ativos", icon: Toolbox },
          { key: "consumiveis", label: "Consumíveis", icon: Drop },
        ] as const).map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${active ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon size={14} weight="duotone" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "consumiveis" ? (
        <ConsumablesClient data={consumables} embedded />
      ) : (
      <>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Ativos" value={String(kpis.totalAssets)} sub="itens cadastrados" icon={Toolbox} iconCls="bg-accent-soft text-accent" />
        <Kpi label="Patrimônio atual" value={brl(kpis.patrimonyCents)} sub="valor depreciado" icon={Receipt} iconCls="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
        <Kpi label="Impressoras" value={String(kpis.printers)} sub="como ativo" icon={Printer} iconCls="bg-accent-soft text-accent" />
        <Kpi label="Em manutenção" value={String(kpis.maintenance)} sub="fora de operação" icon={Warning} iconCls={kpis.maintenance > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"} />
      </div>

      {/* Table */}
      <Card className="overflow-hidden rounded-xl border border-border bg-surface p-0">
        {assets.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Toolbox size={22} weight="duotone" />
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground">Nenhum ativo cadastrado</p>
            <p className="mt-1 text-xs text-muted-foreground">Clique em “Novo ativo” para começar o patrimônio da oficina.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Ativo</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Destino/Uso</th>
                  <th className="px-4 py-3 text-right">Qtd</th>
                  <th className="px-4 py-3 text-right">Valor compra</th>
                  <th className="px-4 py-3 text-right">Valor atual</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => {
                  const s = STATUS_META[a.status];
                  return (
                    <tr
                      key={a.id}
                      onClick={() => { setEditing(a); setDialogOpen(true); }}
                      className="cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{a.name}</div>
                        {a.notes && <div className="truncate max-w-[240px] text-xs text-muted-foreground">{a.notes}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="neutral" className="text-[10px]">{CATEGORY_LABEL[a.category]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{a.purpose || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{a.quantity}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{brl(a.totalValueCents)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">{brl(a.currentValueCents)}</td>
                      <td className="px-4 py-3"><Badge variant={s.variant}>{s.label}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditing(a); setDialogOpen(true); }}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label="Editar"
                          >
                            <PencilSimple size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(a.id); }}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                            aria-label="Excluir"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      </>
      )}

      <AssetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => { setDialogOpen(false); router.refresh(); }}
      />
    </div>
  );
}

function Kpi({ label, value, sub, icon: Icon, iconCls }: { label: string; value: string; sub: string; icon: typeof Toolbox; iconCls: string }) {
  return (
    <Card className="p-5 rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconCls}`}>
          <Icon size={15} weight="duotone" />
        </div>
      </div>
      <div className="mt-3 text-[22px] font-bold leading-none tracking-tight text-foreground tabular-nums">{value}</div>
      <div className="mt-1.5 text-[10px] text-muted-foreground">{sub}</div>
    </Card>
  );
}

function AssetDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: InventoryAssetView | null;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<InventoryCategory>("outro");
  const [quantity, setQuantity] = useState("1");
  const [purchaseValue, setPurchaseValue] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [usefulLifeMonths, setUsefulLifeMonths] = useState("60");
  const [status, setStatus] = useState<InventoryStatus>("ativo");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");

  // Popula o form ao abrir (novo x edição).
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setCategory(editing.category);
      setQuantity(String(editing.quantity));
      setPurchaseValue((editing.purchaseValueCents / 100).toString());
      setPurchaseDate(editing.purchaseDate ?? "");
      setUsefulLifeMonths(String(editing.usefulLifeMonths));
      setStatus(editing.status);
      setPurpose(editing.purpose);
      setNotes(editing.notes);
    } else {
      setName(""); setCategory("outro"); setQuantity("1"); setPurchaseValue("");
      setPurchaseDate(""); setUsefulLifeMonths("60"); setStatus("ativo"); setPurpose(""); setNotes("");
    }
  }, [open, editing]);

  function submit() {
    if (!name.trim()) return toast.error("Informe o nome do ativo");
    const payload = {
      name: name.trim(),
      category,
      quantity: Number(quantity) || 1,
      purchaseValue: purchaseValue ? Number(purchaseValue.replace(",", ".")) : 0,
      purchaseDate: purchaseDate || null,
      usefulLifeMonths: Number(usefulLifeMonths) || 60,
      status,
      purpose: purpose.trim(),
      notes: notes.trim(),
    };
    startTransition(async () => {
      const res = editing
        ? await updateInventoryAsset(editing.id, payload)
        : await createInventoryAsset(payload);
      if (!res.ok) {
        toast.error(res.error || "Erro ao salvar");
        return;
      }
      toast.success(editing ? "Ativo atualizado" : "Ativo cadastrado");
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl border border-border bg-surface text-xs">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-foreground">{editing ? "Editar ativo" : "Novo ativo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">Nome</Label>
            <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Bambu Lab X1 Carbon" className="h-9 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-cat">Categoria</Label>
              <select id="inv-cat" value={category} onChange={(e) => setCategory(e.target.value as InventoryCategory)}
                className="flex h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs outline-hidden focus:ring-2 focus:ring-accent/20">
                {INVENTORY_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-status">Status</Label>
              <select id="inv-status" value={status} onChange={(e) => setStatus(e.target.value as InventoryStatus)}
                className="flex h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs outline-hidden focus:ring-2 focus:ring-accent/20">
                {INVENTORY_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-qty">Quantidade</Label>
              <Input id="inv-qty" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-9 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-val">Valor compra (R$/un)</Label>
              <Input id="inv-val" inputMode="decimal" value={purchaseValue} onChange={(e) => setPurchaseValue(e.target.value)} placeholder="0,00" className="h-9 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-date">Data de compra</Label>
              <Input id="inv-date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="h-9 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-life">Vida útil (meses)</Label>
              <Input id="inv-life" inputMode="numeric" value={usefulLifeMonths} onChange={(e) => setUsefulLifeMonths(e.target.value)} className="h-9 rounded-lg" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-purpose">Destino / Uso</Label>
            <Input id="inv-purpose" list="inv-purpose-list" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Ex: Produção, Manutenção, Revenda, Peça..." className="h-9 rounded-lg" />
            <datalist id="inv-purpose-list">
              {PURPOSE_SUGGESTIONS.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-notes">Notas</Label>
            <Input id="inv-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações, nº de série, localização..." className="h-9 rounded-lg" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" className="rounded-lg text-xs font-semibold" onClick={submit} disabled={pending}>
            {pending ? "Salvando..." : editing ? "Salvar" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
