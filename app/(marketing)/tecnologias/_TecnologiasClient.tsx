'use client';

import { motion } from 'motion/react';
import { ShieldAlert, Zap } from 'lucide-react';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';

const DADOS_MATERIAIS = [
  { material: 'PLA Premium', resistencia: 'Média', temperatura: 'Até 55°C', acabamento: 'Excelente / Alto brilho', aplicacao: 'Peças decorativas e protótipos visuais' },
  { material: 'PETG Industrial', resistencia: 'Alta', temperatura: 'Até 75°C', acabamento: 'Brilhante / Técnico', aplicacao: 'Peças mecânicas funcionais e suportes' },
  { material: 'ABS Engenharia', resistencia: 'Muito alta', temperatura: 'Até 95°C', acabamento: 'Fosco / Tratável', aplicacao: 'Componentes automotivos e cases industriais' },
  { material: 'Flexível (TPU)', resistencia: 'Impacto máximo', temperatura: 'Até 60°C', acabamento: 'Emborrachado', aplicacao: 'Gaxetas, vedações e solados técnicos' },
];

export function TecnologiasClient() {
  return (
    <main className="min-h-screen bg-[#F9F7F2] text-[#2B2622] pt-24">
      <Navbar />

      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        {/* Cabeçalho */}
        <div className="mb-12">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#A6815C] block">Ficha de Engenharia</span>
          <h1 className="text-4xl font-black uppercase tracking-tight mt-1 font-sora text-[#2B2622]">Materiais &amp; Hardware</h1>
          <p className="text-sm text-[#6B5E55] font-light mt-2 max-w-md">
            Consulte a tabela comparativa de tolerâncias e propriedades térmicas antes de fatiar seu lote de produção.
          </p>
        </div>

        {/* Tabela */}
        <div className="w-full overflow-x-auto bg-white rounded-3xl border border-[#E8E2D9] shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#2B2622] text-white text-xs uppercase tracking-wider font-bold">
                <th className="p-5">Material</th>
                <th className="p-5">Resistência mecânica</th>
                <th className="p-5">Resistência térmica</th>
                <th className="p-5">Qualidade visual</th>
                <th className="p-5">Uso recomendado</th>
              </tr>
            </thead>
            <tbody className="text-xs sm:text-sm divide-y divide-[#E8E2D9]">
              {DADOS_MATERIAIS.map((item, index) => (
                <motion.tr
                  key={item.material}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-[#F9F7F2] transition-colors"
                >
                  <td className="p-5 font-bold text-[#2B2622]">{item.material}</td>
                  <td className="p-5 text-[#6B5E55]">{item.resistencia}</td>
                  <td className="p-5 font-mono text-[#A6815C]">{item.temperatura}</td>
                  <td className="p-5 text-[#6B5E55]">{item.acabamento}</td>
                  <td className="p-5 font-light text-[#6B5E55]">{item.aplicacao}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cards técnicos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="bg-white/60 border border-[#E8E2D9] p-6 rounded-2xl flex items-start gap-4">
            <ShieldAlert className="w-6 h-6 text-[#A6815C] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold uppercase tracking-tight">Tolerância dimensional mapeada</h3>
              <p className="text-xs text-[#6B5E55] font-light mt-1 leading-relaxed">
                Nossas máquinas operam sob calibração rígida de passo de extrusora, com desvio dimensional máximo controlado de ±0.1mm.
              </p>
            </div>
          </div>
          <div className="bg-white/60 border border-[#E8E2D9] p-6 rounded-2xl flex items-start gap-4">
            <Zap className="w-6 h-6 text-[#A6815C] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold uppercase tracking-tight">Fatiamento otimizado</h3>
              <p className="text-xs text-[#6B5E55] font-light mt-1 leading-relaxed">
                Analisamos as forças de cisalhamento para orientar a peça na mesa, mitigando falhas nas linhas de união entre camadas.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
