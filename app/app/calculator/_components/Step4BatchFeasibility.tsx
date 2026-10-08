"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { NumberTicker } from "@/components/calc3d/NumberTicker";
import {
  ArrowLeft,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  FileSpreadsheet,
  FileText,
  Printer,
  Boxes,
} from "lucide-react";

export interface BatchFeasibilityParams {
  quantity: number;
  weightGramsPerPiece: number;
  printHoursPerPiece: number;
  unitCmv: number;
  unitPrice: number;
  stockAvailableGrams?: number;
  costPerGram?: number;
  activePrintersCount?: number;
  dailyOperatingHours?: number;
}

export interface BatchFeasibilityResult {
  quantity: number;
  totalWeightKg: number;
  stockAvailableGrams: number;
  stockSufficient: boolean;
  deficitGrams: number;
  deficitCost: number;
  totalHours: number;
  totalDays: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitPerHour: number;
}

export function calculateBatchFeasibility(
  params: BatchFeasibilityParams
): BatchFeasibilityResult {
  const {
    quantity,
    weightGramsPerPiece,
    printHoursPerPiece,
    unitCmv,
    unitPrice,
    stockAvailableGrams = 2000,
    costPerGram = 0.12,
    activePrintersCount = 1,
    dailyOperatingHours = 16,
  } = params;

  const validQty = Math.max(1, quantity);
  const totalWeightGrams = validQty * weightGramsPerPiece;
  const totalWeightKg = Number((totalWeightGrams / 1000).toFixed(2));

  const stockSufficient = stockAvailableGrams >= totalWeightGrams;
  const deficitGrams = stockSufficient ? 0 : Math.round(totalWeightGrams - stockAvailableGrams);
  const deficitCost = Number((deficitGrams * costPerGram).toFixed(2));

  const totalHours = Number((validQty * printHoursPerPiece).toFixed(1));
  const printers = Math.max(1, activePrintersCount);
  const dailyCapacityHours = printers * dailyOperatingHours;
  const totalDays = Math.ceil(totalHours / (dailyCapacityHours || 1));

  const totalRevenue = Number((validQty * unitPrice).toFixed(2));
  const totalCost = Number((validQty * unitCmv).toFixed(2));
  const totalProfit = Number((totalRevenue - totalCost).toFixed(2));
  const profitPerHour = totalHours > 0 ? Number((totalProfit / totalHours).toFixed(2)) : totalProfit;

  return {
    quantity: validQty,
    totalWeightKg,
    stockAvailableGrams,
    stockSufficient,
    deficitGrams,
    deficitCost,
    totalHours,
    totalDays,
    totalRevenue,
    totalCost,
    totalProfit,
    profitPerHour,
  };
}

interface Step4BatchFeasibilityProps {
  unitWeightGrams: number;
  unitPrintHours: number;
  unitCmv: number;
  unitPrice: number;
  costPerGram?: number;
  stockAvailableGrams?: number;
  activePrintersCount?: number;
  onBack: () => void;
  onSaveProposal?: (data: BatchFeasibilityResult) => Promise<void>;
  onCreateServiceOrder?: (data: BatchFeasibilityResult) => Promise<void>;
  onExportPdf?: (data: BatchFeasibilityResult) => void;
}

