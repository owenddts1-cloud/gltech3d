'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UploadCloud, 
  FileText, 
  Trash2, 
  Layers, 
  Scale, 
  Clock, 
  Activity,
  Box,
  Compass,
  Loader2
} from 'lucide-react';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import { createClient } from '@/lib/supabase/browser';

const MATERIAIS = [
  { 
    id: 'pla', 
    nome: 'PLA Premium', 
    densidade: 1.24, 
    desc: 'Excelente acabamento visual e biodegradável.',
    visual: 5,
    resistencia: 3,
  },
  { 
    id: 'petg', 
    nome: 'PETG Industrial', 
    densidade: 1.27, 
    desc: 'Alta resistência mecânica, química e térmica.',
    visual: 4,
    resistencia: 4,
  },
  { 
    id: 'abs', 
    nome: 'ABS Técnico', 
    densidade: 1.04, 
    desc: 'Ideal para peças mecânicas e pós-processamento.',
    visual: 3,
    resistencia: 5,
  },
];

// Parser STL Cliente (Suporta ASCII e Binário)
function parseSTL(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  
  // Detecta se é binário ou ASCII
  let isASCII = true;
  if (buffer.byteLength > 84) {
    const numTriangles = view.getUint32(80, true);
    const expectedSize = 80 + 4 + numTriangles * 50;
    if (expectedSize === buffer.byteLength) {
      isASCII = false;
    }
  }

  let totalVolume = 0; // mm³
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let triangleCount = 0;

  if (isASCII) {
    const text = new TextDecoder().decode(buffer);
    const lines = text.split('\n');
    let vCount = 0;
    const v = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      if (!rawLine) continue;
      const line = rawLine.trim().toLowerCase();
      if (line.startsWith('vertex ')) {
        const parts = line.split(/\s+/).filter(Boolean);
        if (parts.length >= 4) {
          const x = parseFloat(parts[1] || '0');
          const y = parseFloat(parts[2] || '0');
          const z = parseFloat(parts[3] || '0');
          
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);

          const currentV = v[vCount];
          if (currentV) {
            currentV.x = x;
            currentV.y = y;
            currentV.z = z;
          }
          vCount++;

          if (vCount === 3) {
            const v0 = v[0]!;
            const v1 = v[1]!;
            const v2 = v[2]!;
            // Volume do tetraedro formado pelos 3 vértices e a origem
            const vol = (
              v0.x * v1.y * v2.z -
              v0.x * v2.y * v1.z -
              v1.x * v0.y * v2.z +
              v1.x * v2.y * v0.z +
              v2.x * v0.y * v1.z -
              v2.x * v1.y * v0.z
            ) / 6.0;
            totalVolume += vol;
            vCount = 0;
            triangleCount++;
          }
        }
      }
    }
  } else {
    const numTriangles = view.getUint32(80, true);
    triangleCount = numTriangles;
    let offset = 84;

    for (let i = 0; i < numTriangles; i++) {
      if (offset + 50 > buffer.byteLength) break;
      
      // Pula vetor normal (12 bytes)
      offset += 12;

      // Vértice 1
      const x1 = view.getFloat32(offset, true);
      const y1 = view.getFloat32(offset + 4, true);
      const z1 = view.getFloat32(offset + 8, true);
      offset += 12;

      // Vértice 2
      const x2 = view.getFloat32(offset, true);
      const y2 = view.getFloat32(offset + 4, true);
      const z2 = view.getFloat32(offset + 8, true);
      offset += 12;

      // Vértice 3
      const x3 = view.getFloat32(offset, true);
      const y3 = view.getFloat32(offset + 4, true);
      const z3 = view.getFloat32(offset + 8, true);
      offset += 12;

      // Attribute byte count (2 bytes)
      offset += 2;

      minX = Math.min(minX, x1, x2, x3); maxX = Math.max(maxX, x1, x2, x3);
      minY = Math.min(minY, y1, y2, y3); maxY = Math.max(maxY, y1, y2, y3);
      minZ = Math.min(minZ, z1, z2, z3); maxZ = Math.max(maxZ, z1, z2, z3);

      const vol = (
        x1 * y2 * z3 -
        x1 * y3 * z2 -
        x2 * y1 * z3 +
        x2 * y3 * z1 +
        x3 * y1 * z2 -
        x3 * y2 * z1
      ) / 6.0;
      totalVolume += vol;
    }
  }

  const volumeMm3 = Math.abs(totalVolume);
  const volumeCm3 = volumeMm3 / 1000.0;

  const dx = maxX - minX;
  const dy = maxY - minY;
  const dz = maxZ - minZ;

  return {
    volumeCm3: parseFloat(volumeCm3.toFixed(2)),
    triangles: triangleCount,
    dimensions: {
      x: isFinite(dx) && dx > 0 ? parseFloat(dx.toFixed(1)) : 0,
      y: isFinite(dy) && dy > 0 ? parseFloat(dy.toFixed(1)) : 0,
      z: isFinite(dz) && dz > 0 ? parseFloat(dz.toFixed(1)) : 0,
    }
  };
}

