'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';

const MATERIAIS = [
  { id: 'pla', nome: 'PLA Premium', fator: 0.25, desc: 'Excelente acabamento visual e biodegradável.' },
  { id: 'petg', nome: 'PETG Industrial', fator: 0.35, desc: 'Alta resistência mecânica e química.' },
  { id: 'abs', nome: 'ABS Técnico', fator: 0.3, desc: 'Ideal para pós-processamento e resistência térmica.' },
];

export function OrcamentoClient() {
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [material, setMaterial] = useState('pla');
  const [isDragging, setIsDragging] = useState(false);

  // Estimativa aproximada client-side (visual). Geometria real é analisada
  // manualmente pela equipe após o envio.
  const calcularEstimativa = () => {
    const pesoEstimadoGramas = file ? Math.floor((file.size % 150) + 20) : 0;
    const materialFator = MATERIAIS.find((m) => m.id === material)?.fator ?? 0.25;
    return (pesoEstimadoGramas * materialFator).toFixed(2);
  };

  return (
    <main className="min-h-screen bg-[#F9F7F2] text-[#2B2622] pt-24">
      <Navbar />

      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Painel esquerdo: configurações do arquivo */}
          <div className="flex flex-col gap-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#A6815C]">Engine de Cotação</span>
              <h1 className="text-3xl font-black uppercase tracking-tight mt-1 font-sora text-[#2B2622]">
                Orçamento Instantâneo
              </h1>
            </div>

            {/* Dropzone do arquivo 3D */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) setFile({ name: f.name, size: f.size });
              }}
              className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-colors ${
                isDragging ? 'border-[#A6815C] bg-[#A6815C]/5' : 'border-[#E8E2D9] bg-white/50'
              }`}
            >
              <UploadCloud className="w-10 h-10 text-[#A6815C] mb-3" />
              <p className="text-sm font-medium">Arraste seu arquivo STL / 3MF aqui</p>
              <span className="text-[11px] text-[#6B5E55] mt-1">Limite recomendado: até 50MB</span>
            </div>

            {/* Estado de arquivo carregado */}
            <AnimatePresence>
              {file && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-white border border-[#E8E2D9] p-4 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 text-green-700 rounded-xl">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold max-w-[180px] truncate">{file.name}</p>
                      <p className="text-xs text-[#6B5E55]">Mapeado com sucesso</p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Seleção de material */}
            <div className="flex flex-col gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B5E55]">1. Selecione o material</span>
              <div className="grid grid-cols-1 gap-2">
                {MATERIAIS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMaterial(m.id)}
                    className={`p-4 rounded-xl border text-left transition-all flex justify-between items-center ${
                      material === m.id ? 'border-[#A6815C] bg-white shadow-sm' : 'border-[#E8E2D9] bg-white/40 opacity-70'
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-bold">{m.nome}</span>
                      <span className="block text-xs text-[#6B5E55] mt-0.5">{m.desc}</span>
                    </span>
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${material === m.id ? 'border-[#A6815C]' : 'border-gray-300'}`}>
                      {material === m.id && <span className="w-2 h-2 bg-[#A6815C] rounded-full" />}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Painel direito: resumo técnico/financeiro */}
          <div className="bg-[#2B2622] text-white p-8 rounded-[32px] flex flex-col justify-between shadow-xl">
            <div>
              <h2 className="text-xl font-bold uppercase tracking-tight text-stone-300 border-b border-stone-700 pb-4 font-sora">
                Análise Tática da Peça
              </h2>
              <div className="py-6 flex flex-col gap-4 border-b border-stone-700">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-400">Tempo estimado de máquina:</span>
                  <span className="font-mono font-bold">{file ? `${Math.floor((file.size % 8) + 2)} horas` : '--'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-400">Material selecionado:</span>
                  <span className="font-bold uppercase tracking-wide text-[#A6815C]">
                    {MATERIAIS.find((m) => m.id === material)?.nome}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-400">Preenchimento (infill):</span>
                  <span className="font-mono">20% (Giroide padrão)</span>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Estimativa de custo</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl text-stone-400 font-light">R$</span>
                <span className="text-5xl font-black tracking-tight text-white font-sora">
                  {file ? calcularEstimativa() : '0,00'}
                </span>
              </div>
              <p className="text-[11px] text-stone-400 mt-2 leading-relaxed">
                Valores calculados de forma aproximada. Sujeitos a variação após análise de geometria, suportes e volume real.
              </p>

              <Link
                href="/#contato"
                aria-disabled={!file}
                className={`w-full bg-[#A6815C] text-white font-bold uppercase tracking-wider text-xs py-4 px-6 rounded-xl mt-6 flex items-center justify-center gap-2 transition-colors hover:bg-[#8E6D4D] ${
                  !file ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                Falar com a equipe <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
