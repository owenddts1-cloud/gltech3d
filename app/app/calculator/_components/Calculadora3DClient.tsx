"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useCalculator, PRESETS } from "@/hooks/calculator/useCalculator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FileText, ArrowsClockwise, Printer as PrinterIcon, Package } from "@/lib/ui/icons";
import { QuotePdfModal } from "./QuotePdfModal";

// ─── Types ──────────────────────────────────────────────────────
interface PrinterOption { id: string; name: string; powerDraw: number; depreciationPerHour: number; }
interface FilamentOption { id: string; name: string; color: string; material: string; costPerGram: number; }
interface ContactOption { id: string; name: string; email: string | null; phone: string | null; }

interface Props {
  initialData: {
    printers: PrinterOption[];
    filaments: FilamentOption[];
    contacts: ContactOption[];
    orgId: string | null;
  };
}

// ─── Helpers ────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function InputField({
  id, label, unit, value, onChange, min = 0, step,
}: {
  id: string; label: string; unit: string; value: number;
  onChange: (v: number) => void; min?: number; step?: string;
}) {
  return (
    <div className="relative flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-neutral-600">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min={min}
          step={step || "any"}
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="h-10 pr-14 bg-white border-neutral-200 text-neutral-900 font-medium
                     focus:border-emerald-500 focus:ring-emerald-500/20 transition-colors"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold
                         uppercase tracking-wider text-neutral-400 pointer-events-none">
          {unit}
        </span>
      </div>
    </div>
  );
}

