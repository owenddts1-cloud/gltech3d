"use client";

import React from "react";
import { motion } from "motion/react";
import { LaserDropzone } from "@/components/calc3d/LaserDropzone";
import type { Parsed3DFile } from "@/lib/slicer/3d-file-parser";
import { Scale, Clock, Layers, ArrowRight, CheckCircle2, FileText } from "lucide-react";

interface Step1XRayProps {
  parsedData: Parsed3DFile | null;
  onParsed: (data: Parsed3DFile) => void;
  onNext: () => void;
}

export function Step1XRay({ parsedData, onParsed, onNext }: Step1XRayProps) {
  const totalMinutes = parsedData
    ? parsedData.totalTimeSeconds
      ? parsedData.totalTimeSeconds / 60
      : (parsedData.printTimeMinutes ?? 0)
    : 0;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  const totalWeight = parsedData
    ? (parsedData.totalWeightGrams ?? parsedData.weightGrams ?? 0)
    : 0;
  const plateCount = parsedData
    ? (parsedData.platesCount ?? parsedData.plateCount ?? 1)
    : 1;
  const fileName = parsedData ? (parsedData.filename || parsedData.fileName || "arquivo") : "";
  const slicerName = parsedData ? (parsedData.slicer || parsedData.slicerSoftware || "Slicer") : "Slicer";

  return (
    <div className="space-y-6">
      {/* Header com Dropzone de Arquivo */}
      <div className="rounded-2xl border border-[#E8E3DA] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-[#C89666]/15 px-2.5 py-0.5 text-xs font-black tracking-wide text-[#8E6D4D]">
                ETAPA 1 / 4
              </span>
              <h2 className="font-sora text-xl font-bold text-[#241F1C]">
                Raio-X do Projeto 3D
              </h2>
            </div>
            <p className="mt-1 text-sm text-[#736B63]">
              O arquivo não mente: leia gramas reais, tempo fatiado e distribuição de filamento.
            </p>
          </div>

          {parsedData && (
            <div className="flex items-center gap-2 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{fileName} · lido ✓</span>
            </div>
          )}
        </div>

        <div className="mt-5">
          <LaserDropzone onFileParsed={onParsed} />
        </div>
      </div>

      {/* Grid de Métricas Principais (Bancada Industrial) */}
      {parsedData ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Card Massa */}
            <div className="relative overflow-hidden rounded-2xl border border-[#E8E3DA] bg-[#241F1C] p-5 text-white shadow-md">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#C89666]">
                <span>Massa de filamento</span>
                <Scale className="h-4 w-4" />
              </div>
              <p className="mt-3 font-sora text-3xl font-black text-white">
                {totalWeight.toFixed(1)}
                <span className="ml-1 text-base font-medium text-[#C89666]">g</span>
              </p>
              <p className="mt-1 text-xs text-[#D5CBBF]">
                {parsedData.filaments.length > 1
                  ? `${parsedData.filaments.length} filamentos fatiados`
                  : "Consumo total do modelo"}
              </p>
            </div>

            {/* Card Tempo */}
            <div className="relative overflow-hidden rounded-2xl border border-[#E8E3DA] bg-[#241F1C] p-5 text-white shadow-md">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#38BDF8]">
                <span>Tempo estimado</span>
                <Clock className="h-4 w-4" />
              </div>
              <p className="mt-3 font-sora text-3xl font-black text-white">
                {hours}h {minutes}m
              </p>
              <p className="mt-1 text-xs text-[#D5CBBF]">
                {(totalMinutes / 60).toFixed(2)} horas de máquina
              </p>
            </div>

            {/* Card Placas */}
            <div className="relative overflow-hidden rounded-2xl border border-[#E8E3DA] bg-[#241F1C] p-5 text-white shadow-md">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#F59E0B]">
                <span>Placas / Mesas</span>
                <Layers className="h-4 w-4" />
              </div>
              <p className="mt-3 font-sora text-3xl font-black text-white">
                {plateCount} {plateCount === 1 ? "mesa" : "mesas"}
              </p>
              <p className="mt-1 text-xs text-[#D5CBBF]">
                Format: .{parsedData.format.toUpperCase()} ({slicerName})
              </p>
            </div>
          </div>

          {/* Barra de Decomposição Multi-Segmentada */}
          <div className="rounded-2xl border border-[#E8E3DA] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-sora text-sm font-bold text-[#241F1C]">
                Decomposição por Estrutura de Camadas
              </h3>
              <span className="text-xs font-medium text-[#736B63]">
                Estimativa do fatiador
              </span>
            </div>

            {/* Barra */}
            <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-[#E8E3DA]">
              <div
                className="h-full bg-[#A27953]"
                style={{ width: "53%" }}
                title="Paredes (53%)"
              />
              <div
                className="h-full bg-[#C89666]"
                style={{ width: "37%" }}
                title="Preenchimento / Infill (37%)"
              />
              <div
                className="h-full bg-[#D5CBBF]"
                style={{ width: "9%" }}
                title="Topo e Base (9%)"
              />
              <div
                className="h-full bg-[#16A34A]"
                style={{ width: "1%" }}
                title="Brim e Suportes (1%)"
              />
            </div>

            {/* Legenda */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#A27953]" />
                <span className="font-semibold text-[#241F1C]">Paredes (53%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#C89666]" />
                <span className="font-semibold text-[#241F1C]">Preenchimento (37%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#D5CBBF]" />
                <span className="font-semibold text-[#241F1C]">Topo e Base (9%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#16A34A]" />
                <span className="font-semibold text-[#241F1C]">Brim & Suporte (1%)</span>
              </div>
            </div>
          </div>

          {/* Rodapé da Etapa com Botão de Avanço */}
          <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-[#E8E3DA] bg-[#FAF8F5] p-4 sm:flex-row">
            <span className="text-xs font-semibold italic text-[#736B63]">
              "Cada grama e cada minuto, por placa."
            </span>

            <button
              type="button"
              onClick={onNext}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#8E6D4D] to-[#A6815C] px-6 py-3 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Avançar para Vínculo de Estoque
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-[#E8E3DA] bg-[#FAF8F5] p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-[#A27953]/60" />
          <h3 className="mt-3 font-sora text-base font-bold text-[#241F1C]">
            Nenhum arquivo 3D carregado ainda
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-[#736B63]">
            Arraste um arquivo .3mf, .gcode ou .stl na caixa acima para inspecionar o Raio-X do seu projeto.
          </p>
        </div>
      )}
    </div>
  );
}
