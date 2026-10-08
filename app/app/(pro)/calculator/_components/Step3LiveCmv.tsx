"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import type { SlicedFilamentInfo } from "@/lib/slicer/3d-file-parser";
import { NumberTicker } from "@/components/calc3d/NumberTicker";
import { ArrowLeft, ArrowRight, DollarSign, Wrench, Zap, Cpu, Sparkles } from "lucide-react";

export interface LiveCmvParams {
  filaments: SlicedFilamentInfo[];
  stockMap: Record<number, { costPerGram: number }>;
  printHours: number;
  powerDrawW?: number;
  energyTariff?: number;
  depreciationPerHour?: number;
  maintenancePerHour?: number;
  manualHours?: number;
  manualRatePerHour?: number;
  markup?: number;
}

export interface LiveCmvResult {
  materialCost: number;
  machineCost: number;
  finishingCost: number;
  totalCmv: number;
  markup: number;
  suggestedPrice: number;
  unitProfit: number;
  profitPerHour: number;
}

export function calculateLiveCmv(params: LiveCmvParams): LiveCmvResult {
  const {
    filaments,
    stockMap,
    printHours,
    powerDrawW = 350,
    energyTariff = 0.95,
    depreciationPerHour = 1.5,
    maintenancePerHour = 0.8,
    manualHours = 0.25,
    manualRatePerHour = 30.0,
    markup = 2.0,
  } = params;

  // 1. Custo de Materiais
  let materialCost = 0;
  filaments.forEach((fil, idx) => {
    const costPerGram = stockMap[idx]?.costPerGram ?? 0.12;
    materialCost += fil.weightGrams * costPerGram;
  });

  // 2. Custo de Máquina (Energia + Depreciação + Manutenção)
  const energyCostPerHour = (powerDrawW / 1000) * energyTariff;
  const machineRatePerHour = energyCostPerHour + depreciationPerHour + maintenancePerHour;
  const machineCost = printHours * machineRatePerHour;

  // 3. Custo de Acabamento Manual
  const finishingCost = manualHours * manualRatePerHour;

  // 4. CMV Total
  const totalCmv = materialCost + machineCost + finishingCost;

  // 5. Preço Sugerido e Lucro
  const suggestedPrice = totalCmv * markup;
  const unitProfit = suggestedPrice - totalCmv;
  const profitPerHour = printHours > 0 ? unitProfit / printHours : unitProfit;

  return {
    materialCost: Number(materialCost.toFixed(2)),
    machineCost: Number(machineCost.toFixed(2)),
    finishingCost: Number(finishingCost.toFixed(2)),
    totalCmv: Number(totalCmv.toFixed(2)),
    markup,
    suggestedPrice: Number(suggestedPrice.toFixed(2)),
    unitProfit: Number(unitProfit.toFixed(2)),
    profitPerHour: Number(profitPerHour.toFixed(2)),
  };
}

interface Step3LiveCmvProps {
  filaments: SlicedFilamentInfo[];
  stockMap: Record<number, { costPerGram: number }>;
  printHours: number;
  onNext?: (result: LiveCmvResult) => void;
  onBack: () => void;
}

const MARKUP_PRESETS = [1.5, 2.0, 2.5, 3.0];

