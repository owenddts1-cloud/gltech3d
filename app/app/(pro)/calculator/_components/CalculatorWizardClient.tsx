"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Step1XRay } from "./Step1XRay";
import { Step2StockLink, autoMatchFilament, type StockFilament } from "./Step2StockLink";
import type { Parsed3DFile } from "@/lib/slicer/3d-file-parser";
import { Sparkles, Layers, Box, DollarSign, BarChart3, Check } from "lucide-react";

interface PrinterItem {
  id: string;
  name: string;
  powerDraw: number;
  depreciationPerHour: number;
}

interface ContactItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface CalculatorWizardClientProps {
  initialFilaments: StockFilament[];
  initialPrinters: PrinterItem[];
  initialContacts: ContactItem[];
  orgId: string;
}

const STEPS = [
  { id: 1, label: "Raio-X 3D", icon: Layers, desc: "Gramas e tempos" },
  { id: 2, label: "Vínculo de Estoque", icon: Box, desc: "Casar bobinas" },
  { id: 3, label: "CMV ao Vivo", icon: DollarSign, desc: "Custos e margem" },
  { id: 4, label: "Viabilidade em Lote", icon: BarChart3, desc: "Projeção de N peças" },
];

export function CalculatorWizardClient({
  initialFilaments,
  initialPrinters,
  initialContacts,
  orgId,
}: CalculatorWizardClientProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [parsedData, setParsedData] = useState<Parsed3DFile | null>(null);
  const [mappings, setMappings] = useState<Record<number, string>>({});

  // Auto-matching ao carregar arquivo
  const handleFileParsed = (data: Parsed3DFile) => {
    setParsedData(data);
    const newMappings: Record<number, string> = {};
    data.filaments.forEach((fil, idx) => {
      const matched = autoMatchFilament(fil, initialFilaments);
      if (matched) {
        newMappings[idx] = matched;
      }
    });
    setMappings(newMappings);
  };

  const handleUpdateMapping = (index: number, stockId: string) => {
    setMappings((prev) => ({ ...prev, [index]: stockId }));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Top Banner de Navegação do Wizard */}
      <div className="rounded-2xl border border-[#E8E3DA] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STEPS.map((step) => {
            const isActive = currentStep === step.id;
            const isDone = currentStep > step.id;
            const StepIcon = step.icon;

            return (
              <button
                key={step.id}
                type="button"
                disabled={step.id > 1 && !parsedData}
                onClick={() => setCurrentStep(step.id)}
                className={`relative flex items-center gap-3 rounded-xl p-3 text-left transition-all ${
                  isActive
                    ? "bg-[#241F1C] text-white shadow-md"
                    : isDone
                    ? "bg-[#FAF8F5] text-[#241F1C] hover:bg-[#F2ECE4]"
                    : "opacity-50 hover:opacity-80"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isActive
                      ? "bg-[#C89666] text-white"
                      : isDone
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-[#E8E3DA] text-[#736B63]"
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold leading-tight">
                    {step.id}. {step.label}
                  </p>
                  <p
                    className={`truncate text-[10px] ${
                      isActive ? "text-[#D5CBBF]" : "text-[#736B63]"
                    }`}
                  >
                    {step.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo Dinâmico por Etapa */}
      <AnimatePresence mode="wait">
        {currentStep === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            <Step1XRay
              parsedData={parsedData}
              onParsed={handleFileParsed}
              onNext={() => setCurrentStep(2)}
            />
          </motion.div>
        )}

        {currentStep === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            <Step2StockLink
              parsedFilaments={
                parsedData
                  ? parsedData.filaments
                  : [
                      {
                        name: "Filamento Principal",
                        colorHex: "#C89666",
                        material: "PLA",
                        weightGrams: 50,
                        usedMeters: 15,
                      },
                    ]
              }
              stockFilaments={initialFilaments}
              mappings={mappings}
              onUpdateMapping={handleUpdateMapping}
              onNext={() => setCurrentStep(3)}
              onBack={() => setCurrentStep(1)}
            />
          </motion.div>
        )}

        {currentStep === 3 && (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-[#E8E3DA] bg-white p-8 text-center"
          >
            <h3 className="font-sora text-lg font-bold text-[#241F1C]">
              Etapa 3: CMV ao Vivo
            </h3>
            <p className="mt-2 text-sm text-[#736B63]">
              Em construção na Task 5.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="rounded-xl border border-[#E8E3DA] px-4 py-2 text-xs font-bold"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="rounded-xl bg-[#241F1C] px-4 py-2 text-xs font-bold text-white"
              >
                Avançar para Etapa 4
              </button>
            </div>
          </motion.div>
        )}

        {currentStep === 4 && (
          <motion.div
            key="step-4"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-[#E8E3DA] bg-white p-8 text-center"
          >
            <h3 className="font-sora text-lg font-bold text-[#241F1C]">
              Etapa 4: Viabilidade em Lote
            </h3>
            <p className="mt-2 text-sm text-[#736B63]">
              Em construção na Task 5.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="rounded-xl border border-[#E8E3DA] px-4 py-2 text-xs font-bold"
              >
                Voltar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