// ─── Anatomy Bar ────────────────────────────────────────────────
function AnatomyBar({ label, pct, color, value }: { label: string; pct: number; color: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-400 font-medium">{label}</span>
        <span className="text-white font-bold tabular-nums">R$ {fmt(value)} <span className="text-neutral-500 font-normal">({pct.toFixed(1)}%)</span></span>
      </div>
      <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export function Calculadora3DClient({ initialData }: Props) {
  const { inputs, outputs, updateInput, activePreset, applyPreset, resetAll } = useCalculator();
  const [pdfOpen, setPdfOpen] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [selectedFilament, setSelectedFilament] = useState("");

  // Sync printer data into calculator
  useEffect(() => {
    if (selectedPrinter && initialData.printers.length > 0) {
      const p = initialData.printers.find((pr) => pr.id === selectedPrinter);
      if (p) {
        updateInput("potenciaMedia", p.powerDraw);
      }
    }
  }, [selectedPrinter, initialData.printers, updateInput]);

  // Sync filament data into calculator
  useEffect(() => {
    if (selectedFilament && initialData.filaments.length > 0) {
      const f = initialData.filaments.find((fl) => fl.id === selectedFilament);
      if (f) {
        updateInput("precoFilamento", f.costPerGram * 1000); // costPerGram → R$/kg
      }
    }
  }, [selectedFilament, initialData.filaments, updateInput]);

  return (
    <div className="flex h-full flex-col gap-5 p-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Calculadora 3D</h1>
          <p className="text-sm text-muted-foreground">
            Motor de precificação em tempo real — do custo de filamento ao preço de venda.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={resetAll}>
            <ArrowsClockwise size={14} weight="bold" />
            Resetar
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold
                       shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40
                       hover:scale-[1.02] active:scale-[0.98] transition-all"
            onClick={() => setPdfOpen(true)}
          >
            <FileText size={14} weight="bold" />
            Salvar e gerar PDF
          </Button>
        </div>
      </header>

      {/* Presets Bar */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPreset(p)}
            className={`group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium
                        transition-all duration-200 border
                        ${activePreset === p.id
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30"
                          : "bg-card text-muted-foreground border-border hover:border-emerald-500/50 hover:bg-emerald-500/5"
                        }`}
          >
            <span className="text-base">{p.emoji}</span>
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-1">

        {/* ─── LEFT: Inputs ────────────────────────────────────── */}
        <Card className="lg:col-span-3 p-6 bg-[#faf9f6] border-neutral-200/60 shadow-sm">
          {/* CRM Integrations */}
          {(initialData.printers.length > 0 || initialData.filaments.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 pb-5 border-b border-neutral-200/60">
              {initialData.printers.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-neutral-600 flex items-center gap-1.5">
                    <PrinterIcon size={12} /> Impressora cadastrada
                  </Label>
                  <select
                    value={selectedPrinter}
                    onChange={(e) => setSelectedPrinter(e.target.value)}
                    className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm
                               text-neutral-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                  >
                    <option value="">Selecionar impressora...</option>
                    {initialData.printers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.powerDraw}W)</option>
                    ))}
                  </select>
                </div>
              )}
              {initialData.filaments.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-neutral-600 flex items-center gap-1.5">
                    <Package size={12} /> Filamento cadastrado
                  </Label>
                  <select
                    value={selectedFilament}
                    onChange={(e) => setSelectedFilament(e.target.value)}
                    className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm
                               text-neutral-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                  >
                    <option value="">Selecionar filamento...</option>
                    {initialData.filaments.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.material}) — R$ {(f.costPerGram * 1000).toFixed(0)}/kg
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Input Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-5">
            <InputField id="pesoPeca" label="Peso da peça" unit="G" value={inputs.pesoPeca} onChange={(v) => updateInput("pesoPeca", v)} />
            <InputField id="precoFilamento" label="Preço filamento" unit="R$/KG" value={inputs.precoFilamento} onChange={(v) => updateInput("precoFilamento", v)} />
            <InputField id="tempoImpressao" label="Tempo impressão" unit="H" value={inputs.tempoImpressao} onChange={(v) => updateInput("tempoImpressao", v)} step="0.25" />
            <InputField id="potenciaMedia" label="Potência média" unit="W" value={inputs.potenciaMedia} onChange={(v) => updateInput("potenciaMedia", v)} />
            <InputField id="tarifaEnergia" label="Tarifa energia" unit="R$/KWH" value={inputs.tarifaEnergia} onChange={(v) => updateInput("tarifaEnergia", v)} step="0.01" />
            <InputField id="valorMaquina" label="Valor da máquina" unit="R$" value={inputs.valorMaquina} onChange={(v) => updateInput("valorMaquina", v)} />
            <InputField id="vidaUtil" label="Vida útil" unit="H" value={inputs.vidaUtil} onChange={(v) => updateInput("vidaUtil", v)} />
            <InputField id="horaTrabalho" label="Hora trabalho" unit="R$/H" value={inputs.horaTrabalho} onChange={(v) => updateInput("horaTrabalho", v)} />
            <InputField id="horasManuais" label="Horas manuais" unit="H" value={inputs.horasManuais} onChange={(v) => updateInput("horasManuais", v)} step="0.1" />
            <InputField id="quantidade" label="Quantidade" unit="UN" value={inputs.quantidade} onChange={(v) => updateInput("quantidade", Math.max(1, Math.round(v)))} min={1} step="1" />
            <InputField id="riscoFalha" label="Risco de falha" unit="%" value={inputs.riscoFalha} onChange={(v) => updateInput("riscoFalha", v)} />
          </div>

          {/* Margin Slider */}
          <div className="mt-6 pt-5 border-t border-neutral-200/60">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-medium text-neutral-600">Margem de Lucro</Label>
              <span className="text-lg font-bold text-emerald-600 tabular-nums">{inputs.margemLucro}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={300}
              step={5}
              value={inputs.margemLucro}
              onChange={(e) => updateInput("margemLucro", Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer
                         bg-gradient-to-r from-red-400 via-amber-400 to-emerald-500
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5
                         [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md
                         [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-emerald-500
                         [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
            />
            <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
              <span>0%</span><span>150%</span><span>300%</span>
            </div>
          </div>
        </Card>

        {/* ─── RIGHT: Output Card (Dark Glassmorphic) ────────── */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card className="flex-1 p-6 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950
                           border-neutral-800/60 shadow-2xl shadow-emerald-900/10 overflow-hidden relative">
            {/* Subtle glow */}
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-5">
              {/* Big price */}
              <div className="text-center pb-4 border-b border-white/10">
                <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold mb-1">Preço Sugerido Unitário</p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={outputs.precoSugerido}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-4xl font-black text-white tabular-nums"
                  >
                    R$ {fmt(outputs.precoSugerido)}
                  </motion.p>
                </AnimatePresence>
                <p className="text-xs text-emerald-400 font-semibold mt-1">
                  Lucro: R$ {fmt(outputs.lucroUnitario)} / un
                </p>
              </div>

              {/* Anatomy */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 font-semibold mb-3">Anatomia do Custo</p>
                <div className="space-y-2.5">
                  <AnatomyBar label="Filamento" pct={outputs.pctFilamento} color="#10b981" value={outputs.custoFilamento} />
                  <AnatomyBar label="Energia" pct={outputs.pctEnergia} color="#3b82f6" value={outputs.custoEnergia} />
                  <AnatomyBar label="Depreciação" pct={outputs.pctDepreciacao} color="#8b5cf6" value={outputs.custoDepreciacao} />
                  <AnatomyBar label="Mão de obra" pct={outputs.pctTrabalho} color="#f59e0b" value={outputs.custoTrabalho} />
                  <AnatomyBar label="Risco falha" pct={outputs.pctFalha} color="#ef4444" value={outputs.custoFalha} />
                </div>
              </div>

              {/* Summary Grid */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
                <SummaryCell label="Custo unitário" value={`R$ ${fmt(outputs.custoTotalUnitario)}`} />
                <SummaryCell label="Preço unitário" value={`R$ ${fmt(outputs.precoSugerido)}`} accent />
                <SummaryCell label={`Custo lote (${inputs.quantidade}un)`} value={`R$ ${fmt(outputs.custoLote)}`} />
                <SummaryCell label={`Preço lote (${inputs.quantidade}un)`} value={`R$ ${fmt(outputs.precoLote)}`} accent />
                <SummaryCell label="Lucro do lote" value={`R$ ${fmt(outputs.lucroLote)}`} accent />
                <SummaryCell
                  label="ROI da máquina"
                  value={outputs.pecasParaPagar === Infinity ? "∞" : `${outputs.pecasParaPagar} peças`}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* PDF Modal */}
      <QuotePdfModal
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        inputs={inputs}
        outputs={outputs}
        contacts={initialData.contacts}
      />
    </div>
  );
}

// ─── Summary Cell ───────────────────────────────────────────────
function SummaryCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
      <p className="text-[10px] text-neutral-500 font-medium mb-0.5">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${accent ? "text-emerald-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