export function Step3LiveCmv({
  filaments,
  stockMap,
  printHours,
  onNext,
  onBack,
}: Step3LiveCmvProps) {
  const [markup, setMarkup] = useState<number>(2.0);
  const [manualHours, setManualHours] = useState<number>(0.25);
  const [manualRate, setManualRate] = useState<number>(30.0);

  const cmv = calculateLiveCmv({
    filaments,
    stockMap,
    printHours,
    manualHours,
    manualRatePerHour: manualRate,
    markup,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-[#E8E3DA] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="rounded bg-[#C89666]/15 px-2.5 py-0.5 text-xs font-black tracking-wide text-[#8E6D4D]">
            ETAPA 3 / 4
          </span>
          <h2 className="font-sora text-xl font-bold text-[#241F1C]">
            Calculadora & CMV ao Vivo
          </h2>
        </div>
        <p className="mt-1 text-sm text-[#736B63]">
          Custo real apurado na ponta do lápis: materiais consumidos + horas de máquina + acabamento manual.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Painel Esquerdo: Decomposição de Custos */}
        <div className="space-y-4 lg:col-span-3">
          <div className="rounded-2xl border border-[#E8E3DA] bg-white p-6 shadow-sm">
            <h3 className="font-sora text-sm font-bold uppercase tracking-wider text-[#736B63]">
              Decomposição de Custos Diretos
            </h3>

            <div className="mt-4 divide-y divide-[#E8E3DA]">
              {/* Materiais */}
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C89666]/15 text-[#8E6D4D]">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#241F1C]">Filamentos & Insumos</p>
                    <p className="text-xs text-[#736B63]">
                      Baseado nas gramas reais fatiadas
                    </p>
                  </div>
                </div>
                <span className="font-sora text-sm font-black text-[#241F1C]">
                  R$ {cmv.materialCost.toFixed(2)}
                </span>
              </div>

              {/* Máquina */}
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                    <Cpu className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#241F1C]">Máquina & Energia</p>
                    <p className="text-xs text-[#736B63]">
                      {printHours.toFixed(1)}h de operação (energia + desgaste + bico)
                    </p>
                  </div>
                </div>
                <span className="font-sora text-sm font-black text-[#241F1C]">
                  R$ {cmv.machineCost.toFixed(2)}
                </span>
              </div>

              {/* Acabamento */}
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#241F1C]">Mão de Obra & Pós-Processamento</p>
                    <p className="text-xs text-[#736B63]">
                      Retirada de suportes, lixamento e inspeção ({manualHours}h)
                    </p>
                  </div>
                </div>
                <span className="font-sora text-sm font-black text-[#241F1C]">
                  R$ {cmv.finishingCost.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Ajustes Rápidos de Acabamento */}
            <div className="mt-5 rounded-xl border border-[#E8E3DA] bg-[#FAF8F5] p-3 text-xs">
              <span className="font-bold text-[#241F1C]">Ajuste de Acabamento Manual:</span>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#736B63]">Tempo Manual (horas)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={manualHours}
                    onChange={(e) => setManualHours(Math.max(0, Number(e.target.value)))}
                    className="mt-1 w-full rounded-lg border border-[#E8E3DA] bg-white px-2.5 py-1.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#736B63]">Sua Hora Técnica (R$/h)</label>
                  <input
                    type="number"
                    step="5"
                    min="0"
                    value={manualRate}
                    onChange={(e) => setManualRate(Math.max(0, Number(e.target.value)))}
                    className="mt-1 w-full rounded-lg border border-[#E8E3DA] bg-white px-2.5 py-1.5 text-xs font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seletor de Markup */}
          <div className="rounded-2xl border border-[#E8E3DA] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-sora text-sm font-bold text-[#241F1C]">
                  Multiplicador de Margem (Markup)
                </h3>
                <p className="text-xs text-[#736B63]">
                  Selecione o multiplicador sobre o CMV ou ajuste livremente
                </p>
              </div>
              <span className="rounded-full bg-[#C89666]/15 px-3 py-1 font-sora text-xs font-black text-[#8E6D4D]">
                {markup.toFixed(1)}x
              </span>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              {MARKUP_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMarkup(m)}
                  className={`rounded-xl py-2.5 text-xs font-bold transition-all ${
                    markup === m
                      ? "bg-[#241F1C] text-white shadow-md"
                      : "border border-[#E8E3DA] bg-[#FAF8F5] text-[#241F1C] hover:bg-[#E8E3DA]"
                  }`}
                >
                  {m.toFixed(1)}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Painel Direito: Card Expresso com Preço e Lucro */}
        <div className="lg:col-span-2">
          <div className="rounded-3xl border border-[#E8E3DA] bg-[#241F1C] p-6 text-white shadow-lg">
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#C89666]">
              CMV Total (Custo Direto)
            </span>
            <p className="mt-1 font-sora text-2xl font-bold text-[#D5CBBF]">
              R$ {cmv.totalCmv.toFixed(2)}
            </p>

            <div className="my-5 border-t border-white/10" />

            <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#C89666]">
              Preço Sugerido (Unitário)
            </span>
            <div className="mt-1 font-sora text-4xl font-black text-white">
              <NumberTicker value={cmv.suggestedPrice} prefix="R$ " />
            </div>
            <p className="mt-2 text-xs text-[#D5CBBF]">
              Lucro líquido por peça: <span className="font-bold text-emerald-400">R$ {cmv.unitProfit.toFixed(2)}</span>
            </p>

            {/* Destaque: Lucro por Hora de Máquina */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#D5CBBF]">Lucro por Hora</span>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-400">
                  {cmv.profitPerHour >= 20 ? "Alta Rentabilidade" : "Rentabilidade Normal"}
                </span>
              </div>
              <p className="mt-2 font-sora text-2xl font-black text-emerald-400">
                R$ {cmv.profitPerHour.toFixed(2)}
                <span className="text-xs font-normal text-[#D5CBBF]"> / hora</span>
              </p>
              <p className="mt-1 text-[11px] text-[#D5CBBF]">
                {(printHours).toFixed(1)}h de impressão retornam R$ {cmv.unitProfit.toFixed(2)} de margem.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onNext && onNext(cmv)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8E6D4D] to-[#A6815C] px-5 py-3.5 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Avançar para Viabilidade em Lote
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onBack}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 py-2.5 text-xs font-semibold text-[#D5CBBF] hover:bg-white/5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar para Estoque
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé da Etapa */}
      <div className="rounded-xl border border-[#E8E3DA] bg-[#FAF8F5] p-4 text-center">
        <span className="text-xs font-semibold italic text-[#736B63]">
          "Materiais + máquina + acabamento → preço sugerido."
        </span>
      </div>
    </div>
  );
}
