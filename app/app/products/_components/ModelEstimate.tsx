"use client";

/**
 * Vincular o STL e estimar peso e tempo pelo fatiador.
 *
 * O PROBLEMA QUE RESOLVE. Os campos "Gramas" e "Tempo (min)" desta ficha tinham
 * o hint *"Do slicer."* — ou seja, o operador deveria abrir outro programa,
 * fatiar, anotar dois números e voltar. Resultado medido em 11/08/2026: os **18
 * produtos do catálogo com `filament_grams = 0` e `print_time_seconds = 0`**, e
 * o custo inteiro impossível de calcular.
 *
 * O fatiador está aqui dentro desde a rodada passada. Este painel só liga uma
 * coisa na outra.
 *
 * A ESTIMATIVA NÃO É MEDIÇÃO, e o componente insiste nisso: mostra o perfil
 * usado e a data. A peça real varia com preenchimento efetivo, suporte, purga e
 * falha de impressão — quem confundir estimativa com peso de balança vai
 * precificar errado achando que está preciso.
 */

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { ArrowsClockwise, Cube, Warning } from "@/lib/ui/icons";
import { estimateFromModelId } from "@/app/actions/products/estimate";

export interface ModelOptionLite {
  id: string;
  name: string;
  triangles: number;
}

interface Props {
  models: ModelOptionLite[];
  modelId: string;
  onModelChange: (id: string) => void;
  /** Recebe os números estimados para preencher os campos do formulário. */
  onEstimated: (r: { grams: number; minutes: number; source: Record<string, unknown> }) => void;
  /** Proveniência já gravada, quando a peça foi estimada antes. */
  estimatedAt: string | null;
  estimateSource: Record<string, unknown>;
}

/** `{ layerHeight: 0.2, infillDensityPct: 15 }` → "camada 0,2 mm · 15% · 2 paredes". */
function describeSource(source: Record<string, unknown>): string {
  const partes: string[] = [];
  const n = (k: string) => (typeof source[k] === "number" ? (source[k] as number) : null);

  const camada = n("layerHeight");
  if (camada) partes.push(`camada ${camada.toString().replace(".", ",")} mm`);
  const infill = n("infillDensityPct");
  if (infill !== null) partes.push(`${infill}% de preenchimento`);
  const paredes = n("wallCount");
  if (paredes) partes.push(`${paredes} paredes`);
  if (source.supportsEnabled === true) partes.push("com suporte");
  if (source.autoOriented === true) partes.push("orientado automaticamente");

  return partes.join(" · ");
}

export function ModelEstimate({
  models,
  modelId,
  onModelChange,
  onEstimated,
  estimatedAt,
  estimateSource,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function estimar() {
    if (!modelId) return;
    setBusy(true);
    setAviso(null);
    try {
      const r = await estimateFromModelId({ modelId });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const { estimate } = r;

      onEstimated({
        grams: estimate.filamentGrams,
        minutes: Math.round(estimate.printTimeSeconds / 60),
        source: {
          ...estimate.profile,
          layerCount: estimate.layerCount,
          supportCm3: estimate.supportCm3,
          openContourCount: estimate.openContourCount,
          modelId,
        },
      });

      // Malha com buraco produz estimativa, mas a peça não imprime direito. O
      // número sai; o aviso também.
      if (estimate.openContourCount > 0) {
        setAviso(
          `A malha tem ${estimate.openContourCount} contorno(s) aberto(s) — o arquivo tem buraco. ` +
            "A estimativa saiu, mas repare o STL antes de imprimir.",
        );
      }

      toast.success(
        `${estimate.filamentGrams} g · ${(estimate.printTimeSeconds / 3600).toFixed(1)} h ` +
          `(${estimate.layerCount} camadas em ${(r.elapsedMs / 1000).toFixed(1)}s)`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui estimar.");
    } finally {
      setBusy(false);
    }
  }

  const perfil = describeSource(estimateSource);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface/60 p-3">
      <div className="space-y-1.5">
        <Label htmlFor="p-model" className="text-xs">
          Modelo 3D
        </Label>
        <Combobox
          id="p-model"
          value={modelId}
          onChange={onModelChange}
          options={[
            { value: "", label: "— Nenhum —" },
            ...models.map((m) => ({
              value: m.id,
              label: m.name,
              hint: `${m.triangles.toLocaleString("pt-BR")} tri`,
            })),
          ]}
          searchPlaceholder="Buscar STL…"
        />
        <p className="text-[11px] leading-snug text-muted-foreground">
          {models.length === 0
            ? "Nenhum STL no repositório. Envie o arquivo em Modelagem para poder estimar."
            : "Vincule o arquivo desta peça para estimar peso e tempo sem abrir outro programa."}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2"
        disabled={!modelId || busy}
        onClick={() => void estimar()}
      >
        {busy ? <ArrowsClockwise size={14} className="animate-spin" /> : <Cube size={14} />}
        {busy ? "Fatiando…" : "Estimar pelo STL"}
      </Button>

      {estimatedAt && (
        <p className="text-[10px] leading-snug text-muted-foreground">
          Estimado em{" "}
          {new Date(estimatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
          {perfil ? ` · ${perfil}` : ""}. É estimativa, não pesagem — a peça real varia com
          preenchimento, suporte e falha.
        </p>
      )}

      {aviso && (
        <p className="flex gap-1.5 rounded-md border border-warning/40 bg-warning/5 p-2 text-[10px] leading-snug text-warning-fg">
          <Warning size={13} className="mt-0.5 shrink-0" aria-hidden />
          {aviso}
        </p>
      )}
    </div>
  );
}
