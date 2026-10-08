"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FilePdf } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Globe, MagnifyingGlass, Drop } from "@/lib/ui/icons";
import { deleteFilament } from "@/app/actions/filament-catalog/actions";
import type { FilamentAdmin } from "@/lib/filament-catalog/types";
import { sortForDisplay } from "@/app/app/(pro)/landing-edit/_lib/order";
import { normalizeSearch } from "@/lib/storefront/filaments";
import { FilamentRows } from "./FilamentRows";
import { FilamentFormSheet } from "./FilamentFormSheet";
import { FilamentPdfDialog } from "./FilamentPdfDialog";

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">{label}</p>
      <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${tone === "warn" && value > 0 ? "text-warning-fg" : ""}`}>{value}</p>
    </div>
  );
}

export function FilamentsClient({
  initialFilaments,
  materials,
  loadError,
  defaultPdfWhatsapp,
}: {
  initialFilaments: FilamentAdmin[];
  materials: Array<{ id: string; name: string }>;
  loadError: string | null;
  defaultPdfWhatsapp: string;
}) {
  const [items, setItems] = useState(() => sortForDisplay(initialFilaments));
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<FilamentAdmin | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [deleting, setDeleting] = useState<FilamentAdmin | null>(null);

  const stats = useMemo(
    () => ({
      total: items.length,
      published: items.filter((f) => f.isPublished).length,
      noPrice: items.filter((f) => !f.salePriceCents).length,
      out: items.filter((f) => f.availability === "esgotado").length,
    }),
    [items],
  );

  // Search narrows the view; dragging is only offered on the full list (indexes must match).
  const q = normalizeSearch(query);
  const visible = q
    ? items.filter((f) =>
        normalizeSearch([f.name, f.materialName, f.line, f.brand, f.colorName].filter(Boolean).join(" ")).includes(q),
      )
    : items;

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(f: FilamentAdmin) {
    setEditing(f);
    setSheetOpen(true);
  }

  function onSaved(f: FilamentAdmin, created: boolean) {
    setItems((list) => (created ? sortForDisplay([...list, f]) : list.map((x) => (x.id === f.id ? f : x))));
  }

  function mergeVisible(next: FilamentAdmin[]) {
    if (!q) {
      setItems(next);
      return;
    }
    const byId = new Map(next.map((f) => [f.id, f]));
    setItems((list) => list.map((f) => byId.get(f.id) ?? f));
  }

  async function confirmDelete() {
    const f = deleting;
    setDeleting(null);
    if (!f) return;
    const r = await deleteFilament(f.id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setItems((list) => list.filter((x) => x.id !== f.id));
    toast.success(`“${f.name}” excluído.`);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Filamentos</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Os rolos que você vende. O que estiver publicado e com preço aparece em{" "}
            <Link href="/filamentos" target="_blank" className="text-accent underline underline-offset-4">
              /filamentos
            </Link>{" "}
            e no carrinho do site.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setPdfOpen(true)} disabled={items.length === 0}>
            <FilePdf /> Catálogo em PDF
          </Button>
          <Button asChild variant="ghost">
            <Link href="/filamentos" target="_blank">
              <Globe /> Ver no site
            </Link>
          </Button>
          <Button onClick={openNew}>
            <Plus /> Novo filamento
          </Button>
        </div>
      </header>

      {loadError ? (
        <p role="alert" className="rounded-md border border-error/40 bg-error-bg px-4 py-3 text-sm text-error-fg">
          {loadError}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Cadastrados" value={stats.total} />
        <Stat label="No site" value={stats.published} />
        <Stat label="Sem preço" value={stats.noPrice} tone="warn" />
        <Stat label="Esgotados" value={stats.out} tone="warn" />
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <Drop size={36} className="text-text-muted" aria-hidden />
          <p className="font-medium">Nenhum filamento cadastrado.</p>
          <p className="max-w-md text-sm text-text-muted">
            Cadastre o primeiro rolo à venda: material, cor, peso e preço. O título da vitrine se monta sozinho a partir da
            ficha.
          </p>
          <Button onClick={openNew}>
            <Plus /> Novo filamento
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por cor, material, marca…"
              className="pl-9"
              aria-label="Buscar filamento"
            />
          </div>
          {q ? (
            <p className="text-xs text-text-muted">
              {visible.length} resultado(s). Limpe a busca para reordenar arrastando.
            </p>
          ) : null}
          {q ? (
            <FilamentRows key="search" items={visible} sortable={false} onItemsChange={mergeVisible} onEdit={openEdit} onDelete={setDeleting} />
          ) : (
            <FilamentRows items={items} onItemsChange={setItems} onEdit={openEdit} onDelete={setDeleting} />
          )}
        </div>
      )}

      <FilamentFormSheet open={sheetOpen} onOpenChange={setSheetOpen} filament={editing} materials={materials} onSaved={onSaved} />
      <FilamentPdfDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        filaments={items}
        materials={materials}
        defaultWhatsapp={defaultPdfWhatsapp}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              O filamento sai do CRM e do site. Pedidos e vendas antigos continuam com o nome registrado. Só gerentes e
              administradores podem excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
