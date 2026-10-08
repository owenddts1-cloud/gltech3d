"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CircleNotch, Sparkle } from "@/lib/ui/icons";
import { ProductImages } from "@/app/app/(pro)/products/_components/ProductImages";
import { createFilament, updateFilament } from "@/app/actions/filament-catalog/actions";
import {
  FILAMENT_AVAILABILITY,
  FILAMENT_AVAILABILITY_LABEL,
  FILAMENT_DIAMETERS,
  type FilamentAvailability,
} from "@/lib/filament-catalog/schemas";
import type { FilamentAdmin } from "@/lib/filament-catalog/types";
import {
  EMPTY_FILAMENT_FORM,
  LINE_SUGGESTIONS,
  formFromFilament,
  payloadFromForm,
  previewTitle,
  validateFilamentForm,
  type FilamentFormState,
} from "../_lib/form";

const NO_MATERIAL = "__none";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[11px] text-text-muted">{hint}</p> : null}
    </div>
  );
}

export function FilamentFormSheet({
  open,
  onOpenChange,
  filament,
  materials,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = new filament. */
  filament: FilamentAdmin | null;
  materials: Array<{ id: string; name: string }>;
  onSaved: (f: FilamentAdmin, created: boolean) => void;
}) {
  const [form, setForm] = useState<FilamentFormState>(EMPTY_FILAMENT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(filament ? formFromFilament(filament) : EMPTY_FILAMENT_FORM);
  }, [open, filament]);

  const materialName = useMemo(
    () => materials.find((m) => m.id === form.materialId)?.name ?? null,
    [materials, form.materialId],
  );
  const autoTitle = previewTitle(form, materialName);
  const set = <K extends keyof FilamentFormState>(key: K, value: FilamentFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateFilamentForm(form, materialName);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    const payload = payloadFromForm(form, filament ? "update" : "create");
    const r = filament ? await updateFilament(filament.id, payload) : await createFilament(payload);
    setSaving(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(filament ? "Filamento salvo." : "Filamento criado.");
    onSaved(r.filament, !filament);
    onOpenChange(false);
  }

  const swatch = /^#[0-9a-f]{6}$/i.test(form.colorHex) ? form.colorHex : "#9c9087";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{filament ? "Editar filamento" : "Novo filamento"}</SheetTitle>
          <SheetDescription>
            Ficha técnica e vitrine. O que você marcar como interno nunca aparece no site.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={save} className="mt-6 space-y-5 pb-24">
          {/* Live title */}
          <div className="rounded-lg border border-border bg-surface-elevated p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Título na vitrine</span>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={form.autoName} onCheckedChange={(v) => set("autoName", v)} aria-label="Usar título automático" />
                Usar título automático
              </label>
            </div>
            {form.autoName ? (
              <p className="mt-2 flex items-center gap-2 text-base font-semibold">
                <Sparkle size={16} className="shrink-0 text-accent" aria-hidden />
                {autoTitle || <span className="text-text-muted">Escolha material, linha e cor…</span>}
              </p>
            ) : (
              <Input
                className="mt-2"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={autoTitle || "Nome do filamento"}
                maxLength={200}
                aria-label="Nome do filamento"
              />
            )}
          </div>

          <Section title="Material e cor">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="fil-material" label="Material">
                <Select value={form.materialId || NO_MATERIAL} onValueChange={(v) => set("materialId", v === NO_MATERIAL ? "" : v)}>
                  <SelectTrigger id="fil-material">
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_MATERIAL}>Sem material</SelectItem>
                    {materials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="fil-line" label="Linha" hint="Comum, Plus+, Premium… ou escreva outra.">
                <Input id="fil-line" list="fil-line-options" value={form.line} onChange={(e) => set("line", e.target.value)} maxLength={40} />
                <datalist id="fil-line-options">
                  {LINE_SUGGESTIONS.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </Field>
              <Field id="fil-brand" label="Marca">
                <Input id="fil-brand" value={form.brand} onChange={(e) => set("brand", e.target.value)} maxLength={60} />
              </Field>
              <Field id="fil-color" label="Nome da cor">
                <Input id="fil-color" value={form.colorName} onChange={(e) => set("colorName", e.target.value)} maxLength={40} placeholder="Preto, Azul Royal…" />
              </Field>
            </div>
            <Field id="fil-hex" label="Cor (amostra)" hint="Aparece como bolinha de cor no site e no PDF quando não há foto.">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="h-10 w-10 shrink-0 rounded-full border-4 border-[#2B2622]"
                  style={{ background: `repeating-radial-gradient(circle, ${swatch} 0 2px, ${swatch}cc 2px 3px)` }}
                />
                <input
                  type="color"
                  value={swatch}
                  onChange={(e) => set("colorHex", e.target.value.toUpperCase())}
                  aria-label="Escolher cor"
                  className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent"
                />
                <Input
                  id="fil-hex"
                  value={form.colorHex}
                  onChange={(e) => set("colorHex", e.target.value.trim())}
                  placeholder="#RRGGBB"
                  maxLength={7}
                  className="font-mono uppercase"
                />
              </div>
            </Field>
          </Section>

          <Section title="Especificações">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="fil-diameter" label="Diâmetro">
                <Select value={String(form.diameterMm)} onValueChange={(v) => set("diameterMm", v === "2.85" ? 2.85 : 1.75)}>
                  <SelectTrigger id="fil-diameter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILAMENT_DIAMETERS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} mm
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="fil-weight" label="Peso líquido (g)">
                <Input id="fil-weight" inputMode="numeric" value={form.netWeightG} onChange={(e) => set("netWeightG", e.target.value)} />
              </Field>
              <Field id="fil-nozzle" label="Bico (°C) mín. – máx.">
                <div className="flex gap-2">
                  <Input id="fil-nozzle" inputMode="numeric" placeholder="200" value={form.nozzleTempMin} onChange={(e) => set("nozzleTempMin", e.target.value)} aria-label="Bico mínimo" />
                  <Input inputMode="numeric" placeholder="220" value={form.nozzleTempMax} onChange={(e) => set("nozzleTempMax", e.target.value)} aria-label="Bico máximo" />
                </div>
              </Field>
              <Field id="fil-bed" label="Mesa (°C) mín. – máx.">
                <div className="flex gap-2">
                  <Input id="fil-bed" inputMode="numeric" placeholder="55" value={form.bedTempMin} onChange={(e) => set("bedTempMin", e.target.value)} aria-label="Mesa mínima" />
                  <Input inputMode="numeric" placeholder="65" value={form.bedTempMax} onChange={(e) => set("bedTempMax", e.target.value)} aria-label="Mesa máxima" />
                </div>
              </Field>
            </div>
            <Field id="fil-tds" label="Ficha técnica do fabricante (link https)">
              <Input id="fil-tds" type="url" value={form.tdsUrl} onChange={(e) => set("tdsUrl", e.target.value)} placeholder="https://…" />
            </Field>
          </Section>

          <Section title="Venda">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="fil-price" label="Valor de venda (R$)">
                <Input id="fil-price" inputMode="decimal" placeholder="89,90" value={form.price} onChange={(e) => set("price", e.target.value)} />
              </Field>
              <Field id="fil-availability" label="Disponibilidade">
                <Select value={form.availability} onValueChange={(v) => set("availability", v as FilamentAvailability)}>
                  <SelectTrigger id="fil-availability">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILAMENT_AVAILABILITY.map((a) => (
                      <SelectItem key={a} value={a}>
                        {FILAMENT_AVAILABILITY_LABEL[a]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 text-sm">
              <span>
                Publicado no site
                <span className="block text-[11px] text-text-muted">Só com valor de venda definido.</span>
              </span>
              <Switch checked={form.isPublished} onCheckedChange={(v) => set("isPublished", v)} aria-label="Publicado no site" />
            </label>
            <Field id="fil-desc" label="Descrição (aparece no site)">
              <Textarea id="fil-desc" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} />
            </Field>
            <div className="space-y-1.5">
              <Label className="text-xs">Fotos</Label>
              <ProductImages images={form.images} onChange={(next) => set("images", next)} />
            </div>
          </Section>

          <Section title="Interno">
            <Field id="fil-notes" label="Notas internas" hint="Fornecedor, lote, observações. Nunca vai para o site.">
              <Textarea id="fil-notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={2000} />
            </Field>
          </Section>

          <div className="fixed inset-x-0 bottom-0 flex justify-end gap-2 border-t border-border bg-surface/95 px-6 py-3 backdrop-blur sm:left-auto sm:w-full sm:max-w-xl">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <CircleNotch className="animate-spin" /> : null}
              {filament ? "Salvar" : "Criar filamento"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
