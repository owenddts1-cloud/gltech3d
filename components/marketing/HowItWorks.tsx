'use client';

import { motion } from 'motion/react';
import { UploadCloud, Printer, Truck } from 'lucide-react';
import { TiltCard } from '@/components/marketing/TiltCard';

const steps = [
  {
    icon: UploadCloud,
    title: 'Envie ou escolha o arquivo 3D',
    desc: 'Traga seu STL/3MF ou escolha um dos nossos modelos. A gente ajuda a definir material, cor e acabamento.',
  },
  {
    icon: Printer,
    title: 'Imprimimos sob demanda',
    desc: 'Impressão de alta precisão com PLA/PETG e acabamento premium, peça por peça, do seu jeito.',
  },
  {
    icon: Truck,
    title: 'Entregamos no Brasil todo',
    desc: 'Embalagem caprichada e envio para todo o país. Você acompanha cada etapa da produção.',
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20 px-6 bg-[#F0EEE9]/60">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <span className="text-[11px] font-bold tracking-widest uppercase text-[#8E6D4D]">
            Como funciona
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold font-sora mt-2 text-[#2D241E]">
            Da ideia à peça na sua mão
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <TiltCard key={step.title} className="h-full" max={6}>
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="relative h-full rounded-2xl bg-white border border-[#E8E2D9] p-7 hover:shadow-xl hover:shadow-[#A6815C]/10 transition-all"
              >
                <span className="absolute top-6 right-6 text-5xl font-extrabold font-sora text-[#E8E2D9] select-none">
                  {i + 1}
                </span>
                <div className="w-12 h-12 rounded-xl bg-[#A6815C] text-white flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold font-sora text-[#2D241E] mb-2">{step.title}</h3>
                <p className="text-sm text-[#6B5E55] leading-relaxed">{step.desc}</p>
              </motion.div>
              </TiltCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}
