"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Cube, DownloadSimple, Warning, ArrowsClockwise } from "@/lib/ui/icons";
import { parseDecimal } from "@/lib/format/decimal";
import { createModelDownloadUrl, type ModelOption } from "@/app/actions/models/actions";
import { DEFAULT_SLICE_SETTINGS, type SliceSettings } from "@/lib/slicer/pipeline";
import { formatDuration, type PrinterProfile } from "@/lib/slicer/gcode";
import { SEAM_MODES, type SeamMode } from "@/lib/slicer/seam";
import type { InfillPattern } from "@/lib/slicer/infill";
import type {
  SlicerRequest,
  SlicerResponse,
  PreviewLayer,
  OrientationReport,
} from "./slicer.worker";
import { LayerCanvas } from "./LayerCanvas";
import { ToolpathViewer } from "./ToolpathViewer";
import {
  TOOLPATH_KINDS,
  TOOLPATH_LABELS,
  type ToolpathBuffers,
  type ToolpathKind,
} from "@/lib/slicer/toolpath-preview";

interface Result {
  layers: PreviewLayer[];
  toolpath: ToolpathBuffers;
  gcode: string;
  filamentMm: number;
  filamentGrams: number;
  estimatedSeconds: number;
  openContourCount: number;
  layersWithoutWalls: number;
  supportVolumeCm3: number;
  retractionCount: number;
  orientation: OrientationReport | null;
  triangles: number;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  elapsedMs: number;
}

const PATTERNS: Array<{ value: InfillPattern; label: string }> = [
  { value: "grade", label: "Grade" },
  { value: "linhas", label: "Linhas" },
  { value: "triangulo", label: "Triângulo" },
  { value: "giroide", label: "Giroide" },
  { value: "concentrico", label: "Concêntrico" },
];