export function Step4BatchFeasibility({
  unitWeightGrams,
  unitPrintHours,
  unitCmv,
  unitPrice,
  costPerGram = 0.12,
  stockAvailableGrams = 2000,
  activePrintersCount = 1,
  onBack,
  onSaveProposal,
  onCreateServiceOrder,
  onExportPdf,
}: Step4BatchFeasibilityProps) {
  const [quantity, setQuantity] = useState<number>(10);
  const [isSavingProposal, setIsSavingProposal] = useState(false);
  const [isCreatingOs, setIsCreatingOs] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const batch = calculateBatchFeasibility({
    quantity,
    weightGramsPerPiece: unitWeightGrams,
    printHoursPerPiece: unitPrintHours,
    unitCmv,
    unitPrice,
    costPerGram,
    stockAvailableGrams,
    activePrintersCount,
  });

  const handleSaveProposal = async () => {
    if (!onSaveProposal) return;
    try {
      setIsSavingProposal(true);
      setFeedback(null);
      await onSaveProposal(batch);
      setFeedback("Proposta salva com sucesso no CRM!");
    } catch {
      setFeedback("Erro ao salvar proposta.");
    } finally {
      setIsSavingProposal(false);
    }
  };

  const handleCreateOs = async () => {
    if (!onCreateServiceOrder) return;
    try {
      setIsCreatingOs(true);
      setFeedback(null);
      await onCreateServiceOrder(batch);
      setFeedback("Ordem de Serviço emitida com sucesso na Farm 3D!");
    } catch {
      setFeedback("Erro ao emitir ordem de serviço.");
    } finally {
      setIsCreatingOs(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-[#E8E3DA] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-[#C89666]/15 px-2.5 py-0.5 text-xs font-black tracking-wide text-[#8E6D4D]">
                ETAPA 4 / 4
              </span>
              <h2 className="font-sora text-xl font-bold text-[#241F1C]">
                Análise de Viabilidade em Lote
              </h2>
            </div>
            <p className="mt-1 text-sm text-[#736B63]">
              Simule a produção de lotes em escala: estoque suficiente, gargalo de máquinas e retorno financeiro.
            </p>
          </div>

          {/* Seletor de Quantidade do Lote */}
          <div className="flex items-center gap-3 rounded-2xl border border-[#E8E3DA] bg-[#FAF8F5] p-2">
            <span className="pl-2 text-xs font-bold text-[#241F1C]">Lote:</span>
            <div className="flex items-center gap-1">
              {[1, 5, 10, 25, 50, 100].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuantity(q)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    quantity === q
                      ? "bg-[#241F1C] text-white shadow-sm"
                      : "text-[#736B63] hover:bg-[#E8E3DA]"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 rounded-lg border border-[#E8E3DA] bg-white px-2 py-1 text-center text-xs font-black text-[#241F1C]"
            />
          </div>
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
          {feedback}
        </div>
      )}

      {/* Grid de 4 Barras de Viabilidade */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Barra 1: Estoque */}
        <div className="rounded-2xl border border-[#E8E3DA] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-[#736B63]">
            <span>1. Estoque de Filamento</span>
            <Boxes className="h-4 w-4" />
          </div>

          <p className="mt-3 font-sora text-2xl font-black text-[#241F1C]">
            {batch.totalWeightKg} kg
          </p>
          <p className="text-xs text-[#736B63]">
            Consumo total para {batch.quantity} peças
          </p>

          <div className="mt-3">
            {batch.stockSufficient ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Estoque suficiente no CRM</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-[#E05D38]">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Faltam {(batch.deficitGrams / 1000).toFixed(2)}kg (R$ {batch.deficitCost.toFixed(2)})</span>
              </div>
            )}
          </div>
        </div>

        {/* Barra 2: Prazo & Capacidade */}
        <div className="rounded-2xl border border-[#E8E3DA] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-[#736B63]">
            <span>2. Prazo & Oficina</span>
            <Calendar className="h-4 w-4 text-sky-600" />
          </div>

          <p className="mt-3 font-sora text-2xl font-black text-[#241F1C]">
            {batch.totalDays} {batch.totalDays === 1 ? "dia útil" : "dias úteis"}
          </p>
          <p className="text-xs text-[#736B63]">
            {batch.totalHours}h de máquina total
          </p>

          <div className="mt-3 rounded-lg bg-sky-50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-800">
            {activePrintersCount} {activePrintersCount === 1 ? "impressora alocada" : "impressoras operando"}
          </div>
        </div>

        {/* Barra 3: Rentabilidade */}
        <div className="rounded-2xl border border-[#E8E3DA] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-[#736B63]">
            <span>3. Rentabilidade / Hora</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>

          <p className="mt-3 font-sora text-2xl font-black text-emerald-600">
            R$ {batch.profitPerHour.toFixed(2)}
            <span className="text-xs font-normal text-[#736B63]"> / h</span>
          </p>
          <p className="text-xs text-[#736B63]">
            Margem gerada por hora rodando
          </p>

          <div className="mt-3 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800">
            Excelente rendimento de farm
          </div>
        </div>

        {/* Barra 4: Meta Financeira */}
        <div className="rounded-2xl border border-[#E8E3DA] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-[#736B63]">
            <span>4. Retorno do Lote</span>
            <span className="rounded bg-[#C89666]/15 px-1.5 py-0.5 text-[10px] font-black text-[#8E6D4D]">
              FATURAMENTO
            </span>
          </div>

          <p className="mt-3 font-sora text-2xl font-black text-[#241F1C]">
            R$ {batch.totalRevenue.toFixed(2)}
          </p>
          <p className="text-xs font-bold text-emerald-600">
            + R$ {batch.totalProfit.toFixed(2)} lucro líquido
          </p>

          <div className="mt-3 rounded-lg bg-[#FAF8F5] px-2.5 py-1.5 text-[11px] font-medium text-[#736B63]">
            Custo total de lote: R$ {batch.totalCost.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Card de Conversão & Ações Executivas */}
      <div className="rounded-3xl border border-[#E8E3DA] bg-[#241F1C] p-6 text-white shadow-lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#C89666]">
              Ações Executivas da Oficina
            </span>
            <h3 className="mt-1 font-sora text-lg font-bold text-white">
              Tudo pronto para aprovar ou produzir este lote
            </h3>
            <p className="mt-1 text-xs text-[#D5CBBF]">
              Envie ao cliente como orçamento profissional ou despache direto para a fila de impressão da farm.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isSavingProposal}
              onClick={handleSaveProposal}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-xs font-bold text-white transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4 text-[#C89666]" />
              Salvar como Proposta no CRM
            </button>

            <button
              type="button"
              disabled={isCreatingOs}
              onClick={handleCreateOs}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-xs font-bold text-white transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
            >
              <Printer className="h-4 w-4 text-sky-400" />
              Emitir Ordem de Serviço
            </button>

            <button
              type="button"
              onClick={() => onExportPdf && onExportPdf(batch)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#8E6D4D] to-[#A6815C] px-5 py-3 text-xs font-bold text-white shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <FileText className="h-4 w-4" />
              Gerar PDF com a sua Marca
            </button>
          </div>
        </div>
      </div>

      {/* Rodapé com Navegação */}
      <div className="flex items-center justify-between rounded-xl border border-[#E8E3DA] bg-[#FAF8F5] p-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8E3DA] bg-white px-4 py-2 text-xs font-bold text-[#736B63] hover:bg-zinc-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para CMV
        </button>

        <span className="text-xs font-semibold italic text-[#736B63]">
          "E se eu fizer [ N ] peças? Estoque, prazo e lucro na mesma tela."
        </span>
      </div>
    </div>
  );
}
