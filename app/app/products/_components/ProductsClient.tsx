"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, Trash, Cube, PencilSimple, Storefront, VideoCamera, Warning } from "@/lib/ui/icons";
import { dataMesh } from "@/lib/mesh/data-mesh";
import {
  createProduct, deleteProduct, updateProduct, fetchProductsData, type ProductView,
} from "@/app/actions/products/actions";
import { brlFromReais } from "@/lib/format/money";
import {
  ProductFormDialog,
  type FilamentLite,
  type PrinterLite,
  type ProductFormPayload,
} from "./ProductFormDialog";

/**
 * Peça sem gramas OU sem tempo tem custo necessariamente zero — a fórmula não
 * tem de onde tirar material, energia nem depreciação. Marcar isso é o que
 * transforma "18 cards zerados" numa lista de pendências acionável.
 */
function costPending(p: ProductView): boolean {
  return p.filamentGrams <= 0 || p.printTimeSeconds <= 0;
}

export function ProductsClient({
  initialProducts, filaments, printers, globalLinks, kEnergy,
}: {
  initialProducts: ProductView[];
  filaments: FilamentLite[];
  printers: PrinterLite[];
  globalLinks: Record<string, string>;
  kEnergy: number;
}) {
  const [products, setProducts] = useState<ProductView[]>(initialProducts);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const totals = useMemo(() => {
    const avgMargin = products.length
      ? Math.round(products.reduce((s, p) => s + p.marginPct, 0) / products.length)
      : 0;
    return { count: products.length, avgMargin, pending: products.filter(costPending).length };
  }, [products]);

  const editing = products.find((p) => p.id === editingId) ?? null;

  /**
   * Próxima peça com custo pendente, começando depois da atual. É o que faz
   * "Salvar e próxima" percorrer só o que falta em vez de tudo.
   */
  function nextPendingAfter(id: string): string | null {
    const index = products.findIndex((p) => p.id === id);
    const ordered = [...products.slice(index + 1), ...products.slice(0, index)];
    return ordered.find(costPending)?.id ?? null;
  }

  function onDelete(id: string) {
    const previous = products;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    startTransition(async () => {
      const res = await deleteProduct(id);
      if (!res.ok) {
        setProducts(previous); // desfaz o otimismo em vez de sumir com a peça
        toast.error(res.error || "Não foi possível excluir");
      } else {
        toast.success("Peça excluída");
      }
    });
  }

  /**
   * Grava e relê do servidor.
   *
   * Sem merge otimista de propósito: o card mostra CUSTO CALCULADO, e energia e
   * depreciação dependem da impressora vinculada — a versão anterior recalculava
   * no cliente com defaults e exibia números que não eram os gravados. Reler é
   * uma ida a mais e nenhuma chance de mentir.
   */
  async function save(payload: ProductFormPayload, id: string | null): Promise<boolean> {
    const res = id ? await updateProduct(id, payload) : await createProduct(payload);
    if (!res.ok) {
      toast.error(res.error || "Erro ao salvar");
      return false;
    }
    toast.success(id ? "Peça atualizada" : "Peça criada");
    const refreshed = await fetchProductsData();
    if (refreshed.ok) setProducts(refreshed.products);
    return true;
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
              {totals.count} peças · margem média {totals.avgMargin}%
              {totals.pending > 0 && (
                <> · <span className="text-warning-fg">{totals.pending} sem custo preenchido</span></>
              )}
            </p>
          </div>
        </div>
        <Button onClick={() => setCreating(true)}><Plus aria-hidden /> Nova peça</Button>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Cube size={32} className="mb-3 text-muted-foreground" weight="duotone" />
          <h3 className="text-base font-semibold">Nenhuma peça no catálogo</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Cadastre uma peça com gramas e tempo de impressão: o custo real
            (filamento + energia + depreciação + insumos) e o preço sugerido saem
            sozinhos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="group card-hover flex flex-col rounded-xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  {p.images[0] && (
                    // Foto de produto, fonte externa e tamanho variável — <img> é o certo.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover" />
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
                      {costPending(p) && (
                        <Badge variant="outline" className="gap-1 border-warning/40 text-[10px] text-warning-fg">
                          <Warning size={11} aria-hidden /> Custo pendente
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => setEditingId(p.id)} className="text-muted-foreground hover:text-accent" aria-label={`Editar ${p.name}`}>
                    <PencilSimple size={14} />
                  </button>
                  <button onClick={() => onDelete(p.id)} className="text-muted-foreground hover:text-error" aria-label={`Excluir ${p.name}`}>
                    <Trash size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-1 text-xs">
                <Row label={`Material${p.filamentName ? ` · ${p.filamentName}` : ""}`} value={brlFromReais(p.pricing.materialCost)} />
                <Row label="Energia" value={brlFromReais(p.pricing.energyCost)} />
                <Row label="Depreciação" value={brlFromReais(p.pricing.depreciationCost)} />
                {p.pricing.extrasCost > 0 && <Row label="Insumos" value={brlFromReais(p.pricing.extrasCost)} />}
                <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5 font-semibold text-text">
                  <span>Custo total</span>
                  <span className="tabular-nums">{brlFromReais(p.pricing.totalCost)}</span>
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between rounded-lg bg-accent-soft/50 p-3">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Preço sugerido · margem {p.marginPct}%
                  </div>
                  <div className="text-xl font-bold text-accent tabular-nums">{brlFromReais(p.pricing.suggestedPrice)}</div>
                </div>
                <div className="text-right text-[11px] text-success-fg">
                  +{brlFromReais(p.pricing.profit)}<br />lucro
                </div>
              </div>

              {p.salePriceCents != null && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Preço praticado na loja:{" "}
                  <strong className="text-text tabular-nums">{brlFromReais(p.salePriceCents / 100)}</strong>
                </p>
              )}

              <button
                onClick={() => {
                  dataMesh.emit("crm", "content-studio", "CRM_TO_CONTENT", {
                    productName: p.name,
                    category: p.category,
                    material: p.filamentName,
                    price: p.pricing.suggestedPrice,
                    images: p.images,
                  });
                  toast.success(`Dados de '${p.name}' transmitidos para o AI Content Studio!`);
                }}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 py-2 text-xs font-bold text-amber-500 transition-colors hover:bg-amber-500/20"
              >
                <VideoCamera size={14} />
                <span>Gerar Vídeo IA &amp; Postar</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <ProductFormDialog
          open
          onOpenChange={(v) => { if (!v) setCreating(false); }}
          product={null}
          filaments={filaments}
          printers={printers}
          globalLinks={globalLinks}
          kEnergy={kEnergy}
          onSubmit={(payload) => save(payload, null)}
        />
      )}

      {editing && (
        <ProductFormDialog
          key={editing.id}
          open
          onOpenChange={(v) => { if (!v) setEditingId(null); }}
          product={editing}
          filaments={filaments}
          printers={printers}
          globalLinks={globalLinks}
          kEnergy={kEnergy}
          onSubmit={(payload) => save(payload, editing.id)}
          onSaveAndNext={() => {
            const next = nextPendingAfter(editing.id);
            if (next) setEditingId(next);
            else {
              setEditingId(null);
              toast.success("Nenhuma peça com custo pendente. 🎉");
            }
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
