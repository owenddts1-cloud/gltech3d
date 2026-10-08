"use client";

import React from "react";
import { motion } from "motion/react";
import type { SlicedFilamentInfo } from "@/lib/slicer/3d-file-parser";
import { ArrowLeft, ArrowRight, Check, Sparkles, Box } from "lucide-react";

export interface StockFilament {
  id: string;
  name: string;
  color: string;
  material: string;
  costPerGram: number;
}

/**
 * Heurística de auto-match entre o filamento detectado no arquivo
 * e as bobinas em estoque no CRM.
 */
export function autoMatchFilament(
  parsed: SlicedFilamentInfo,
  stock: StockFilament[]
): string | null {
  if (!stock || stock.length === 0) return null;

  const parsedMat = (parsed.material || parsed.type || "").trim().toLowerCase();
  const parsedColor = (parsed.name || parsed.colorName || "").trim().toLowerCase();

  // 1. Tentar match exato de material e cor
  const exactMatch = stock.find((item) => {
    const itemMat = (item.material || "").toLowerCase();
    const itemColor = (item.color || "").toLowerCase();
    const itemName = (item.name || "").toLowerCase();

    const matMatches = parsedMat ? itemMat.includes(parsedMat) || parsedMat.includes(itemMat) : true;
    const colorMatches =
      parsedColor &&
      (itemColor.includes(parsedColor) ||
        parsedColor.includes(itemColor) ||
        itemName.includes(parsedColor));

    return matMatches && colorMatches;
  });

  if (exactMatch) return exactMatch.id;

  // 2. Tentar match apenas por material
  if (parsedMat) {
    const matMatch = stock.find((item) => {
      const itemMat = (item.material || "").toLowerCase();
      return itemMat.includes(parsedMat) || parsedMat.includes(itemMat);
    });
    if (matMatch) return matMatch.id;
  }

  // 3. Fallback: primeiro item do estoque se existir
  return stock[0]?.id ?? null;
}

interface Step2StockLinkProps {
  parsedFilaments: SlicedFilamentInfo[];
  stockFilaments: StockFilament[];
  mappings: Record<number, string>;
  onUpdateMapping: (index: number, stockId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step2StockLink({
  parsedFilaments,
  stockFilaments,
  mappings,
  onUpdateMapping,
  onNext,
  onBack,
}: Step2StockLinkProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-[#E8E3DA] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="rounded bg-[#C89666]/15 px-2.5 py-0.5 text-xs font-black tracking-wide text-[#8E6D4D]">
            ETAPA 2 / 4
          </span>
          <h2 className="font-sora text-xl font-bold text-[#241F1C]">
            Vínculo com o Estoque Real
          </h2>
        </div>
        <p className="mt-1 text-sm text-[#736B63]">
          O Calc3D casa cada filamento do arquivo com as bobinas físicas cadastradas na sua oficina.
        </p>
      </div>

      {/* Grid de 2 Colunas com Conector */}
      <div className="rounded-2xl border border-[#E8E3DA] bg-white p-6 shadow-sm">
        <div className="mb-4 grid grid-cols-1 gap-4 text-xs font-bold uppercase tracking-wider text-[#736B63] sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#A27953]" />
            <span>NO ARQUIVO (.3MF / .GCODE)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>NO SEU ESTOQUE (CRM)</span>
          </div>
        </div>

        <div className="space-y-4">
          {parsedFilaments.map((filament, index) => {
            const selectedStockId = mappings[index] || "";
            const matchedStock = stockFilaments.find((s) => s.id === selectedStockId);

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className="relative grid grid-cols-1 items-center gap-4 rounded-xl border border-[#E8E3DA] bg-[#FAF8F5] p-4 sm:grid-cols-2"
              >
                {/* Lado Esquerdo: No Arquivo */}
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 shrink-0 rounded-xl border border-black/10 shadow-sm"
                    style={{ backgroundColor: filament.colorHex || "#C89666" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sora text-sm font-bold text-[#241F1C]">
                      {filament.name || filament.colorName || `Extrusor ${index + 1}`}
                    </p>
                    <p className="text-xs text-[#736B63]">
                      <span className="font-semibold text-[#A27953]">
                        {filament.material || filament.type || "PLA"}
                      </span>
                      {" · "}
                      <span className="font-mono text-[11px]">{filament.colorHex}</span>
                      {" · "}
                      <span className="font-bold text-[#241F1C]">
                        {Number.isInteger(filament.weightGrams)
                          ? filament.weightGrams
                          : filament.weightGrams.toFixed(1)}g consumidos
                      </span>
                    </p>
                  </div>
                </div>

                {/* Lado Direito: No Estoque */}
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <select
                      value={selectedStockId}
                      onChange={(e) => onUpdateMapping(index, e.target.value)}
                      className="w-full rounded-xl border border-[#E8E3DA] bg-white px-3 py-2.5 text-xs font-medium text-[#241F1C] shadow-sm focus:border-[#A27953] focus:outline-none focus:ring-1 focus:ring-[#A27953]"
                    >
                      {stockFilaments.length === 0 ? (
                        <option value="">Nenhum filamento cadastrado no CRM</option>
                      ) : (
                        stockFilaments.map((stock) => (
                          <option key={stock.id} value={stock.id}>
                            {stock.name} ({stock.material} - {stock.color}) — R$ {(stock.costPerGram * 1000).toFixed(2)}/kg
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {matchedStock && (
                    <div
                      title="Bobina vinculada com sucesso"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-sm"
                    >
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {stockFilaments.length === 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <span className="font-bold">Aviso de Estoque:</span> Sua organização ainda não possui bobinas cadastradas na aba de Filamentos. O cálculo usará a taxa padrão de R$ 120,00/kg.
          </div>
        )}
      </div>

      {/* Rodapé da Etapa */}
      <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-[#E8E3DA] bg-[#FAF8F5] p-4 sm:flex-row">
        <span className="text-xs font-semibold italic text-[#736B63]">
          "Pelo custo médio do que você pagou. Você só confirma."
        </span>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8E3DA] bg-white px-4 py-2.5 text-xs font-bold text-[#736B63] transition hover:bg-zinc-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>

          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#8E6D4D] to-[#A6815C] px-6 py-2.5 text-xs font-bold text-white shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Avançar para CMV ao Vivo
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
