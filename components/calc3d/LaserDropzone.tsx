'use client';

import { useState, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Upload, CheckCircle2, AlertCircle, FileCode, Sparkles } from 'lucide-react';
import { parse3DFile, type Parsed3DFile } from '@/lib/slicer/3d-file-parser';

interface LaserDropzoneProps {
  onFileParsed: (data: Parsed3DFile) => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

export function LaserDropzone({
  onFileParsed,
  disabled = false,
  className = '',
  compact = false,
}: LaserDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [parsedResult, setParsedResult] = useState<Parsed3DFile | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reducedMotion = useReducedMotion();

  const handleProcessFile = async (file: File) => {
    setErrorMsg(null);
    setIsScanning(true);

    try {
      // Pequeno delay para a animação do laser scanner ser percebida fluidamente
      const [result] = await Promise.all([
        parse3DFile(file),
        new Promise((resolve) => setTimeout(resolve, reducedMotion ? 50 : 450)),
      ]);

      if (result.success || result.format === 'stl') {
        setParsedResult(result);
        onFileParsed(result);
      } else {
        setErrorMsg(result.warning || 'Não foi possível extrair dados válidos do arquivo.');
      }
    } catch {
      setErrorMsg('Erro inesperado ao processar arquivo.');
    } finally {
      setIsScanning(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled || isScanning) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isScanning) {
      setIsDragOver(true);
    }
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".gcode,.3mf,.stl,.gco"
        className="hidden"
        onChange={onFileInputChange}
        disabled={disabled || isScanning}
      />

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !isScanning && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            fileInputRef.current?.click();
          }
        }}
        className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-200 ${
          compact ? 'p-4' : 'p-6 md:p-8'
        } ${
          isDragOver
            ? 'scale-[1.01] border-[#A27953] bg-[#A27953]/5 shadow-[0_0_20px_rgba(162,121,83,0.15)]'
            : isScanning
            ? 'border-[#C89666] bg-[#241F1C]/5'
            : parsedResult
            ? 'border-[#16A34A]/50 bg-[#16A34A]/5'
            : 'border-[#E8E2D9] bg-[#FDFCFA] hover:border-[#A27953]/60 hover:bg-[#FAF8F5]'
        }`}
      >
        {/* Linha animada do Scanner Laser 3D */}
        {isScanning && !reducedMotion && (
          <motion.div
            initial={{ top: '0%' }}
            animate={{ top: ['0%', '100%', '0%'] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="pointer-events-none absolute inset-x-0 z-20 h-[3px] bg-gradient-to-r from-transparent via-[#C89666] to-transparent shadow-[0_0_14px_#A27953]"
          />
        )}

        {/* Conteúdo Central */}
        {isScanning ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#A27953]/15 text-[#A27953] animate-pulse">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold text-[#2D241E]">
              Escaneando camadas e filamento...
            </p>
            <p className="text-[10px] text-[#A6815C]">
              Lendo metadados de impressão 3D
            </p>
          </div>
        ) : parsedResult ? (
          <div className="flex w-full items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#16A34A]/15 text-[#16A34A]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="overflow-hidden">
                <span className="flex items-center gap-2">
                  <span className="truncate text-xs font-bold text-[#2D241E]">
                    {parsedResult.filename}
                  </span>
                  <span className="rounded bg-[#16A34A]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#16A34A]">
                    Lido ✓
                  </span>
                </span>
                <p className="text-[11px] text-[#6B5E55]">
                  {parsedResult.slicer !== 'Unknown' ? `${parsedResult.slicer} · ` : ''}
                  {parsedResult.totalWeightGrams > 0 ? `${parsedResult.totalWeightGrams}g · ` : ''}
                  {parsedResult.totalTimeSeconds > 0
                    ? `${(parsedResult.totalTimeSeconds / 3600).toFixed(1)}h`
                    : ''}
                  {parsedResult.platesCount > 1 ? ` · ${parsedResult.platesCount} placas` : ''}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#A27953] hover:underline shrink-0">
              Trocar arquivo
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E8E2D9] bg-white text-[#A27953] shadow-xs group-hover:scale-105 transition-transform">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#2D241E]">
                Arraste o arquivo fatiado (<span className="text-[#A27953]">.gcode</span> ou{' '}
                <span className="text-[#A27953]">.3mf</span>)
              </p>
              <p className="mt-0.5 text-[11px] text-[#6B5E55]">
                O fatiador já gravou tempo e peso. Clique ou solte aqui para preencher na hora.
              </p>
            </div>
          </div>
        )}

        {/* Mensagem de Erro / Aviso */}
        {errorMsg && (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#E05D38]/10 px-3 py-1.5 text-[11px] font-semibold text-[#E05D38]">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
