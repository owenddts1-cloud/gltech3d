"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, Trash, Cube } from "@/lib/ui/icons";
import { createProduct, deleteProduct, type ProductView } from "@/app/actions/products/actions";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Lite { id: string; name: string }
interface FilLite extends Lite { costPerGram: number }

export function ProductsClient({
  initialProducts, filaments, printers,
}: {
  initialProducts: ProductView[];
  filaments: FilLite[];
  printers: Lite[];
}) {
  const [products, setProducts] = useState<ProductView[]>(initialProducts);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const totals = useMemo(() => {
    const avgMargin = products.length
      ? Math.round(products.reduce((s, p) => s + p.marginPct, 0) / products.length)
      : 0;
    return { count: products.length, avgMargin };
  }, [products]);

  function onDelete(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    startTransition(async () => {
      const res = await deleteProduct(id);
      if (!res.ok) toast.error("Não foi possível excluir");
      else toast.success("Produto excluído");
    });
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Package size={26} weight="duotone" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {totals.count} produtos · margem média {totals.avgMargin}%
            </p>
          </div>
        </div>
        <NewProductDialog
          open={open}
          onOpenChange={setOpen}
          filaments={filaments}
          printers={printers}
          onCreated={(p) => setProducts((prev) => [p, ...prev])}
        />
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Cube size={32} className="mb-3 text-muted-foreground" weight="duotone" />
          <h3 className="text-base font-semibold">Nenhum produto no catálogo</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Cadastre um produto e o custo real (filamento + energia + depreciação + insumos) e o
            preço sugerido são calculados sozinhos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="group card-hover flex flex-col rounded-xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{p.name}</h3>
                  {p.category && <Badge variant="secondary" className="mt-1 text-[10px]">{p.category}</Badge>}
                </div>
                <button
                  onClick={() => onDelete(p.id)}
                  className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-error"
                  aria-label="Excluir produto"
                >
                  <Trash size={14} />
                </button>
              </div>

              {/* Breakdown do custo (BOM) */}
              <div className="mt-4 space-y-1 text-xs">
                <Row label={`Material${p.filamentName ? ` · ${p.filamentName}` : ""}`} value={brl(p.pricing.materialCost)} />
                <Row label="Energia" value={brl(p.pricing.energyCost)} />
                <Row label="Depreciação" value={brl(p.pricing.depreciationCost)} />
                {p.pricing.extrasCost > 0 && <Row label="Insumos" value={brl(p.pricing.extrasCost)} />}
                <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5 font-semibold text-text">
                  <span>Custo total</span>
                  <span className="tabular-nums">{brl(p.pricing.totalCost)}</span>
                </div>
              </div>

              {/* Preço sugerido */}
              <div className="mt-4 flex items-end justify-between rounded-lg bg-accent-soft/50 p-3">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Preço sugerido · margem {p.marginPct}%
                  </div>
                  <div className="text-xl font-bold text-accent tabular-nums">{brl(p.pricing.suggestedPrice)}</div>
                </div>
                <div className="text-right text-[11px] text-success-fg">
                  +{brl(p.pricing.profit)}<br />lucro
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span className="truncate pr-2">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function NewProductDialog({
  open, onOpenChange, filaments, printers, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filaments: FilLite[];
  printers: Lite[];
  onCreated: (p: ProductView) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [filamentId, setFilamentId] = useState("");
  const [grams, setGrams] = useState("");
  const [minutes, setMinutes] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [extra, setExtra] = useState("");
  const [margin, setMargin] = useState("100");
  const [pending, startTransition] = useTransition();

  function reset() {
    setName(""); setCategory(""); setFilamentId(""); setGrams(""); setMinutes("");
    setPrinterId(""); setExtra(""); setMargin("100");
  }

  function submit() {
    if (!name.trim()) return toast.error("Informe o nome do produto");
    const payload = {
      name: name.trim(),
      category: category.trim() || undefined,
      filamentClientId: filamentId || null,
      filamentGrams: grams ? Number(grams.replace(",", ".")) : 0,
      printTimeMinutes: minutes ? Number(minutes.replace(",", ".")) : 0,
      printerClientId: printerId || null,
      extraCost: extra ? Number(extra.replace(",", ".")) : 0,
      marginPct: margin ? Number(margin.replace(",", ".")) : 100,
    };
    startTransition(async () => {
      const res = await createProduct(payload);
      if (!res.ok) {
        toast.error(res.error || "Erro ao criar produto");
        return;
      }
      toast.success("Produto criado 🎉");
      onOpenChange(false);
      reset();
      // Refresh via full reload of computed pricing is simplest; do an optimistic
      // insert with zeroed pricing until revalidation reflects the real numbers.
      onCreated(buildOptimistic(payload, filaments));
    });
  }

  const selectCls = "flex h-9 w-full rounded-sm border border-border bg-surface px-3 text-sm";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button><Plus aria-hidden /> Novo produto</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Novo produto</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Nome</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Luminária Lua" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-cat">Categoria</Label>
              <Input id="p-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Luminárias" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-fil">Filamento</Label>
            <select id="p-fil" value={filamentId} onChange={(e) => setFilamentId(e.target.value)} className={selectCls}>
              <option value="">— Selecione —</option>
              {filaments.map((f) => (
                <option key={f.id} value={f.id}>{f.name} (R$ {f.costPerGram.toFixed(3)}/g)</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-grams">Gramas</Label>
              <Input id="p-grams" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="45" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-min">Tempo (min)</Label>
              <Input id="p-min" inputMode="decimal" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="180" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-prn">Impressora (depreciação)</Label>
            <select id="p-prn" value={printerId} onChange={(e) => setPrinterId(e.target.value)} className={selectCls}>
              <option value="">— Selecione —</option>
              {printers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-extra">Insumos (R$)</Label>
              <Input id="p-extra" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="2,50" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-margin">Margem (%)</Label>
              <Input id="p-margin" inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "Salvando…" : "Criar produto"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Optimistic card until the server revalidation returns computed pricing. */
function buildOptimistic(
  p: {
    name: string; category?: string; filamentClientId: string | null; filamentGrams: number;
    printTimeMinutes: number; printerClientId: string | null; extraCost: number; marginPct: number;
  },
  filaments: FilLite[],
): ProductView {
  const fil = filaments.find((f) => f.id === p.filamentClientId);
  const material = (fil?.costPerGram ?? 0) * p.filamentGrams;
  const extras = p.extraCost;
  const totalCost = Number((material + extras).toFixed(2));
  const suggestedPrice = Number((totalCost * (1 + p.marginPct / 100)).toFixed(2));
  return {
    id: crypto.randomUUID(),
    name: p.name,
    category: p.category ?? null,
    description: null,
    images: [],
    filamentClientId: p.filamentClientId,
    filamentName: fil?.name ?? null,
    filamentGrams: p.filamentGrams,
    printTimeSeconds: Math.round(p.printTimeMinutes * 60),
    printerClientId: p.printerClientId,
    extraCosts: extras > 0 ? [{ label: "Insumos", cost_cents: Math.round(extras * 100) }] : [],
    extraCostTotal: extras,
    marginPct: p.marginPct,
    salePriceCents: null,
    pricing: {
      materialCost: Number(material.toFixed(2)),
      energyCost: 0,
      depreciationCost: 0,
      extrasCost: extras,
      totalCost,
      suggestedPrice,
      profit: Number((suggestedPrice - totalCost).toFixed(2)),
    },
  };
}
