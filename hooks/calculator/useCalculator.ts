"use client";

import { useState, useMemo, useCallback } from "react";

// ─── Input Types ────────────────────────────────────────────────
export interface CalculatorInputs {
  pesoPeca: number;          // g
  precoFilamento: number;    // R$/kg
  tempoImpressao: number;    // h
  potenciaMedia: number;     // W
  tarifaEnergia: number;     // R$/kWh
  valorMaquina: number;      // R$
  vidaUtil: number;          // h
  horaTrabalho: number;      // R$/h
  horasManuais: number;      // h
  quantidade: number;        // un
  margemLucro: number;       // %
  riscoFalha: number;        // %
}

// ─── Output Types ───────────────────────────────────────────────
export interface CalculatorOutputs {
  custoFilamento: number;
  custoEnergia: number;
  custoDepreciacao: number;
  custoTrabalho: number;
  custoBase: number;
  custoFalha: number;
  custoTotalUnitario: number;
  precoSugerido: number;
  lucroUnitario: number;
  pecasParaPagar: number;
  custoLote: number;
  precoLote: number;
  lucroLote: number;
  // Percentages for the anatomy chart
  pctFilamento: number;
  pctEnergia: number;
  pctDepreciacao: number;
  pctTrabalho: number;
  pctFalha: number;
}

// ─── Presets ────────────────────────────────────────────────────
export interface Preset {
  id: string;
  label: string;
  description: string;
  values: Partial<CalculatorInputs>;
}

export const PRESETS: Preset[] = [
  {
    id: "chaveiro",
    label: "Chaveiro",
    description: "Peça leve e rápida",
    values: {
      pesoPeca: 12,
      tempoImpressao: 0.75,
      riscoFalha: 5,
      margemLucro: 120,
      horasManuais: 0.15,
      quantidade: 1,
    },
  },
  {
    id: "peca-tecnica",
    label: "Peça técnica",
    description: "Funcional, filamento especial",
    values: {
      pesoPeca: 150,
      tempoImpressao: 8,
      riscoFalha: 8,
      margemLucro: 80,
      horasManuais: 0.5,
      quantidade: 1,
    },
  },
  {
    id: "miniatura",
    label: "Miniatura",
    description: "Alta resolução e detalhe",
    values: {
      pesoPeca: 45,
      tempoImpressao: 5,
      riscoFalha: 15,
      margemLucro: 150,
      horasManuais: 1,
      quantidade: 1,
    },
  },
  {
    id: "lote-10",
    label: "Lote 10 un",
    description: "Produção em escala",
    values: {
      pesoPeca: 45,
      tempoImpressao: 5,
      riscoFalha: 5,
      margemLucro: 70,
      horasManuais: 0.25,
      quantidade: 10,
    },
  },
];

// ─── Default Input Values ───────────────────────────────────────
export const DEFAULT_INPUTS: CalculatorInputs = {
  pesoPeca: 45,
  precoFilamento: 120,
  tempoImpressao: 3,
  potenciaMedia: 200,
  tarifaEnergia: 0.85,
  valorMaquina: 3500,
  vidaUtil: 5000,
  horaTrabalho: 25,
  horasManuais: 0.25,
  quantidade: 1,
  margemLucro: 100,
  riscoFalha: 5,
};

// ─── Calculator Engine ─────────────────────────────────────────
function calculate(inputs: CalculatorInputs): CalculatorOutputs {
  const {
    pesoPeca, precoFilamento, tempoImpressao, potenciaMedia,
    tarifaEnergia, valorMaquina, vidaUtil, horaTrabalho,
    horasManuais, quantidade, margemLucro, riscoFalha,
  } = inputs;

  // 1. Custo de Filamento
  const custoFilamento = (pesoPeca / 1000) * precoFilamento;

  // 2. Custo de Energia
  const custoEnergia = tempoImpressao * (potenciaMedia / 1000) * tarifaEnergia;

  // 3. Custo de Depreciação da Máquina
  const custoDepreciacao = vidaUtil > 0
    ? tempoImpressao * (valorMaquina / vidaUtil)
    : 0;

  // 4. Custo de Mão de Obra
  const custoTrabalho = horasManuais * horaTrabalho;

  // 5. Custo Base
  const custoBase = custoFilamento + custoEnergia + custoDepreciacao + custoTrabalho;

  // 6. Custo de Risco de Falhas
  const custoFalha = custoBase * (riscoFalha / 100);

  // 7. Custo Real Unitário Total
  const custoTotalUnitario = custoBase + custoFalha;

  // 8. Preço Sugerido Unitário
  const precoSugerido = custoTotalUnitario * (1 + margemLucro / 100);

  // 9. Lucro Unitário Líquido
  const lucroUnitario = precoSugerido - custoTotalUnitario;

  // 10. ROI do Ativo (Peças para pagar a máquina)
  const pecasParaPagar = lucroUnitario > 0
    ? Math.ceil(valorMaquina / lucroUnitario)
    : Infinity;

  // Lote values
  const custoLote = custoTotalUnitario * quantidade;
  const precoLote = precoSugerido * quantidade;
  const lucroLote = lucroUnitario * quantidade;

  // Anatomy percentages
  const total = custoTotalUnitario || 1; // prevent division by zero
  const pctFilamento = (custoFilamento / total) * 100;
  const pctEnergia = (custoEnergia / total) * 100;
  const pctDepreciacao = (custoDepreciacao / total) * 100;
  const pctTrabalho = (custoTrabalho / total) * 100;
  const pctFalha = (custoFalha / total) * 100;

  return {
    custoFilamento: round(custoFilamento),
    custoEnergia: round(custoEnergia),
    custoDepreciacao: round(custoDepreciacao),
    custoTrabalho: round(custoTrabalho),
    custoBase: round(custoBase),
    custoFalha: round(custoFalha),
    custoTotalUnitario: round(custoTotalUnitario),
    precoSugerido: round(precoSugerido),
    lucroUnitario: round(lucroUnitario),
    pecasParaPagar,
    custoLote: round(custoLote),
    precoLote: round(precoLote),
    lucroLote: round(lucroLote),
    pctFilamento: round(pctFilamento, 1),
    pctEnergia: round(pctEnergia, 1),
    pctDepreciacao: round(pctDepreciacao, 1),
    pctTrabalho: round(pctTrabalho, 1),
    pctFalha: round(pctFalha, 1),
  };
}

function round(n: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

// ─── Hook ───────────────────────────────────────────────────────
export function useCalculator(initialInputs?: Partial<CalculatorInputs>) {
  const [inputs, setInputs] = useState<CalculatorInputs>({
    ...DEFAULT_INPUTS,
    ...initialInputs,
  });
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const outputs = useMemo(() => calculate(inputs), [inputs]);

  const updateInput = useCallback(
    <K extends keyof CalculatorInputs>(key: K, value: CalculatorInputs[K]) => {
      setInputs((prev) => ({ ...prev, [key]: value }));
      setActivePreset(null); // user deviated from preset
    },
    [],
  );

  const applyPreset = useCallback((preset: Preset) => {
    setInputs((prev) => ({ ...prev, ...preset.values }));
    setActivePreset(preset.id);
  }, []);

  const resetAll = useCallback(() => {
    setInputs(DEFAULT_INPUTS);
    setActivePreset(null);
  }, []);

  return {
    inputs,
    setInputs,
    outputs,
    updateInput,
    activePreset,
    applyPreset,
    resetAll,
  };
}
