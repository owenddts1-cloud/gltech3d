'use client';

import { useState } from 'react';
import { RotateCcw, Save, Check, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  useCalculator,
  PRESETS,
  type CalculatorInputs,
} from '@/hooks/calculator/useCalculator';
import {
  totalHours,
  formatHours,
  roiSentence,
  costAnatomy,
  marginTone,
} from '@/lib/calculator/public-view-model';
import { formatBRL } from '@/lib/pricing/pro-plans';
import { track } from '@/lib/analytics/track';
import { LaserDropzone } from '@/components/calc3d/LaserDropzone';
import { NumberTicker } from '@/components/calc3d/NumberTicker';
import { MotionTabs } from '@/components/calc3d/MotionTabs';
import { LeadProposalModal } from './LeadProposalModal';
import type { Parsed3DFile } from '@/lib/slicer/3d-file-parser';
import { toast } from 'sonner';

/** Campo numérico com rótulo, unidade e dica. */
function Field(props: {
  label: string;
  hint: string;
  unit: string;
  value: number;
  step?: number;
  min?: number;
  onChange: (v: number) => void;
  /** Extra line under the input (e.g. the filament cross-sell link). */
  footer?: React.ReactNode;
}) {
  const { label, hint, unit, value, step = 1, min = 0, onChange, footer } = props;
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-[#2D241E]">{label}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#A6815C]">{unit}</span>
      </span>
      <span className="mt-0.5 block text-xs text-[#6B5E55]">{hint}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const next = Number.parseFloat(e.target.value);
          onChange(Number.isFinite(next) ? next : 0);
        }}
        className="mt-2 w-full rounded-xl border border-[#E8E2D9] bg-white px-3 py-2.5 text-sm font-semibold text-[#2D241E] outline-none transition-colors focus:border-[#A6815C] focus:ring-2 focus:ring-[#A6815C]/25"
      />
      {footer}
    </label>
  );
}

function Fieldset(props: { legend: string; children: React.ReactNode; cols?: string }) {
  return (
    <fieldset className="rounded-2xl border border-[#E8E2D9] bg-[#FDFCFA] p-5">
      <legend className="px-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#A6815C]">
        {props.legend}
      </legend>
      <div className={`grid gap-5 ${props.cols ?? 'sm:grid-cols-2'}`}>{props.children}</div>
    </fieldset>
  );
}

/** Um número do painel de resultado. */
function Stat(props: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-[#D5CBBF]">
        {props.label}
      </span>
      <span className={`mt-1 block font-sora font-black ${props.strong ? 'text-2xl' : 'text-lg'} text-white`}>
        {props.value}
      </span>
    </div>
  );
}

/**
 * defaults = calculator defaults from platform_settings (server page prop).
 * A value saved in this browser still wins over them (useCalculator).
 */