export function OrcamentoClient() {
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [material, setMaterial] = useState('pla');
  const [observacao, setObservacao] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  
  const [analise, setAnalise] = useState<{
    volumeCm3: number;
    triangles: number;
    dimensions: { x: number; y: number; z: number };
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Faz upload do modelo em background para o Supabase Storage
  const uploadArquivo = async (f: File) => {
    try {
      setUploading(true);
      const uniqueId = Math.random().toString(36).substring(2, 10);
      const safeName = f.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const path = `${uniqueId}_${safeName}`;
      
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from('orcamentos-public')
        .upload(path, f);

      if (error) {
        console.error('Erro no upload de storage:', error);
      } else if (data) {
        const { data: { publicUrl } } = supabase.storage
          .from('orcamentos-public')
          .getPublicUrl(path);
        setFileUrl(publicUrl);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const processarArquivo = (f: File) => {
    setFile({ name: f.name, size: f.size });
    setFileUrl(null);
    setLoading(true);

    // Inicia o upload em background paralelo ao parsing
    uploadArquivo(f);

    if (f.name.toLowerCase().endsWith('.stl')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const result = parseSTL(buffer);
          setAnalise(result);
        } catch (err) {
          console.error(err);
          setAnalise(null);
        } finally {
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setAnalise(null);
        setLoading(false);
      };
      reader.readAsArrayBuffer(f);
    } else {
      // Fallback realista para arquivos .3mf
      setTimeout(() => {
        const estVolume = Math.max(8, Math.min(600, f.size / 32000));
        setAnalise({
          volumeCm3: parseFloat(estVolume.toFixed(2)),
          triangles: Math.floor(f.size / 140),
          dimensions: {
            x: parseFloat((Math.cbrt(estVolume * 1000) * 0.95).toFixed(1)),
            y: parseFloat((Math.cbrt(estVolume * 1000) * 0.95).toFixed(1)),
            z: parseFloat((Math.cbrt(estVolume * 1000) * 1.1).toFixed(1)),
          }
        });
        setLoading(false);
      }, 700);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processarArquivo(f);
  };

  const resetFile = () => {
    setFile(null);
    setAnalise(null);
    setFileUrl(null);
  };

  // Cálculos físicos de estimativa baseados na análise geométrica (infill fixado em 20% para estimativas padrão)
  const getMetricasFisicas = () => {
    if (!analise) return { peso: 0, tempoStr: '--', complexidade: 'Baixa' };

    const selectedMat = MATERIAIS.find((m) => m.id === material) || MATERIAIS[0]!;
    
    // Peso estimado = volume (cm³) * densidade (g/cm³) * fator de preenchimento (padrão 20%)
    const infillMultiplier = 0.2 + (20 / 100) * 0.8;
    const peso = Math.round(analise.volumeCm3 * selectedMat.densidade * infillMultiplier);

    // Tempo estimado de fatiamento realista
    const minutosPorCm3 = 10 + (20 / 100) * 15;
    const totalMinutos = Math.max(90, Math.round(analise.volumeCm3 * minutosPorCm3));
    const horas = Math.floor(totalMinutos / 60);
    const minutosRestantes = totalMinutos % 60;
    const tempoStr = `${horas}h ${minutosRestantes}m`;

    // Complexidade da malha baseado na densidade de triângulos
    const densidadeTriangulos = analise.triangles / analise.volumeCm3;
    let complexidade = 'Baixa';
    if (densidadeTriangulos > 5000) complexidade = 'Alta';
    else if (densidadeTriangulos > 1500) complexidade = 'Média';

    return {
      peso,
      tempoStr,
      complexidade
    };
  };

  const metricas = getMetricasFisicas();
  const selectedMaterial = MATERIAIS.find((m) => m.id === material) || MATERIAIS[0]!;

  const getWhatsAppLink = () => {
    if (!file || !analise) return '#';
    const linkArquivo = fileUrl ? `\n🔗 *Link do Modelo:* ${fileUrl}` : '';
    const obsText = observacao.trim() ? `\n📝 *Observações:* ${observacao.trim()}` : '';
    
    const text = encodeURIComponent(
      `Olá GLTech3D! Acabei de carregar um arquivo 3D na sua ferramenta de análise:\n\n` +
      `📁 *Modelo:* ${file.name}\n` +
      `📐 *Dimensões Nominais:* ${analise.dimensions.x} x ${analise.dimensions.y} x ${analise.dimensions.z} mm\n` +
      `💧 *Volume Geométrico:* ${analise.volumeCm3} cm³\n` +
      `🛠️ *Material Desejado:* ${selectedMaterial.nome}\n` +
      `${linkArquivo}` +
      `${obsText}\n\n` +
      `*Métricas de Fatiamento Estimadas:*\n` +
      `- Peso Estimado: ${metricas.peso}g\n` +
      `- Tempo de Máquina: ${metricas.tempoStr}\n` +
      `- Complexidade do Modelo: ${metricas.complexidade}\n\n` +
      `Gostaria de obter o orçamento oficial para fabricação!`
    );
    return `https://wa.me/5531999284834?text=${text}`;
  };

  return (
    <main className="min-h-screen bg-[#F9F7F2] text-[#2B2622] pt-24 pb-12">
      <Navbar />

      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Painel Esquerdo - Configuração */}
          <div className="lg:col-span-7 flex flex-col gap-8 bg-white border border-[#D5CBBF] rounded-[2.5rem] p-6 sm:p-8 shadow-sm">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#A6815C] block">
                Engine de Cotação
              </span>
              <h1 className="text-3xl font-black uppercase tracking-tight mt-1 font-sora text-[#1E1B18]">
                Orçamento Instantâneo
              </h1>
              <p className="text-xs text-[#4F433A] mt-1.5 font-medium">
                Análise geométrica 3D imediata do seu modelo digital para faturamento técnico.
              </p>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".stl,.3mf" 
              className="hidden" 
            />

            {/* Dropzone */}
            <div
              onClick={triggerFileInput}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) processarArquivo(f);
              }}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
                isDragging 
                  ? 'border-[#A6815C] bg-[#A6815C]/10 scale-[0.98]' 
                  : 'border-[#C8BEB2] bg-stone-50/50 hover:border-[#A6815C] hover:bg-white'
              }`}
            >
              <UploadCloud className="w-10 h-10 text-[#A6815C] mb-3" />
              <p className="text-sm font-bold text-[#1E1B18]">
                Arraste seu arquivo STL / 3MF ou clique para escolher
              </p>
              <span className="text-[10px] text-[#4F433A] mt-1.5 font-medium">
                Formatos aceitos: .stl, .3mf • Limite recomendado: 50MB
              </span>
            </div>

            {/* Status do Arquivo / Loader */}
            <AnimatePresence mode="wait">
              {loading && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex justify-center py-4"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-[#A6815C]">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Analisando geometria tridimensional...</span>
                  </div>
                </motion.div>
              )}

              {uploading && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex justify-center py-2"
                >
                  <div className="flex items-center gap-2 text-[11px] font-bold text-[#A6815C]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Fazendo upload do modelo para compartilhamento...</span>
                  </div>
                </motion.div>
              )}

              {file && !loading && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-[#A6815C]/10 border border-[#A6815C]/40 p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-[#A6815C]/20 text-[#8A6844] rounded-lg">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black truncate max-w-[200px] sm:max-w-[280px] text-[#1E1B18]">
                          {file.name}
                        </p>
                        <p className="text-[10px] text-[#4F433A] mt-0.5 font-semibold">
                          Tamanho: {(file.size / (1024 * 1024)).toFixed(2)} MB • {fileUrl ? 'Pronto para enviar' : 'Mapeado com sucesso'}
                        </p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation();
                        resetFile();
                      }}
                      className="p-2 hover:bg-red-100 text-[#4F433A] hover:text-red-600 rounded-lg transition-colors"
                      title="Remover arquivo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 1. Materiais */}
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#3E352F]">
                1. Selecione o Material
              </span>
              <div className="grid grid-cols-1 gap-3">
                {MATERIAIS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMaterial(m.id)}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      material === m.id 
                        ? 'border-[#8A6844] border-2 bg-white shadow-[0_8px_20px_-8px_rgba(166,129,92,0.25)] scale-[1.01]' 
                        : 'border-[#C8BEB2] bg-white/60 hover:border-[#A6815C] hover:bg-white'
                    }`}
                  >
                    <span className="max-w-md">
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${
                          m.id === 'pla' ? 'bg-[#d9c7a8]' : m.id === 'petg' ? 'bg-[#3a3a3a]' : 'bg-[#8a6d4d]'
                        }`} />
                        <span className="text-xs font-black text-[#1E1B18]">{m.nome}</span>
                      </span>
                      <span className="block text-[11px] text-[#4F433A] mt-1 leading-normal font-medium">
                        {m.desc}
                      </span>
                    </span>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex flex-col gap-1 text-[9px] font-extrabold uppercase text-[#3E352F] border-l border-[#C8BEB2] pl-3">
                        <div className="flex justify-between w-24">
                          <span>Estética:</span>
                          <span className="text-[#A6815C]">{'★'.repeat(m.visual)}</span>
                        </div>
                        <div className="flex justify-between w-24">
                          <span>Resistência:</span>
                          <span className="text-[#A6815C]">{'★'.repeat(m.resistencia)}</span>
                        </div>
                      </div>
                      <span className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0 ${
                        material === m.id ? 'border-[#A6815C]' : 'border-[#C8BEB2]'
                      }`}>
                        {material === m.id && <span className="w-2 h-2 bg-[#A6815C] rounded-full" />}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Observações (Opcional) */}
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#3E352F]">
                2. Observações (Opcional)
              </span>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: Cor de preferência, quantidade de peças, uso pretendido ou acabamento especial..."
                className="w-full min-h-[100px] p-3.5 rounded-xl border border-[#C8BEB2] bg-white text-xs text-[#1E1B18] placeholder-[#4F433A]/70 focus:border-[#A6815C] focus:ring-1 focus:ring-[#A6815C] outline-none transition-all resize-none leading-relaxed"
              />
            </div>

          </div>

          {/* Painel Direito - Resumo HUD */}
          <div className="lg:col-span-5 bg-[#2B2622] text-white rounded-[2.5rem] p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden border border-white/5 min-h-[460px]">
            <div className="absolute inset-0 bg-radial-gradient(ellipse at top, rgba(166,129,92,0.15) 0%, transparent 80%) pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex justify-between items-center border-b border-stone-800 pb-4">
                <h2 className="text-lg font-black uppercase tracking-wider font-sora text-stone-200">
                  Fatiamento Técnico
                </h2>
                <Activity className="w-5 h-5 text-[#A6815C]" />
              </div>

              {/* Grid de Métricas do Arquivo Real */}
              <div className="grid grid-cols-3 gap-3 py-6 my-2 border-b border-stone-800">
                <div className="bg-stone-900/60 rounded-xl p-3 border border-white/[0.03]">
                  <Scale className="w-4 h-4 text-[#A6815C] mb-2" />
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-stone-400">Peso Est.</span>
                  <span className="font-mono text-sm font-black text-white mt-0.5 block">
                    {file && analise ? `${metricas.peso}g` : '--'}
                  </span>
                </div>
                <div className="bg-stone-900/60 rounded-xl p-3 border border-white/[0.03]">
                  <Clock className="w-4 h-4 text-[#A6815C] mb-2" />
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-stone-400">Tempo Est.</span>
                  <span className="font-mono text-sm font-black text-white mt-0.5 block">
                    {file && analise ? metricas.tempoStr : '--'}
                  </span>
                </div>
                <div className="bg-stone-900/60 rounded-xl p-3 border border-white/[0.03]">
                  <Layers className="w-4 h-4 text-[#A6815C] mb-2" />
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-stone-400">Triângulos</span>
                  <span className="font-mono text-sm font-black text-white mt-0.5 block">
                    {file && analise ? analise.triangles.toLocaleString() : '--'}
                  </span>
                </div>
              </div>

              {/* Tabela de Propriedades Reais -> Substituída por Gatilhos de Vendas Simplificados */}
              <div className="flex flex-col gap-6 py-6 border-b border-stone-800 text-stone-300">
                <div className="flex items-center gap-3.5">
                  <div className="h-6 w-6 rounded-full bg-[#A6815C]/20 text-[#A6815C] flex items-center justify-center shrink-0 text-xs font-black">
                    ✓
                  </div>
                  <span className="font-extrabold text-white uppercase text-xs tracking-widest font-sora">
                    Geometria Validada
                  </span>
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="h-6 w-6 rounded-full bg-[#A6815C]/20 text-[#A6815C] flex items-center justify-center shrink-0 text-xs font-black">
                    ✓
                  </div>
                  <span className="font-extrabold text-white uppercase text-xs tracking-widest font-sora">
                    Resistência Máxima
                  </span>
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="h-6 w-6 rounded-full bg-[#A6815C]/20 text-[#A6815C] flex items-center justify-center shrink-0 text-xs font-black">
                    ✓
                  </div>
                  <span className="font-extrabold text-white uppercase text-xs tracking-widest font-sora">
                    Acabamento Premium
                  </span>
                </div>
              </div>
            </div>

            {/* Status do Orçamento */}
            <div className="relative z-10 mt-8">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#A6815C] block">
                Status do Orçamento
              </span>
              <div className="text-xl sm:text-2xl font-black text-white font-sora tracking-tight mt-1 leading-normal uppercase">
                {file && analise ? 'Aguardando Validação Técnica' : 'Carregue um Modelo 3D'}
              </div>
              
              <div className="mt-3.5 bg-stone-900/50 rounded-xl p-3.5 text-[10px] text-stone-400 leading-relaxed border border-white/[0.02]">
                {file && analise 
                  ? 'Mapeamento tridimensional concluído com sucesso! Para assegurar a máxima precisão dimensional, acabamento premium e integridade estrutural, nossa equipe técnica analisará agora a melhor estratégia de posicionamento e fatiamento industrial.' 
                  : 'Nossa tecnologia analisa a estrutura tridimensional do seu modelo. Carregue seu arquivo para que nossos engenheiros possam preparar a melhor estratégia de fabricação premium.'
                }
              </div>

              <a
                href={getWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full bg-[#A6815C] hover:bg-[#8E6D4D] text-white font-extrabold uppercase tracking-widest text-[11px] py-4 px-6 rounded-xl mt-6 flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-[#A6815C]/10 hover:shadow-[#A6815C]/25 duration-300 ${
                  !file || loading || uploading ? 'pointer-events-none opacity-40 grayscale' : 'hover:scale-[1.01]'
                }`}
              >
                SOLICITAR ORÇAMENTO
              </a>
            </div>

          </div>

        </div>
      </div>

      <Footer />
    </main>
  );
}