export function SlicerClient({
  models,
  profile,
}: {
  models: ModelOption[];
  /** Perfil vindo dos parâmetros da organização. */
  profile: PrinterProfile;
}) {
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [settings, setSettings] = useState<SliceSettings>(DEFAULT_SLICE_SETTINGS);
  // Cópia local do perfil: retração e ventoinha são da máquina, mas quem está
  // fatiando precisa poder ajustá-las para ESTA peça sem alterar o padrão da
  // organização. O que sai daqui não é gravado no banco.
  const [machine, setMachine] = useState<PrinterProfile>(profile);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ ratio: number; label: string } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [layerIndex, setLayerIndex] = useState(0);
  const [showInfill, setShowInfill] = useState(true);
  // O 3D é o padrão: é a vista que responde "como a peça fica". O 2D continua
  // como aba porque, para conferir se um contorno FECHOU, planta baixa de uma
  // camada ainda é melhor que qualquer vista em perspectiva.
  const [previewMode, setPreviewMode] = useState<"3d" | "2d">("3d");
  const [rangeFrom, setRangeFrom] = useState(0);
  const [rangeTo, setRangeTo] = useState(0);
  const [visibleKinds, setVisibleKinds] = useState<Record<ToolpathKind, boolean>>(() =>
    Object.fromEntries(TOOLPATH_KINDS.map((k) => [k, true])) as Record<ToolpathKind, boolean>,
  );
  const [autoOrient, setAutoOrient] = useState(true);
  const workerRef = useRef<Worker | null>(null);

  const model = models.find((m) => m.id === modelId) ?? null;
  const layer = result?.layers[Math.min(layerIndex, result.layers.length - 1)] ?? null;

  const patch = (next: Partial<SliceSettings>) => setSettings((prev) => ({ ...prev, ...next }));
  const patchMachine = (next: Partial<PrinterProfile>) =>
    setMachine((prev) => ({ ...prev, ...next }));

  // Aviso, não trava: a máquina é sua e o limite pode estar desatualizado aqui.
  const layerHeightWarning =
    settings.layerHeight < machine.minLayerHeight || settings.layerHeight > machine.maxLayerHeight
      ? `A ${machine.name} trabalha entre ${machine.minLayerHeight} e ${machine.maxLayerHeight} mm.`
      : null;

  const seamHint = SEAM_MODES.find((m) => m.value === settings.seamMode)?.hint ?? "";

  async function slice() {
    if (!model) return;
    setBusy(true);
    setResult(null);
    setProgress({ ratio: 0, label: "Baixando o modelo" });

    try {
      // URL assinada emitida no servidor — o cliente do browser não tem sessão
      // (cookie httpOnly), então download direto do bucket privado seria negado.
      const signed = await createModelDownloadUrl(model.id);
      if (!signed.ok) throw new Error(signed.error);
      const res = await fetch(signed.url);
      if (!res.ok) throw new Error(`Falha ao baixar (HTTP ${res.status})`);
      const arrayBuffer = await res.arrayBuffer();

      workerRef.current?.terminate();
      const worker = new Worker(new URL("./slicer.worker.ts", import.meta.url), {
        type: "module",
      });
      workerRef.current = worker;

      const done = await new Promise<Result>((resolve, reject) => {
        worker.onmessage = (event: MessageEvent<SlicerResponse>) => {
          const message = event.data;
          if (message.kind === "progress") {
            setProgress({ ratio: message.ratio, label: message.label });
            return;
          }
          worker.terminate();
          workerRef.current = null;
          if (message.kind === "error") reject(new Error(message.error));
          else resolve(message);
        };
        worker.onerror = () => {
          worker.terminate();
          workerRef.current = null;
          reject(new Error("O fatiador travou. Tente uma altura de camada maior."));
        };

        const request: SlicerRequest = {
          arrayBuffer,
          settings,
          profile: machine,
          filamentDensity: 1.24,
          autoOrient,
          filename: model.name,
        };
        // Transferable: um STL de 26 MB não pode ser copiado para o worker.
        worker.postMessage(request, [arrayBuffer]);
      });

      setResult(done);
      setLayerIndex(Math.floor(done.layers.length / 2));
      setRangeFrom(0);
      setRangeTo(done.layers.length - 1);
      toast.success(`${done.layers.length} camadas em ${(done.elapsedMs / 1000).toFixed(1)}s`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui fatiar.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function downloadGcode() {
    if (!result || !model) return;
    const name = model.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "-");
    const blob = new Blob([result.gcode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name || "peca"}.gcode`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const size = useMemo(() => {
    if (!result) return null;
    const { min, max } = result.bounds;
    return `${(max[0] - min[0]).toFixed(1)} × ${(max[1] - min[1]).toFixed(1)} × ${(max[2] - min[2]).toFixed(1)} mm`;
  }, [result]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Cube size={26} weight="duotone" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fatiar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gera o G-code a partir de um STL do seu repositório.
          </p>
        </div>
      </header>

      {models.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <h3 className="font-semibold text-muted-foreground">Nenhum modelo no repositório</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Envie um STL em Modelagem para poder fatiar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          {/* ── Ajustes ───────────────────────────────────────────────── */}
          <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-model">Peça</Label>
              <Combobox
                id="s-model"
                value={modelId}
                onChange={setModelId}
                options={models.map((m) => ({
                  value: m.id,
                  label: m.name,
                  hint: `${m.triangles.toLocaleString("pt-BR")} tri`,
                }))}
                searchPlaceholder="Buscar peça…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Altura de camada"
                hint={layerHeightWarning ?? `mm (${machine.minLayerHeight}–${machine.maxLayerHeight})`}
                warn={layerHeightWarning !== null}
              >
                <Input
                  inputMode="decimal"
                  value={String(settings.layerHeight)}
                  onChange={(e) => patch({ layerHeight: parseDecimal(e.target.value) })}
                />
              </Field>
              <Field label="1ª camada" hint="mm, mais alta cola melhor">
                <Input
                  inputMode="decimal"
                  value={String(settings.firstLayerHeight)}
                  onChange={(e) => patch({ firstLayerHeight: parseDecimal(e.target.value) })}
                />
              </Field>
              <Field label="Largura do filete" hint="≈ diâmetro do bico">
                <Input
                  inputMode="decimal"
                  value={String(settings.lineWidth)}
                  onChange={(e) => patch({ lineWidth: parseDecimal(e.target.value) })}
                />
              </Field>
              <Field label="Paredes" hint="2 a 3 é o usual">
                <Input
                  inputMode="numeric"
                  value={String(settings.wallCount)}
                  onChange={(e) => patch({ wallCount: Math.round(parseDecimal(e.target.value)) })}
                />
              </Field>
              <Field label="Preenchimento" hint="%">
                <Input
                  inputMode="numeric"
                  value={String(settings.infillDensityPct)}
                  onChange={(e) => patch({ infillDensityPct: parseDecimal(e.target.value) })}
                />
              </Field>
              <Field label="Topo e base" hint="camadas sólidas">
                <Input
                  inputMode="numeric"
                  value={String(settings.topBottomLayers)}
                  onChange={(e) =>
                    patch({ topBottomLayers: Math.round(parseDecimal(e.target.value)) })
                  }
                />
              </Field>
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <label className="flex cursor-pointer items-center justify-between text-xs">
                <span className="font-medium">Suportes</span>
                <input
                  type="checkbox"
                  checked={settings.supportsEnabled}
                  onChange={(e) => patch({ supportsEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-border bg-surface text-accent"
                />
              </label>
              {settings.supportsEnabled && (
                <>
                  <Field label="Ângulo máximo sem apoio" hint="graus da vertical. 45 é o seguro.">
                    <Input
                      inputMode="numeric"
                      value={String(settings.supportMaxOverhangDeg)}
                      onChange={(e) =>
                        patch({ supportMaxOverhangDeg: Math.round(parseDecimal(e.target.value)) })
                      }
                    />
                  </Field>
                  <Field
                    label="Folga vertical"
                    hint="camadas de vão até a peça. 0 cola o suporte e ele arranca material ao sair."
                  >
                    <Input
                      inputMode="numeric"
                      value={String(settings.supportZClearanceLayers)}
                      onChange={(e) =>
                        patch({
                          supportZClearanceLayers: Math.max(
                            0,
                            Math.round(parseDecimal(e.target.value)),
                          ),
                        })
                      }
                    />
                  </Field>
                  <Field
                    label="Camadas de interface"
                    hint="topo denso do suporte. Sem elas a face de baixo afunda entre os filetes."
                  >
                    <Input
                      inputMode="numeric"
                      value={String(settings.supportInterfaceLayers)}
                      onChange={(e) =>
                        patch({
                          supportInterfaceLayers: Math.max(
                            0,
                            Math.round(parseDecimal(e.target.value)),
                          ),
                        })
                      }
                    />
                  </Field>
                  <Field label="Densidade da interface" hint="% — 70 costuma bastar.">
                    <Input
                      inputMode="numeric"
                      value={String(settings.supportInterfaceDensityPct)}
                      onChange={(e) =>
                        patch({
                          supportInterfaceDensityPct: Math.min(
                            100,
                            Math.max(1, Math.round(parseDecimal(e.target.value))),
                          ),
                        })
                      }
                    />
                  </Field>
                  <label className="flex cursor-pointer items-center justify-between text-xs">
                    <span>
                      Só a partir da mesa
                      <span className="block text-[10px] text-muted">
                        não gera suporte apoiado na própria peça
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.supportBuildPlateOnly}
                      onChange={(e) => patch({ supportBuildPlateOnly: e.target.checked })}
                      className="h-4 w-4 rounded border-border bg-surface text-accent"
                    />
                  </label>
                </>
              )}
            </div>

            <Field label="Padrão do preenchimento">
              <Combobox
                value={settings.infillPattern}
                onChange={(v) => patch({ infillPattern: v as InfillPattern })}
                options={PATTERNS}
                searchPlaceholder="Buscar…"
              />
            </Field>

            {/* ── Posição ──────────────────────────────────────────────── */}
            <Section title="Posição na mesa">
              <label className="flex cursor-pointer items-start justify-between gap-3 text-xs">
                <span>
                  <span className="font-medium">Orientar automaticamente</span>
                  <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                    Gira a peça para gastar menos suporte e apoiar melhor. É a decisão que mais
                    muda o resultado — no PAYLOAD, 22,85 → 0,62 cm³ de suporte.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={autoOrient}
                  onChange={(e) => setAutoOrient(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-border bg-surface text-accent"
                />
              </label>
            </Section>

            {/* ── Acabamento ───────────────────────────────────────────── */}
            <Section title="Acabamento">
              <Toggle
                label="Altura de camada variável"
                hint={`Camada fina onde a superfície é rasa, grossa na parede vertical. Degrau alvo ${settings.adaptiveCuspMm} mm.`}
                checked={settings.adaptiveLayers}
                onChange={(v) => patch({ adaptiveLayers: v })}
              />
              {settings.adaptiveLayers && (
                <Field label="Degrau máximo" hint="mm. Menor = mais liso e mais lento.">
                  <Input
                    inputMode="decimal"
                    value={String(settings.adaptiveCuspMm)}
                    onChange={(e) => patch({ adaptiveCuspMm: parseDecimal(e.target.value) })}
                  />
                </Field>
              )}
              <Toggle
                label="Pontes"
                hint="Trecho sobre vazio sai devagar e com ventoinha máxima."
                checked={settings.bridgesEnabled}
                onChange={(v) => patch({ bridgesEnabled: v })}
              />
              <Toggle
                label="Alisar o topo"
                hint="Passada extra com quase nada de material. Deixa a face lisa e demora mais."
                checked={settings.ironingEnabled}
                onChange={(v) => patch({ ironingEnabled: v })}
              />
              <Field label="Raft" hint="camadas sacrificiais sob a peça. 0 desliga.">
                <Input
                  inputMode="numeric"
                  value={String(settings.raftLayers)}
                  onChange={(e) => patch({ raftLayers: Math.round(parseDecimal(e.target.value)) })}
                />
              </Field>
            </Section>

            {/* ── Aderência ────────────────────────────────────────────── */}
            <Section title="Aderência">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Laços de skirt" hint="prepara o fluxo. 0 desliga">
                  <Input
                    inputMode="numeric"
                    value={String(settings.skirtLoops)}
                    onChange={(e) => patch({ skirtLoops: Math.round(parseDecimal(e.target.value)) })}
                  />
                </Field>
                <Field label="Folga do skirt" hint="mm até a peça">
                  <Input
                    inputMode="decimal"
                    value={String(settings.skirtGapMm)}
                    onChange={(e) => patch({ skirtGapMm: parseDecimal(e.target.value) })}
                  />
                </Field>
              </div>
              <Field label="Brim" hint="mm de aba colada. 0 desliga. Use em peça de base pequena.">
                <Input
                  inputMode="decimal"
                  value={String(settings.brimWidthMm)}
                  onChange={(e) => patch({ brimWidthMm: parseDecimal(e.target.value) })}
                />
              </Field>
            </Section>

            {/* ── Costura ──────────────────────────────────────────────── */}
            <Section title="Costura">
              <Field label="Onde a parede começa" hint={seamHint}>
                <Combobox
                  value={settings.seamMode}
                  onChange={(v) => patch({ seamMode: v as SeamMode })}
                  options={SEAM_MODES.map((m) => ({ value: m.value, label: m.label, hint: m.hint }))}
                  searchPlaceholder="Buscar…"
                />
              </Field>
              <Field
                label="Cachecol (scarf)"
                hint="mm de rampa na emenda. 0 desliga. 1 a 3 mm some com o furinho de início."
              >
                <Input
                  inputMode="decimal"
                  value={String(settings.scarfLengthMm)}
                  onChange={(e) => patch({ scarfLengthMm: parseDecimal(e.target.value) })}
                />
              </Field>
            </Section>

            {/* ── Impressora ───────────────────────────────────────────── */}
            <Section title="Impressora e resfriamento">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Retração" hint="mm. 0 desliga">
                  <Input
                    inputMode="decimal"
                    value={String(machine.retractionMm)}
                    onChange={(e) => patchMachine({ retractionMm: parseDecimal(e.target.value) })}
                  />
                </Field>
                <Field label="Velocidade" hint="mm/s da retração">
                  <Input
                    inputMode="decimal"
                    value={String(machine.retractionSpeedMmS)}
                    onChange={(e) =>
                      patchMachine({ retractionSpeedMmS: parseDecimal(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Salto mínimo" hint="mm. Abaixo disso não retrai.">
                  <Input
                    inputMode="decimal"
                    value={String(machine.retractionMinTravelMm)}
                    onChange={(e) =>
                      patchMachine({ retractionMinTravelMm: parseDecimal(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Ventoinha" hint="%. Desligada nas primeiras camadas.">
                  <Input
                    inputMode="numeric"
                    value={String(machine.fanSpeedPct)}
                    onChange={(e) => patchMachine({ fanSpeedPct: parseDecimal(e.target.value) })}
                  />
                </Field>
              </div>
            </Section>

            <Button onClick={() => void slice()} disabled={busy || !model} className="w-full gap-2">
              {busy ? <ArrowsClockwise size={15} className="animate-spin" /> : null}
              {busy ? (progress?.label ?? "Fatiando…") : "Fatiar"}
            </Button>

            {progress && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${Math.round(progress.ratio * 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* ── Resultado ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            {!result ? (
              <div className="flex h-full min-h-[380px] flex-col items-center justify-center rounded-xl border border-dashed border-border text-center">
                <Cube size={32} className="mb-3 text-muted-foreground" weight="duotone" />
                <p className="text-sm text-muted-foreground">
                  Escolha a peça, ajuste e clique em Fatiar.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Camadas" value={String(result.layers.length)} />
                  <Stat label="Filamento" value={`${result.filamentGrams.toFixed(1)} g`} />
                  <Stat label="Tempo (piso)" value={formatDuration(result.estimatedSeconds)} />
                  <Stat
                    label={result.supportVolumeCm3 > 0 ? "Suporte" : "Tamanho"}
                    value={
                      result.supportVolumeCm3 > 0
                        ? `${result.supportVolumeCm3.toFixed(1)} cm³`
                        : (size ?? "—")
                    }
                  />
                </div>

                <p className="text-[11px] text-muted-foreground">
                  {size} · {result.retractionCount.toLocaleString("pt-BR")} retrações ·{" "}
                  {result.triangles.toLocaleString("pt-BR")} triângulos
                </p>

                {result.orientation?.rotated && (
                  <div className="rounded-lg border border-accent/30 bg-accent-soft/40 p-3 text-[11px] leading-snug">
                    <strong>Peça girada</strong> para uma posição melhor. Altura{" "}
                    {result.orientation.heightBeforeMm.toFixed(0)} →{" "}
                    <strong>{result.orientation.heightAfterMm.toFixed(0)} mm</strong>; apoio na mesa{" "}
                    {result.orientation.bedContactBeforeMm2.toFixed(0)} →{" "}
                    <strong>{result.orientation.bedContactAfterMm2.toFixed(0)} mm²</strong>. Desligue
                    &ldquo;Orientar automaticamente&rdquo; se a peça precisa sair na posição em que
                    foi modelada.
                  </div>
                )}

                {(result.openContourCount > 0 || result.layersWithoutWalls > 0) && (
                  <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-[11px] leading-snug text-warning-fg">
                    <Warning size={16} className="mt-0.5 shrink-0" aria-hidden />
                    <div>
                      {result.openContourCount > 0 && (
                        <p>
                          <strong>{result.openContourCount}</strong> contorno(s) não fecharam — a
                          malha tem buraco. Rode um reparo antes de imprimir.
                        </p>
                      )}
                      {result.layersWithoutWalls > 0 && (
                        <p>
                          <strong>{result.layersWithoutWalls}</strong> camada(s) sem parede: há
                          região mais fina que a largura do filete.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {layer && (
                  <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex rounded-lg border border-border p-0.5">
                        {(["3d", "2d"] as const).map((modo) => (
                          <button
                            key={modo}
                            type="button"
                            onClick={() => setPreviewMode(modo)}
                            className={
                              previewMode === modo
                                ? "rounded-md bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground"
                                : "rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
                            }
                          >
                            {modo === "3d" ? "Percurso 3D" : "Camada 2D"}
                          </button>
                        ))}
                      </div>

                      {previewMode === "2d" ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            camada {layerIndex + 1}/{result.layers.length} · z ={" "}
                            {layer.z.toFixed(2)} mm
                          </span>
                          {layer.solidCount > 0 && (
                            <Badge variant="secondary" className="text-[10px]">sólida</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          camadas {rangeFrom + 1}–{rangeTo + 1} de {result.layers.length}
                        </span>
                      )}
                    </div>

                    {previewMode === "2d" ? (
                      <>
                        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={showInfill}
                            onChange={(e) => setShowInfill(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-border bg-surface text-accent"
                          />
                          Preenchimento
                        </label>

                        <input
                          type="range"
                          min={0}
                          max={result.layers.length - 1}
                          value={layerIndex}
                          onChange={(e) => setLayerIndex(Number(e.target.value))}
                          aria-label="Camada"
                          className="h-1.5 w-full cursor-pointer accent-accent"
                        />

                        <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                          <Legend color="#fb923c" label="parede externa" />
                          {layer.innerWalls.length > 0 && (
                            <Legend color="rgba(251,146,60,0.45)" label="parede interna" />
                          )}
                          <Legend color="rgb(96, 165, 250)" label="preenchimento" />
                          {layer.supports.length > 0 && (
                            <Legend color="rgb(163,163,163)" label="suporte" />
                          )}
                          {layer.brim.length > 0 && <Legend color="rgb(140,140,140)" label="brim" />}
                          {layer.skirt.length > 0 && <Legend color="rgb(115,115,115)" label="skirt" />}
                        </div>

                        <LayerCanvas
                          outerWalls={layer.outerWalls}
                          innerWalls={layer.innerWalls}
                          infill={layer.infill}
                          supports={layer.supports}
                          skirt={layer.skirt}
                          brim={layer.brim}
                          bounds={result.bounds}
                          showInfill={showInfill}
                        />
                      </>
                    ) : (
                      <>
                        {/* Duas pontas independentes: ver "só o meio" é como se
                            inspeciona onde a costura anda e onde o suporte
                            encosta, sem a peça inteira na frente. */}
                        <div className="grid gap-2 sm:grid-cols-2">
                          <RangeSlider
                            label="Da camada"
                            value={rangeFrom}
                            max={result.layers.length - 1}
                            onChange={(v) => {
                              setRangeFrom(v);
                              if (v > rangeTo) setRangeTo(v);
                            }}
                          />
                          <RangeSlider
                            label="Até a camada"
                            value={rangeTo}
                            max={result.layers.length - 1}
                            onChange={(v) => {
                              setRangeTo(v);
                              if (v < rangeFrom) setRangeFrom(v);
                            }}
                          />
                        </div>

                        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                          {TOOLPATH_KINDS.filter((k) => result.toolpath[k].segments > 0).map((k) => (
                            <label
                              key={k}
                              className="flex cursor-pointer items-center gap-1.5 text-[10px] text-muted-foreground"
                            >
                              <input
                                type="checkbox"
                                checked={visibleKinds[k]}
                                onChange={(e) =>
                                  setVisibleKinds((prev) => ({ ...prev, [k]: e.target.checked }))
                                }
                                className="h-3 w-3 rounded border-border bg-surface text-accent"
                              />
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: TOOLPATH_LABELS[k].color }}
                                aria-hidden
                              />
                              {TOOLPATH_LABELS[k].label}
                            </label>
                          ))}
                        </div>

                        <ToolpathViewer
                          buffers={result.toolpath}
                          bounds={result.bounds}
                          fromLayer={rangeFrom}
                          toLayer={rangeTo}
                          visible={visibleKinds}
                        />

                        <p className="text-[10px] text-muted-foreground">
                          As cores sao as mesmas dos rotulos ;TYPE: do G-code — o que esta na tela e
                          o que esta no arquivo sao a mesma coisa.
                        </p>
                      </>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={downloadGcode} className="gap-2">
                    <DownloadSimple size={15} /> Baixar G-code
                  </Button>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Confira num visualizador de G-code antes de mandar para a impressora. O tempo é
                    um piso — não modela aceleração.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label, hint, warn, children,
}: { label: string; hint?: string; warn?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && (
        <p className={`text-[10px] ${warn ? "text-warning-fg" : "text-muted-foreground"}`}>{hint}</p>
      )}
    </div>
  );
}

function Toggle({
  label, hint, checked, onChange,
}: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 text-xs">
      <span>
        <span className="font-medium">{label}</span>
        <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border bg-surface text-accent"
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-0.5 w-4 rounded" style={{ backgroundColor: color }} aria-hidden />
      {label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function RangeSlider({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="flex items-center justify-between text-[10px] text-muted-foreground">
        {label}
        <span className="font-mono tabular-nums">{value + 1}</span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-accent"
      />
    </label>
  );
}