export function CalculatorBlock({
  defaults,
  filamentFromCentsPerKg = null,
}: {
  defaults?: Partial<CalculatorInputs>;
  /** Lowest R$/kg of the filament storefront (cents); null = link without price. */
  filamentFromCentsPerKg?: number | null;
}) {
  const { inputs, outputs, updateInput, activePreset, applyPreset, resetAll, saveDefaults } =
    useCalculator(defaults);
  const [saved, setSaved] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);

  const set = <K extends keyof CalculatorInputs>(key: K) => (v: CalculatorInputs[K]) =>
    updateInput(key, v);

  const handleFileParsed = (data: Parsed3DFile) => {
    if (data.totalWeightGrams > 0) {
      updateInput('pesoPeca', Math.round(data.totalWeightGrams * 10) / 10);
    }
    if (data.totalTimeSeconds > 0) {
      updateInput('tempoImpressao', Math.round((data.totalTimeSeconds / 3600) * 100) / 100);
    }
    toast.success(
      `Arquivo fatiado identificado: ${data.filename} (${data.totalWeightGrams}g · ${(data.totalTimeSeconds / 3600).toFixed(1)}h)`
    );
  };

  const roi = roiSentence(outputs);
  const anatomy = costAnatomy(outputs);
  const tone = marginTone(inputs.margemLucro);
  const profitShare =
    outputs.precoSugerido > 0 ? (outputs.lucroUnitario / outputs.precoSugerido) * 100 : 0;

  const onSave = () => {
    if (saveDefaults()) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    }
  };

  return (
    <section id="calculadora" className="px-6 py-16 md:py-24">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-10 max-w-2xl">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#A6815C]">
            Grátis · sem cadastro
          </span>
          <h2 className="mt-2 font-sora text-3xl font-black tracking-tight text-[#2D241E] md:text-4xl">
            Calculadora de custo real da sua peça.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#6B5E55]">
            Filamento, energia, desgaste da máquina, suas horas e o risco de falha — somados antes de
            você mandar o orçamento. O cálculo roda no seu navegador e os valores ficam salvos aqui.
          </p>
        </header>

        {/* Presets com MotionTabs */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <MotionTabs
            tabs={PRESETS.map((p) => ({ id: p.id, label: p.label, description: p.description }))}
            activeTab={activePreset ?? ''}
            onSelect={(id) => {
              const p = PRESETS.find((preset) => preset.id === id);
              if (p) applyPreset(p);
            }}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E2D9] bg-white px-4 py-2 text-xs font-bold text-[#6B5E55] transition-colors hover:border-[#A6815C] hover:text-[#2D241E]"
            >
              {saved ? <Check className="h-3.5 w-3.5 text-[#6F7F52]" /> : <Save className="h-3.5 w-3.5" />}
              {saved ? 'Salvo neste navegador' : 'Salvar meus valores'}
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E2D9] bg-white px-4 py-2 text-xs font-bold text-[#6B5E55] transition-colors hover:border-[#A6815C] hover:text-[#2D241E]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Resetar
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Entradas */}
          <div className="space-y-5 lg:col-span-3">
            {/* Scanner Laser 3D Dropzone */}
            <LaserDropzone onFileParsed={handleFileParsed} className="mb-2" />

            <Fieldset legend="Material e tempo">
              <Field
                label="Peso da peça"
                hint="Peso no fatiador, já com suportes."
                unit="g"
                value={inputs.pesoPeca}
                onChange={set('pesoPeca')}
              />
              <Field
                label="Preço do filamento"
                hint="Quanto custa 1 kg do material."
                unit="R$/kg"
                value={inputs.precoFilamento}
                onChange={set('precoFilamento')}
                footer={
                  <Link
                    href="/filamentos?origem=calculadora"
                    onClick={() => track('click_filamento', { origem: 'calculadora_campo' })}
                    className="mt-1.5 block text-[11px] font-bold text-[#7A5C3E] underline-offset-4 hover:text-[#2D241E] hover:underline"
                  >
                    Sem filamento ou pagando caro? Ver PLA, PETG e PLA+
                    {filamentFromCentsPerKg ? ` a partir de ${formatBRL(filamentFromCentsPerKg)}/kg` : ''} →
                  </Link>
                }
              />
              <Field
                label="Tempo de impressão"
                hint="Horas que o fatiador estima."
                unit="h"
                step={0.25}
                value={inputs.tempoImpressao}
                onChange={set('tempoImpressao')}
              />
              <Field
                label="Potência média"
                hint="Consumo da impressora, em watts."
                unit="W"
                value={inputs.potenciaMedia}
                onChange={set('potenciaMedia')}
              />
            </Fieldset>

            <Fieldset legend="Operação e trabalho">
              <Field
                label="Tarifa de energia"
                hint="Preço do kWh na sua conta de luz."
                unit="R$/kWh"
                step={0.05}
                value={inputs.tarifaEnergia}
                onChange={set('tarifaEnergia')}
              />
              <Field
                label="Valor da máquina"
                hint="O que você pagou na impressora."
                unit="R$"
                step={100}
                value={inputs.valorMaquina}
                onChange={set('valorMaquina')}
              />
              <Field
                label="Vida útil"
                hint="Horas totais estimadas da máquina."
                unit="h"
                step={500}
                value={inputs.vidaUtil}
                onChange={set('vidaUtil')}
              />
              <Field
                label="Hora de trabalho"
                hint="Quanto vale 1 hora do seu tempo."
                unit="R$/h"
                step={5}
                value={inputs.horaTrabalho}
                onChange={set('horaTrabalho')}
              />
              <Field
                label="Horas manuais"
                hint="Setup, acabamento e embalagem."
                unit="h"
                step={0.05}
                value={inputs.horasManuais}
                onChange={set('horasManuais')}
              />
              <Field
                label="Quantidade"
                hint="Peças iguais neste lote."
                unit="un"
                min={1}
                value={inputs.quantidade}
                onChange={set('quantidade')}
              />
            </Fieldset>

            <Fieldset legend="Margem e risco" cols="sm:grid-cols-1">
              <div className="rounded-xl border border-[#E8E2D9] bg-white p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <span className="block text-sm font-bold text-[#2D241E]">Margem de lucro</span>
                    <span className="mt-0.5 block text-xs text-[#6B5E55]">
                      Lucro sobre o custo real — arraste para simular.
                    </span>
                  </div>
                  <span className={`font-sora text-2xl font-black ${tone.text}`}>
                    {inputs.margemLucro}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={300}
                  step={5}
                  value={inputs.margemLucro}
                  onChange={(e) => updateInput('margemLucro', Number(e.target.value))}
                  aria-label="Margem de lucro"
                  className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full"
                  style={{
                    background: `linear-gradient(to right, ${tone.bar} 0%, ${tone.bar} ${(inputs.margemLucro / 300) * 100}%, #E8E2D9 ${(inputs.margemLucro / 300) * 100}%, #E8E2D9 100%)`,
                  }}
                />
              </div>
              <Field
                label="Risco de falha"
                hint="Reserva para reimprimir se a peça falhar."
                unit="%"
                value={inputs.riscoFalha}
                onChange={set('riscoFalha')}
              />
            </Fieldset>
          </div>

          {/* Resultado */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-28 rounded-3xl bg-[#2D241E] p-6 text-white shadow-[0_24px_60px_-20px_rgba(43,38,34,0.55)]">
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#C89666]">
                Preço sugerido
              </span>
              <div className="mt-1 font-sora text-5xl font-black leading-none text-white">
                <NumberTicker value={outputs.precoSugerido} prefix="R$ " />
              </div>
              <p className="mt-2 text-xs text-[#D5CBBF]">
                por peça · lote {formatBRL(Math.round(outputs.precoLote * 100))}
              </p>

              {/* Custo vs lucro com física spring */}
              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-[#D5CBBF]">Custo vs lucro no preço</span>
                  <span className="text-[#C89666]">{Math.round(profitShare)}% lucro</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#4F433A]">
                  <motion.div
                    className="h-full rounded-full bg-[#A6815C]"
                    initial={false}
                    animate={{ width: `${Math.min(100, Math.max(0, profitShare))}%` }}
                    transition={{ type: 'spring', stiffness: 260, damping: 25 }}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat label="Custo unitário" value={formatBRL(Math.round(outputs.custoTotalUnitario * 100))} />
                <Stat label="Lucro unitário" value={formatBRL(Math.round(outputs.lucroUnitario * 100))} />
                <Stat label="Tempo total" value={formatHours(totalHours(inputs))} />
                <Stat label="Só filamento" value={formatBRL(Math.round(outputs.custoFilamento * 100))} />
              </div>

              <div className="mt-6">
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#C89666]">
                  Anatomia do custo
                </span>
                <ul className="mt-3 space-y-2.5">
                  {anatomy.map((row) => (
                    <li key={row.key}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-semibold text-[#F9F7F2]">{row.label}</span>
                        <span className="font-bold text-white">{formatBRL(Math.round(row.value * 100))}</span>
                      </div>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#4F433A]">
                        <motion.div
                          className="h-full rounded-full bg-[#A6815C]"
                          initial={false}
                          animate={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }}
                          transition={{ type: 'spring', stiffness: 260, damping: 25 }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <motion.p
                key={roi.text}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`mt-6 rounded-xl border px-4 py-3 text-xs font-semibold leading-relaxed ${
                  roi.healthy
                    ? 'border-[#A6815C]/40 bg-[#A6815C]/15 text-[#F9F7F2]'
                    : 'border-[#B4553F]/50 bg-[#B4553F]/20 text-[#F9F7F2]'
                }`}
              >
                {roi.text}
              </motion.p>

              <button
                type="button"
                onClick={() => setLeadModalOpen(true)}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8E6D4D] to-[#A6815C] px-5 py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Transformar isso em venda no PRO
                <ArrowRight className="h-4 w-4" />
              </button>
              <Link
                href="/filamentos?origem=calculadora"
                onClick={() => track('click_filamento', { origem: 'calculadora', peso_g: Math.round(inputs.pesoPeca) })}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-bold text-[#F9F7F2] transition-colors hover:border-[#A6815C] hover:bg-white/5"
              >
                Comprar o filamento desta peça
              </Link>
              <p className="mt-3 text-center text-[11px] text-[#D5CBBF]">
                Calcular é grátis e não pede cadastro. O PRO registra a venda, a produção e o estoque.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Proposta & Captura de Lead */}
      <LeadProposalModal
        isOpen={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        pesoPeca={inputs.pesoPeca}
        tempoImpressao={inputs.tempoImpressao}
        precoSugerido={outputs.precoSugerido}
        quantidade={inputs.quantidade}
      />
    </section>
  );
}
