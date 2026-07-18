"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Drop, Plus, Trash, Package, Receipt } from "@/lib/ui/icons";
import { toast } from "sonner";
import {
  createConsumable, updateConsumable, deleteConsumable,
  type ConsumablesData, type ConsumableView,
} from "@/app/actions/consumables/actions";
import { CONSUMABLE_CATEGORIES, type ConsumableCategory } from "@/lib/schemas/consumables";

const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);
const kg = (grams: number) => `${(grams / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;

const CAT_LABEL: Record<ConsumableCategory, string> = { filamento: "Filamento", resina: "Resina", outro: "Outro" };

export function ConsumablesClient({ data, embedded = false }: { data: ConsumablesData; embedded?: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ConsumableView | null>(null);

  function openNew() { setEditing(null); setDialogOpen(true); }
  function openEdit(item: ConsumableView) { setEditing(item); setDialogOpen(true); }

  function handleDelete(id: string) {
    if (!confirm("Remover este consumível?")) return;
    startTransition(async () => {
      const res = await deleteConsumable(id);
      if (!res.ok) { toast.error(res.error || "Erro ao remover"); return; }
      toast.success("Consumível removido.");
      router.refresh();
    });
  }

  return (
    <div className={embedded ? "space-y-4" : "space-y-6 p-6 mx-auto max-w-7xl animate-in fade-in duration-300"}>
      {/* Header — completo na rota própria, compacto quando embutido no Inventário */}
      {embedded ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Filamentos e resinas — estoque em gramas, custo por kg e alerta de reposição.</p>
          <Button size="sm" className="h-9 rounded-lg gap-1.5 font-bold" onClick={openNew}>
            <Plus size={14} weight="bold" /> Novo consumível
          </Button>
        </div>
      ) : (
        <header className="relative overflow-hidden rounded-xl border border-border bg-surface p-6">
          <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-24" aria-hidden />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent border border-accent/20 shadow-sm">
                <Drop size={26} weight="duotone" aria-hidden />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Consumíveis</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Filamentos e resinas — estoque em gramas, custo por kg e alerta de reposição.
                </p>
              </div>
            </div>
            <Button size="sm" className="h-9 rounded-lg gap-1.5 font-bold" onClick={openNew}>
              <Plus size={14} weight="bold" /> Novo consumível
            </Button>
          </div>
        </header>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Itens cadastrados" value={String(data.kpis.total)} icon={Package} cls="text-primary" />
        <Kpi label="Estoque baixo" value={String(data.kpis.lowStock)} icon={Drop} cls={data.kpis.lowStock > 0 ? "text-amber-500" : "text-emerald-500"} sub="no/abaixo do mínimo" />
        <Kpi label="Capital em estoque" value={brl(data.kpis.stockValueCents)} icon={Receipt} cls="text-emerald-500" />
        <Kpi label="Estoque total" value={`${data.kpis.totalKg} kg`} icon={Package} cls="text-cyan-500" />
      </div>

      {/* Table */}
      <Card className="p-5 rounded-xl border border-border bg-surface">
        {data.items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhum consumível ainda. Cadastre um, ou use <strong>Sincronizar</strong> na planilha de Controle.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-bold">
                  <th className="py-3 px-3">Nome</th>
                  <th className="py-3 px-3">Categoria</th>
                  <th className="py-3 px-3">Material / Cor</th>
                  <th className="py-3 px-3">Destino</th>
                  <th className="py-3 px-3 text-right">Estoque</th>
                  <th className="py-3 px-3 text-right">Custo/kg</th>
                  <th className="py-3 px-3 text-right">Valor</th>
                  <th className="py-3 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.id} className="border-b border-border/40 hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-foreground">
                      <button onClick={() => openEdit(it)} className="hover:text-accent transition-colors text-left">{it.name}</button>
                    </td>
                    <td className="py-3 px-3"><Badge variant="secondary" className="font-normal">{CAT_LABEL[it.category]}</Badge></td>
                    <td className="py-3 px-3 text-muted-foreground">{[it.material, it.color].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="py-3 px-3 text-muted-foreground">{it.purpose || "—"}</td>
                    <td className="py-3 px-3 text-right font-mono">
                      <span className={it.low ? "text-amber-600 dark:text-amber-400 font-bold" : "text-foreground"}>{kg(it.stockGrams)}</span>
                      {it.low && <Badge variant="secondary" className="ml-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px]">baixo</Badge>}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-muted-foreground">{brl(it.costPerKgCents)}</td>
                    <td className="py-3 px-3 text-right font-mono text-foreground font-semibold">{brl(it.stockValueCents)}</td>
                    <td className="py-3 px-3 text-right">
                      <button onClick={() => handleDelete(it.id)} aria-label="Remover" className="text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 p-1 rounded-md transition-colors">
                        <Trash size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConsumableDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => { setDialogOpen(false); router.refresh(); }}
      />
    </div>
  );
}

function Kpi({ label, value, icon: Icon, cls, sub }: { label: string; value: string; icon: typeof Drop; cls: string; sub?: string }) {
  return (
    <Card className="p-4 rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        <Icon size={14} className={cls} />
      </div>
      <span className="mt-2 block text-2xl font-extrabold text-foreground tabular-nums truncate">{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground block mt-0.5">{sub}</span>}
    </Card>
  );
}

function ConsumableDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: ConsumableView | null; onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState(() => defaults(editing));
  // Re-sincroniza o form quando abre para um item diferente.
  const [lastId, setLastId] = useState<string | null>(editing?.id ?? null);
  if (open && (editing?.id ?? null) !== lastId) {
    setLastId(editing?.id ?? null);
    setF(defaults(editing));
  }

  const set = (k: keyof ReturnType<typeof defaults>) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  function submit() {
    if (!f.name.trim()) return toast.error("Informe o nome");
    startTransition(async () => {
      const payload = {
        name: f.name.trim(), category: f.category, material: f.material, color: f.color,
        stockGrams: Number(f.stockGrams) || 0, minStockGrams: Number(f.minStockGrams) || 0,
        costPerKg: Number(f.costPerKg) || 0, supplier: f.supplier, purpose: f.purpose, notes: f.notes,
      };
      const res = editing ? await updateConsumable(editing.id, payload) : await createConsumable(payload);
      if (!res.ok) { toast.error(res.error || "Erro ao salvar"); return; }
      toast.success(editing ? "Consumível atualizado." : "Consumível criado.");
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-xl border border-border bg-surface text-xs">
        <DialogHeader><DialogTitle className="text-sm font-bold text-foreground">{editing ? "Editar consumível" : "Novo consumível"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label>Nome</Label><Input value={f.name} onChange={set("name")} placeholder="Ex: PLA Premium Preto" className="h-9 rounded-lg" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <select value={f.category} onChange={(e) => setF((p) => ({ ...p, category: e.target.value as ConsumableCategory }))}
                className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs outline-none focus:ring-2 focus:ring-accent/20">
                {CONSUMABLE_CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label>Material</Label><Input value={f.material} onChange={set("material")} placeholder="PLA, ABS, PETG..." className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5"><Label>Cor</Label><Input value={f.color} onChange={set("color")} placeholder="Preto, Branco..." className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5"><Label>Fornecedor</Label><Input value={f.supplier} onChange={set("supplier")} className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5"><Label>Estoque (g)</Label><Input inputMode="decimal" value={f.stockGrams} onChange={set("stockGrams")} className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5"><Label>Mínimo (g)</Label><Input inputMode="decimal" value={f.minStockGrams} onChange={set("minStockGrams")} className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5"><Label>Custo (R$/kg)</Label><Input inputMode="decimal" value={f.costPerKg} onChange={set("costPerKg")} className="h-9 rounded-lg" /></div>
            <div className="space-y-1.5">
              <Label>Destino / Uso</Label>
              <Input list="cons-purpose-list" value={f.purpose} onChange={set("purpose")} placeholder="Ex: Consumo, Produção..." className="h-9 rounded-lg" />
              <datalist id="cons-purpose-list">
                {["Consumo", "Produção", "Revenda", "Outro"].map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Notas</Label><Input value={f.notes} onChange={set("notes")} className="h-9 rounded-lg" /></div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" className="rounded-lg text-xs font-semibold" onClick={submit} disabled={pending}>{pending ? "Salvando..." : editing ? "Salvar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function defaults(editing: ConsumableView | null) {
  return {
    name: editing?.name ?? "",
    category: (editing?.category ?? "filamento") as ConsumableCategory,
    material: editing?.material ?? "",
    color: editing?.color ?? "",
    stockGrams: String(editing?.stockGrams ?? ""),
    minStockGrams: String(editing?.minStockGrams ?? ""),
    costPerKg: editing ? String(editing.costPerKgCents / 100) : "",
    supplier: editing?.supplier ?? "",
    purpose: editing?.purpose ?? "",
    notes: editing?.notes ?? "",
  };
}
