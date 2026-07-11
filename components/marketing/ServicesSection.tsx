'use client';

import { motion } from 'motion/react';

const SERVICOS_GL = [
  { id: "01", title: "Modelagem 3D & Fatiamento", desc: "Otimização estrutural de malhas, conversão e correção de arquivos STL/3MF. Engenharia de fatiamento para garantir máxima resistência com preenchimento ideal." },
  { id: "02", title: "Impressão 3D Sob Demanda", desc: "Manufatura aditiva de alta fidelidade com filamentos premium (PLA, PETG, ABS). Peças produzidas com precisão milimétrica, camada por camada." },
  { id: "03", title: "Prototipagem Rápida", desc: "Desenvolvimento técnico ágil para projetos mecânicos, gabaritos industriais e maquetes funcionais com entrega expressa para testes de validação." },
  { id: "04", title: "Peças Decorativas & Action Figures", desc: "Impressão de colecionáveis ricos em detalhes, luminárias exclusivas personalizadas e acabamentos de superfície premium para decoração de alto padrão." }
];

export default function ServicesSection() {
  return (
    <section id="servicos" className="bg-white text-[#2D2A26] rounded-t-[40px] md:rounded-t-[50px] px-6 md:px-16 py-24 relative z-20 w-full border-t border-gray-200">
      <div className="max-w-5xl mx-auto">
        
        {/* Cabeçalho Técnico */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-200 pb-10 mb-10 gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#A88060] block mb-1">O Que Fazemos</span>
            <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight leading-none">
              Capacidades <br/>
              <span className="font-heading italic font-normal text-gray-400 lowercase text-xl sm:text-3xl">& serviços</span>
            </h2>
          </div>
          <p className="max-w-sm text-xs sm:text-sm tracking-wide font-normal text-gray-500 leading-relaxed">
            Soluções completas em impressão 3D, engenharia reversa e desenvolvimento de produtos físicos direto do arquivo digital.
          </p>
        </div>

        {/* Listagem Estruturada */}
        <div className="flex flex-col w-full">
          {SERVICOS_GL.map((srv) => (
            <motion.div 
              key={srv.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="group flex flex-col md:flex-row items-start justify-between py-8 border-b border-gray-100 hover:border-[#A88060] transition-colors duration-300 gap-4"
            >
              <div className="flex items-center gap-6">
                <span className="text-base font-bold text-gray-300 group-hover:text-[#A88060] transition-colors">{srv.id}</span>
                <h3 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-gray-800">{srv.title}</h3>
              </div>
              <p className="max-w-md text-xs sm:text-sm font-light text-gray-500 leading-relaxed group-hover:text-gray-800 transition-colors duration-300">
                {srv.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
