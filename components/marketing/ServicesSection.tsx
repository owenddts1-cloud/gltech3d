'use client';

import { motion } from 'motion/react';

const SERVICES = [
  { id: "01", title: "3D Modeling", desc: "Arquitetura de malhas limpas, geometrias industriais e assets otimizados para tempo de execução digital e renderizações físicas dedicadas." },
  { id: "02", title: "Premium Rendering", desc: "Cálculo físico de iluminação global, texturização procedural avançada e pós-produção foto-realista de altíssima fidelidade." },
  { id: "03", title: "Motion Design", desc: "Animação estrutural de peças, vistas explodidas dinâmicas guiadas por física e simulação de fluidos/partículas cinemáticas." },
  { id: "04", title: "Digital Branding", desc: "Tradução de identidades corporativas em ativos tridimensionais interativos, gerando posicionamento vanguardista no mercado." }
];

export default function ServicesSection() {
  return (
    <section id="services" className="bg-[#FFFFFF] text-[#0C0C0C] rounded-t-[40px] md:rounded-t-[60px] px-6 md:px-16 py-24 sm:py-32 relative z-20 w-full">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-[#0C0C0C]/10 pb-12 mb-12 gap-6">
          <h2 className="text-4xl sm:text-6xl font-black uppercase tracking-tight leading-none">
            Capabilities <br/>
            <span className="font-heading italic font-normal text-muted-foreground lowercase text-2xl sm:text-4xl text-gray-500">& services</span>
          </h2>
          <p className="max-w-xs text-xs sm:text-sm uppercase tracking-wider font-medium text-gray-600 leading-relaxed">
            soluções completas em computação gráfica e interfaces interativas tridimensionais de alta fidelidade.
          </p>
        </div>

        {/* Lista Minimalista de Serviços Dinâmicos */}
        <div className="flex flex-col w-full">
          {SERVICES.map((srv) => (
            <motion.div 
              key={srv.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-5%" }}
              transition={{ duration: 0.5 }}
              className="group flex flex-col md:flex-row items-start justify-between py-10 border-b border-[#0C0C0C]/10 hover:border-[#0C0C0C] transition-colors duration-300 gap-4"
            >
              <div className="flex items-center gap-6 md:gap-12">
                <span className="text-lg md:text-xl font-bold text-gray-400 group-hover:text-[#0C0C0C] transition-colors">{srv.id}</span>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold uppercase tracking-tight">{srv.title}</h3>
              </div>
              <p className="max-w-md text-sm md:text-base font-light text-gray-600 leading-relaxed group-hover:text-[#0C0C0C] transition-colors duration-300">
                {srv.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
