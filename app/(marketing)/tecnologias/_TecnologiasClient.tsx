'use client';

import { motion } from 'motion/react';
import { ShieldAlert, Zap, Layers, Cpu, Check, HelpCircle } from 'lucide-react';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';

const DADOS_MATERIAIS = [
  { 
    material: 'PLA Premium', 
    resistencia: 'Média', 
    resistenciaNivel: 'normal',
    temperatura: 'Até 55°C', 
    acabamento: 'Excelente / Alto brilho', 
    aplicacao: 'Peças decorativas, maquetes e protótipos visuais de alta definição' 
  },
  { 
    material: 'PETG Industrial', 
    resistencia: 'Alta', 
    resistenciaNivel: 'alta',
    temperatura: 'Até 75°C', 
    acabamento: 'Brilhante / Técnico', 
    aplicacao: 'Peças mecânicas funcionais, suportes e protótipos expostos a esforço leve' 
  },
  { 
    material: 'ABS Engenharia', 
    resistencia: 'Muito Alta', 
    resistenciaNivel: 'muito-alta',
    temperatura: 'Até 95°C', 
    acabamento: 'Fosco / Tratável', 
    aplicacao: 'Componentes automotivos, cases eletrônicos e peças industriais de alto uso' 
  },
  { 
    material: 'Flexível (TPU)', 
    resistencia: 'Impacto Máximo', 
    resistenciaNivel: 'maxima',
    temperatura: 'Até 60°C', 
    acabamento: 'Emborrachado', 
    aplicacao: 'Gaxetas, juntas, vedações, amortecedores de impacto e solados técnicos' 
  },
];

export function TecnologiasClient() {
  return (
    <main className="min-h-screen bg-[#F9F7F2] text-[#2B2622] pt-24 pb-12">
      <Navbar />

      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        
        {/* Cabeçalho */}
        <div className="mb-12">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#A6815C] block">
            Ficha de Engenharia
          </span>
          <h1 className="text-4xl font-black uppercase tracking-tight mt-1 font-sora text-[#2B2622]">
            Materiais &amp; Hardware
          </h1>
          <p className="text-xs text-[#6B5E55] font-light mt-2 max-w-md leading-relaxed">
            Consulte a tabela comparativa de tolerâncias e propriedades térmicas antes de fatiar seu lote de produção. Garantimos a calibração perfeita do filamento ao bico extrusor.
          </p>
        </div>

        {/* Tabela de Propriedades */}
        <div className="w-full overflow-hidden bg-white rounded-3xl border border-[#E8E2D9] shadow-sm mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[#2B2622] text-white text-[10px] uppercase tracking-wider font-extrabold">
                  <th className="p-5 font-sora">Material</th>
                  <th className="p-5 font-sora">Resistência Mecânica</th>
                  <th className="p-5 font-sora">Resistência Térmica</th>
                  <th className="p-5 font-sora">Qualidade Visual</th>
                  <th className="p-5 font-sora">Uso Recomendado</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-[#E8E2D9]">
                {DADOS_MATERIAIS.map((item, index) => (
                  <motion.tr
                    key={item.material}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08 }}
                    className="hover:bg-[#F9F7F2]/40 transition-colors"
                  >
                    {/* Material */}
                    <td className="p-5 font-bold text-[#2B2622]">
                      <div className="flex items-center gap-2.5">
                        <span className={`h-2 w-2 rounded-full ${
                          item.material.includes('PLA') ? 'bg-[#d9c7a8]' : item.material.includes('PETG') ? 'bg-[#3a3a3a]' : item.material.includes('ABS') ? 'bg-[#8a6d4d]' : 'bg-[#e2c1a4]'
                        }`} />
                        {item.material}
                      </div>
                    </td>

                    {/* Resistência Mecânica */}
                    <td className="p-5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wide border ${
                        item.resistenciaNivel === 'normal' 
                          ? 'bg-stone-100 text-stone-700 border-stone-200' 
                          : item.resistenciaNivel === 'alta' 
                          ? 'bg-amber-50 text-amber-800 border-amber-200' 
                          : item.resistenciaNivel === 'muito-alta'
                          ? 'bg-orange-55 text-orange-850 border-orange-200'
                          : 'bg-[#A6815C]/10 text-[#A6815C] border-[#A6815C]/20'
                      }`}>
                        {item.resistencia}
                      </span>
                    </td>

                    {/* Resistência Térmica */}
                    <td className="p-5 font-mono font-bold text-[#A6815C]">
                      {item.temperatura}
                    </td>

                    {/* Qualidade Visual */}
                    <td className="p-5 text-[#6B5E55] font-medium">
                      {item.acabamento}
                    </td>

                    {/* Uso Recomendado */}
                    <td className="p-5 font-light text-[#6B5E55] max-w-[280px] leading-relaxed">
                      {item.aplicacao}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Informações Extras de Hardware */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          {/* Card 1 */}
          <div className="bg-white/60 border border-[#E8E2D9] p-6 rounded-2xl flex flex-col justify-between hover:border-[#A6815C]/35 hover:bg-white transition-all duration-300">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-[#A6815C]/10 text-[#A6815C] rounded-xl shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#2B2622]">Tolerância dimensional</h3>
                <p className="text-[11px] text-[#6B5E55] font-light mt-2 leading-relaxed">
                  Calibração milimétrica contínua por sensores ópticos. Desvio dimensional máximo controlado de ±0.1mm.
                </p>
              </div>
            </div>
            <div className="mt-5 border-t border-[#E8E2D9] pt-4 flex items-center justify-between text-[10px] font-mono font-bold text-[#6B5E55]">
              <span>Desvio Nominal</span>
              <span className="text-[#A6815C]">± 0.08 mm</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white/60 border border-[#E8E2D9] p-6 rounded-2xl flex flex-col justify-between hover:border-[#A6815C]/35 hover:bg-white transition-all duration-300">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-[#A6815C]/10 text-[#A6815C] rounded-xl shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#2B2622]">Fatiamento Otimizado</h3>
                <p className="text-[11px] text-[#6B5E55] font-light mt-2 leading-relaxed">
                  Cálculo automático de inclinação na mesa de impressão para reforçar as linhas de união e a tração.
                </p>
              </div>
            </div>
            <div className="mt-5 border-t border-[#E8E2D9] pt-4 flex items-center justify-between text-[10px] font-mono font-bold text-[#6B5E55]">
              <span>Padrão de Infill</span>
              <span className="text-[#A6815C]">Giroide 3D</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white/60 border border-[#E8E2D9] p-6 rounded-2xl flex flex-col justify-between hover:border-[#A6815C]/35 hover:bg-white transition-all duration-300">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-[#A6815C]/10 text-[#A6815C] rounded-xl shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#2B2622]">Hardware Avançado</h3>
                <p className="text-[11px] text-[#6B5E55] font-light mt-2 leading-relaxed">
                  Extrusoras direct-drive calibradas com bicos endurecidos de altíssima condutividade térmica.
                </p>
              </div>
            </div>
            <div className="mt-5 border-t border-[#E8E2D9] pt-4 flex items-center justify-between text-[10px] font-mono font-bold text-[#6B5E55]">
              <span>Diâmetro do Bico</span>
              <span className="text-[#A6815C]">0.4mm / 0.6mm</span>
            </div>
          </div>

        </div>

      </div>

      <Footer />
    </main>
  );
}
