'use client';

import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';

const text = "With more than five years of experience in design, i focus on branding, web design, and user experience, i truly enjoy working with businesses that aim to stand out and present their best image. Let's build something incredible together!";

export default function AboutSection() {
  const letters = text.split("");

  const scrollToContact = () => {
    document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="about" className="relative min-h-screen bg-[#0C0C0C] px-6 md:px-12 py-32 flex flex-col items-center justify-center text-center overflow-hidden w-full">
      
      {/* Elementos 3D Decorativos Absolutos */}
      <motion.img 
        initial={{ opacity: 0, x: -80 }} 
        whileInView={{ opacity: 1, x: 0 }} 
        transition={{ delay: 0.1, duration: 0.9 }} 
        viewport={{ once: true }}
        src="https://shrug-person-78902957.figma.site/_components/v2/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/moon_icon.11395d36.png"
        className="absolute w-[100px] sm:w-[150px] md:w-[210px] top-[6%] left-[2%] md:left-[4%] pointer-events-none drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]" 
        alt="3D Moon asset"
      />
      <motion.img 
        initial={{ opacity: 0, x: -80 }} 
        whileInView={{ opacity: 1, x: 0 }} 
        transition={{ delay: 0.25, duration: 0.9 }} 
        viewport={{ once: true }}
        src="https://shrug-person-78902957.figma.site/_components/v2/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/p59_1.4659672e.png"
        className="absolute w-[80px] sm:w-[130px] md:w-[180px] bottom-[10%] left-[4%] md:left-[8%] pointer-events-none" 
        alt="3D Fluid geometry"
      />
      <motion.img 
        initial={{ opacity: 0, x: 80 }} 
        whileInView={{ opacity: 1, x: 0 }} 
        transition={{ delay: 0.15, duration: 0.9 }} 
        viewport={{ once: true }}
        src="https://shrug-person-78902957.figma.site/_components/v2/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/lego_icon-1.703bb594.png"
        className="absolute w-[100px] sm:w-[150px] md:w-[210px] top-[6%] right-[2%] md:right-[4%] pointer-events-none" 
        alt="3D Lego construction"
      />
      <motion.img 
        initial={{ opacity: 0, x: 80 }} 
        whileInView={{ opacity: 1, x: 0 }} 
        transition={{ delay: 0.3, duration: 0.9 }} 
        viewport={{ once: true }}
        src="https://shrug-person-78902957.figma.site/_components/v2/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/Group_134-1.2e04f3ce.png"
        className="absolute w-[110px] sm:w-[150px] md:w-[220px] bottom-[10%] right-[4%] md:right-[8%] pointer-events-none" 
        alt="3D Group structures"
      />

      <div className="max-w-4xl flex flex-col items-center gap-10 md:gap-14 z-10">
        <motion.h2 
          initial={{ opacity: 0, y: 40 }} 
          whileInView={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.6 }} 
          viewport={{ once: true }}
          className="hero-heading text-5xl sm:text-7xl md:text-9xl font-black uppercase tracking-tight"
        >
          About me
        </motion.h2>

        {/* Tipografia de Opacidade Caractere por Caractere */}
        <p className="text-[#D7E2EA] font-medium leading-relaxed max-w-[640px] text-lg sm:text-xl md:text-2xl tracking-wide">
          {letters.map((char, index) => (
            <motion.span
              key={index}
              initial={{ opacity: 0.2 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: index * 0.006 }}
              viewport={{ once: true, margin: "-10% 0px" }}
            >
              {char}
            </motion.span>
          ))}
        </p>

        <motion.button 
          initial={{ opacity: 0, y: 20 }} 
          whileInView={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.2, duration: 0.6 }} 
          viewport={{ once: true }}
          onClick={scrollToContact}
          className="liquid-glass text-white font-medium uppercase tracking-widest text-xs md:text-sm px-8 py-4 rounded-full flex items-center gap-2 hover:bg-white/10 transition-colors mt-6"
        >
          Let&apos;s talk <ArrowUpRight className="w-4 h-4" />
        </motion.button>
      </div>
    </section>
  );
}
