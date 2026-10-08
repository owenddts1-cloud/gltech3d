"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilePdf } from "@phosphor-icons/react";
import { CircleNotch } from "@/lib/ui/icons";
import type { FilamentAdmin } from "@/lib/filament-catalog/types";
import {
  DEFAULT_FILAMENT_PDF_TITLE,
  generateFilamentPdf,
  selectFilamentsForPdf,
  type FilamentPdfItem,
} from "@/lib/catalog/filament-pdf";

const ALL = "__all";

function toPdfItem(f: FilamentAdmin): FilamentPdfItem {
  return {
    id: f.id,
    name: f.name,
    images: f.images,
    colorHex: f.colorHex,
    colorName: f.colorName,
    materialId: f.materialId,
    materialName: f.materialName,
    line: f.line,
    brand: f.brand,
    diameterMm: f.diameterMm,
    netWeightG: f.netWeightG,
    nozzleTempMin: f.nozzleTempMin,
    nozzleTempMax: f.nozzleTempMax,
    bedTempMin: f.bedTempMin,
    bedTempMax: f.bedTempMax,
    availability: f.availability,
    availabilityLabel: f.availabilityLabel,
    priceCents: f.salePriceCents,
    isPublished: f.isPublished,
  };
}

function Choice<T extends string>(props: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium">{props.label}</span>
      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={props.label}>
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={props.value === o.value}
            onClick={() => props.onChange(o.value)}
            className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
              props.value === o.value
                ? "border-accent bg-accent-soft text-accent"
                : "border-border text-text-muted hover:border-accent/60"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FilamentPdfDialog({
  open,
  onOpenChange,
  filaments,
  materials,
  defaultWhatsapp,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filaments: FilamentAdmin[];
  materials: Array<{ id: string; name: string }>;
  defaultWhatsapp: string;
}) {
  const [price, setPrice] = useState<"com" | "sem">("sem");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [scope, setScope] = useState<"publicados" | "todos">("publicados");
  const [materialId, setMaterialId] = useState("");
  const [photos, setPhotos] = useState<"com" | "sem">("com");
  const [title, setTitle] = useState(DEFAULT_FILAMENT_PDF_TITLE);
  const [whatsapp, setWhatsapp] = useState(defaultWhatsapp);
  const [progress, setProgress] = useState<string | null>(null);

  const selected = useMemo(
    () => selectFilamentsForPdf(filaments, { onlyPublished: scope === "publicados", materialId }),
    [filaments, scope, materialId],
  );

  async function generate() {
    if (selected.length === 0) {
      toast.error("Nenhum filamento com esses filtros.");
      return;
    }
    setProgress(photos === "com" ? "Carregando fotos…" : "Gerando PDF…");
    try {
      const blob = await generateFilamentPdf(selected.map(toPdfItem), {
        title,
        withPrice: price === "com",
        theme,
        storeWhatsapp: whatsapp.trim() || undefined,
        includeImages: photos === "com",
        onImageProgress: (done, total) =>
          setProgress(total === 0 || done >= total ? "Gerando PDF…" : `Carregando fotos ${done}/${total}…`),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Filamentos-${price === "com" ? "com-preco" : "sem-preco"}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF gerado.");
      onOpenChange(false);
    } catch (err) {
      toast.error(`Falha ao gerar PDF: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProgress(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !progress && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Catálogo de filamentos em PDF</DialogTitle>
          <DialogDescription>
            Capa com o seu WhatsApp e um card por filamento com foto ou cor, especificações e disponibilidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Choice label="Preço" value={price} onChange={setPrice} options={[{ value: "sem", label: "Sem preço" }, { value: "com", label: "Com preço" }]} />
            <Choice label="Tema" value={theme} onChange={setTheme} options={[{ value: "light", label: "Claro" }, { value: "dark", label: "Escuro" }]} />
            <Choice
              label="Quais filamentos"
              value={scope}
              onChange={setScope}
              options={[{ value: "publicados", label: "Só publicados" }, { value: "todos", label: "Todos" }]}
            />
            <Choice label="Fotos" value={photos} onChange={setPhotos} options={[{ value: "com", label: "Com fotos" }, { value: "sem", label: "Só cores" }]} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pdf-material" className="text-xs">Material</Label>
            <Select value={materialId || ALL} onValueChange={(v) => setMaterialId(v === ALL ? "" : v)}>
              <SelectTrigger id="pdf-material">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os materiais</SelectItem>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pdf-title" className="text-xs">Título da capa</Label>
              <Input id="pdf-title" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pdf-wa" className="text-xs">WhatsApp no PDF</Label>
              <Input id="pdf-wa" value={whatsapp} maxLength={30} onChange={(e) => setWhatsapp(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-text-muted">
            {selected.length} {selected.length === 1 ? "filamento entra" : "filamentos entram"} no arquivo.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={progress !== null}>
            Cancelar
          </Button>
          <Button onClick={generate} disabled={progress !== null || selected.length === 0}>
            {progress ? <CircleNotch className="animate-spin" /> : <FilePdf />}
            <span aria-live="polite">{progress ?? "Gerar PDF"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
