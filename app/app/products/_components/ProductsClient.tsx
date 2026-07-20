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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Package, Plus, Trash, Cube, PencilSimple, Storefront } from "@/lib/ui/icons";
import {
  createProduct, deleteProduct, updateProduct, type ProductView,
} from "@/app/actions/products/actions";
import type { ProductVariationGroup } from "@/lib/schemas/products-catalog";
import VariationsEditor from "./VariationsEditor";
import { ProductImages } from "./ProductImages";
import { Combobox } from "@/components/ui/combobox";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Lite { id: string; name: string }
interface FilLite extends Lite { costPerGram: number }

/** Shape shared by the create payload and the optimistic view builders. */
interface FormPayload {
  name: string;
  /** Always a string: "" clears the category on edit (server maps "" → null). */
  category: string;
  filamentClientId: string | null;
  filamentGrams: number;
  printTimeMinutes: number;
  printerClientId: string | null;
  extraCost: number;
  marginPct: number;
  isPublished: boolean;
  salePrice: number | null;
  variations: ProductVariationGroup[];
  observations: string;
  images: string[];
}

export function ProductsClient({
  initialProducts, filaments, printers,
}: {
  initialProducts: ProductView[];
  filaments: FilLite[];
  printers: Lite[];
}) {
  const [products, setProducts] = useState<ProductView[]>(initialProducts);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductView | null>(null);
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
        <ProductFormDialog
          open={open}
          onOpenChange={setOpen}
          product={null}
          filaments={filaments}
          printers={printers}
          onSaved={(p) => setProducts((prev) => [p, ...prev])}
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
                <div className="flex min-w-0 items-start gap-2.5">
                  {p.images[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.images[0]}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover"
                    />
                  )}
                  <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{p.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {p.category && <Badge variant="secondary" className="text-[10px]">{p.category}</Badge>}
                    {p.isPublished && (
                      <Badge variant="outline" className="gap-1 border-accent/40 text-[10px] text-accent">
                        <Storefront size={11} aria-hidden /> Na landing
                      </Badge>
                    )}
                  </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setEditing(p)}
                    className="text-muted-foreground hover:text-accent"
                    aria-label={`Editar ${p.name}`}
                  >
                    <PencilSimple size={14} />
                  </button>
                  <button
                    onClick={() => onDelete(p.id)}
                    className="text-muted-foreground hover:text-error"
                    aria-label="Excluir produto"
                  >
                    <Trash size={14} />
                  </button>
                </div>
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

      {editing && (
        <ProductFormDialog
          key={editing.id}
          open
          onOpenChange={(v) => { if (!v) setEditing(null); }}
          product={editing}
          filaments={filaments}
          printers={printers}
          onSaved={(updated) => {
            setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setEditing(null);
          }}
        />
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

function ProductFormDialog({
  open, onOpenChange, product, filaments, printers, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Null = create; a ProductView = edit that product. */
  product: ProductView | null;
  filaments: FilLite[];
  printers: Lite[];
  onSaved: (p: ProductView) => void;
}) {
  const isEdit = product !== null;
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [filamentId, setFilamentId] = useState(product?.filamentClientId ?? "");
  const [grams, setGrams] = useState(product ? String(product.filamentGrams) : "");
  const [minutes, setMinutes] = useState(
    product ? String(Math.round(product.printTimeSeconds / 60)) : "",
  );
  const [printerId, setPrinterId] = useState(product?.printerClientId ?? "");
  const [extra, setExtra] = useState(
    product && product.extraCostTotal > 0 ? String(product.extraCostTotal) : "",
  );
  const [margin, setMargin] = useState(product ? String(product.marginPct) : "100");
  const [salePrice, setSalePrice] = useState(
    product?.salePriceCents != null ? String(product.salePriceCents / 100) : "",
  );
  const [published, setPublished] = useState(product?.isPublished ?? false);
  const [variations, setVariations] = useState<ProductVariationGroup[]>(
    product?.variations ?? [],
  );
  const [observations, setObservations] = useState(product?.observations ?? "");
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [pending, startTransition] = useTransition();

  function reset() {
    setName(""); setCategory(""); setFilamentId(""); setGrams(""); setMinutes("");
    setPrinterId(""); setExtra(""); setMargin("100");
    setSalePrice(""); setPublished(false); setVariations([]); setObservations("");
    setImages([]);
  }

  function submit() {
    if (!name.trim()) return toast.error("Informe o nome do produto");
    const salePriceNum = salePrice.trim() ? Number(salePrice.replace(",", ".")) : null;
    const payload: FormPayload = {
      name: name.trim(),
      category: category.trim(),
      filamentClientId: filamentId || null,
      filamentGrams: grams ? Number(grams.replace(",", ".")) : 0,
      printTimeMinutes: minutes ? Number(minutes.replace(",", ".")) : 0,
      printerClientId: printerId || null,
      extraCost: extra ? Number(extra.replace(",", ".")) : 0,
      marginPct: margin ? Number(margin.replace(",", ".")) : 100,
      isPublished: published,
      salePrice: salePriceNum,
      // Groups without a name would fail Zod server-side; drop them silently.
      variations: variations
        .map((g) => ({ name: g.name.trim(), options: g.options }))
        .filter((g) => g.name.length > 0),
      observations: observations.trim(),
      images,
    };
    startTransition(async () => {
      const res = isEdit ? await updateProduct(product.id, payload) : await createProduct(payload);
      if (!res.ok) {
        toast.error(res.error || "Erro ao salvar produto");
        // Publishing requires a price: mirror the server rule and drop the toggle.
        if (payload.isPublished && (payload.salePrice == null || payload.salePrice <= 0)) {
          setPublished(false);
        }
        return;
      }
      toast.success(isEdit ? "Produto atualizado" : "Produto criado 🎉");
      onOpenChange(false);
      if (!isEdit) reset();
      // Refresh via full reload of computed pricing is simplest; do an optimistic
      // insert/merge with approximate pricing until revalidation reflects the
      // real numbers.
      onSaved(isEdit ? mergeOptimistic(product, payload, filaments) : buildOptimistic(payload, filaments));
    });
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!isEdit && (
        <DialogTrigger asChild>
          <Button><Plus aria-hidden /> Novo produto</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Fotos</Label>
            <ProductImages images={images} onChange={setImages} />
          </div>
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
            <Combobox
              id="p-fil"
              value={filamentId}
              onChange={setFilamentId}
              options={[
                { value: "", label: "— Selecione —" },
                ...filaments.map((f) => ({ value: f.id, label: f.name, hint: `R$ ${f.costPerGram.toFixed(3)}/g` })),
              ]}
              searchPlaceholder="Buscar filamento…"
            />
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
            <Combobox
              id="p-prn"
              value={printerId}
              onChange={setPrinterId}
              options={[
                { value: "", label: "— Selecione —" },
                ...printers.map((p) => ({ value: p.id, label: p.name })),
              ]}
              searchPlaceholder="Buscar impressora…"
            />
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

          {/* ── Vitrine (landing) ─────────────────────────────────────── */}
          <div className="space-y-3 border-t border-border pt-4">
            <div className="grid grid-cols-2 items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-price">Preço de venda (R$)</Label>
                <Input
                  id="p-price"
                  inputMode="decimal"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="49,90"
                />
              </div>
              <div className="flex h-9 items-center justify-between rounded-sm border border-border bg-surface px-3">
                <Label htmlFor="p-pub" className="text-xs font-medium">Visível na landing</Label>
                <Switch id="p-pub" checked={published} onCheckedChange={setPublished} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Publicar na landing exige um preço de venda definido.
            </p>

            <div className="space-y-1.5">
              <Label>Variações (vitrine)</Label>
              <VariationsEditor value={variations} onChange={setVariations} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-obs">Observações (interno)</Label>
              <Textarea
                id="p-obs"
                rows={3}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Anotações da produção, fornecedor, ajustes de slicer…"
              />
              <p className="text-[11px] text-muted-foreground">
                Uso interno do CRM — nunca aparece na landing.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar produto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Optimistic card until the server revalidation returns computed pricing. */
function buildOptimistic(p: FormPayload, filaments: FilLite[]): ProductView {
  const fil = filaments.find((f) => f.id === p.filamentClientId);
  const material = (fil?.costPerGram ?? 0) * p.filamentGrams;
  const extras = p.extraCost;
  const totalCost = Number((material + extras).toFixed(2));
  const suggestedPrice = Number((totalCost * (1 + p.marginPct / 100)).toFixed(2));
  return {
    id: crypto.randomUUID(),
    name: p.name,
    category: p.category || null,
    categoryId: null,
    categoryName: p.category || null,
    description: null,
    images: p.images,
    filamentClientId: p.filamentClientId,
    filamentName: fil?.name ?? null,
    filamentGrams: p.filamentGrams,
    printTimeSeconds: Math.round(p.printTimeMinutes * 60),
    printerClientId: p.printerClientId,
    extraCosts: extras > 0 ? [{ label: "Insumos", cost_cents: Math.round(extras * 100) }] : [],
    extraCostTotal: extras,
    marginPct: p.marginPct,
    salePriceCents: p.salePrice == null ? null : Math.round(p.salePrice * 100),
    isPublished: p.isPublished,
    variations: p.variations,
    observations: p.observations.trim() || null,
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

/**
 * Optimistic merge for edits. Material/extras are recomputed; energy and
 * depreciation are kept from the previous pricing (server recomputes on
 * revalidation) so the card does not visually zero out.
 */
function mergeOptimistic(base: ProductView, p: FormPayload, filaments: FilLite[]): ProductView {
  const fresh = buildOptimistic(p, filaments);
  const material = fresh.pricing.materialCost;
  const energy = base.pricing.energyCost;
  const depreciation = base.pricing.depreciationCost;
  const extras = p.extraCost;
  const totalCost = Number((material + energy + depreciation + extras).toFixed(2));
  const suggestedPrice = Number((totalCost * (1 + p.marginPct / 100)).toFixed(2));
  return {
    ...fresh,
    id: base.id,
    description: base.description,
    images: p.images,
    categoryId: base.categoryId,
    categoryName: base.categoryName,
    pricing: {
      materialCost: material,
      energyCost: energy,
      depreciationCost: depreciation,
      extrasCost: extras,
      totalCost,
      suggestedPrice,
      profit: Number((suggestedPrice - totalCost).toFixed(2)),
    },
  };
}
