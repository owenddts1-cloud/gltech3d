'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Box } from 'lucide-react';

const categories = ["Animes", "Decoração", "Action Figures", "Sua Casa"];
const assembledCarImg = "https://storage.googleapis.com/aida-uploads/default/20260307-021308-1.png";
const explodedCarImg = "https://storage.googleapis.com/aida-uploads/default/20260307-021307.png";

export default function Hero() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExploded, setIsExploded] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % categories.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const scrollToProducts = () => {
    document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen pt-24 pb-12 flex flex-col items-center justify-center overflow-hidden grid-bg">
      <div className="absolute inset-0 hero-gradient pointer-events-none z-0"></div>

      {/* 3D Car Explosion Background */}
      <div
        className="absolute right-[-40%] md:right-[-5%] top-1/2 -translate-y-1/2 w-[1000px] h-[700px] pointer-events-none z-0 mix-blend-multiply opacity-95"
        style={{ perspective: "2000px" }}
      >
        <motion.div
          animate={{
            rotateY: isExploded ? -180 : 0,
            scale: isExploded ? 1.1 : 0.9,
            x: isExploded ? -50 : 0,
          }}
          transition={{ duration: 2.5, type: "spring", bounce: 0.15 }}
          className="w-full h-full relative"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Assembled Car */}
          <div
            className="absolute inset-0 bg-contain bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${assembledCarImg})`,
              backfaceVisibility: "hidden",
            }}
          />

          {/* Exploded Car */}
          <div
            className="absolute inset-0 bg-contain bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${explodedCarImg})`,
              transform: "rotateY(180deg)",
              backfaceVisibility: "hidden",
            }}
          />
        </motion.div>
      </div>

      <div className="relative z-10 px-6 text-center max-w-2xl mt-12 md:mt-0 mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8E2D9] border border-[#D1C7B7] text-[10px] font-bold tracking-widest uppercase text-[#8E6D4D] mb-6"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          Impressão 3D • Feito no Brasil
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-4xl md:text-6xl font-extrabold leading-tight mb-6 font-sora"
        >
          Do arquivo 3D para <br/>
          <span className="text-[#A6815C] inline-block min-w-[200px]">
            <AnimatePresence mode="wait">
              <motion.span
                key={currentIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="inline-block"
              >
                {categories[currentIndex]}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-[#6B5E55] text-sm md:text-base mb-8 max-w-lg mx-auto leading-relaxed"
        >
          Produtos únicos feitos com impressão 3D de alta precisão. Cada peça produzida sob demanda com acabamento impecável.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={scrollToProducts}
            className="w-full sm:w-auto px-8 py-4 bg-[#A6815C] hover:bg-[#8E6D4D] hover:-translate-y-0.5 transition-all text-white rounded-2xl font-bold shadow-lg shadow-[#A6815C]/20"
          >
            Ver Produtos
          </button>
          <button
            onClick={() => setIsExploded(!isExploded)}
            className={`w-full sm:w-auto px-8 py-4 bg-transparent border-2 transition-all rounded-2xl font-bold flex items-center justify-center gap-2 ${
              isExploded
                ? 'border-[#A6815C] text-[#A6815C] bg-[#A6815C]/10'
                : 'border-[#D1C7B7] text-[#6B5E55] hover:bg-white/50'
            }`}
          >
            <Box className={`w-5 h-5 transition-transform duration-500 ${isExploded ? 'rotate-180' : ''}`} />
            {isExploded ? 'Montar 3D' : 'Explodir 3D ✦'}
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-12 grid grid-cols-3 gap-4 pt-8 border-t border-[#D1C7B7]/30 max-w-md mx-auto"
        >
          <div>
            <div className="text-xl font-bold font-sora">11+</div>
            <div className="text-[10px] uppercase tracking-wide text-[#8E6D4D]">Categorias</div>
          </div>
          <div>
            <div className="text-xl font-bold font-sora">100%</div>
            <div className="text-[10px] uppercase tracking-wide text-[#8E6D4D]">Sob Demanda</div>
          </div>
          <div>
            <div className="text-xl font-bold font-sora">Premium</div>
            <div className="text-[10px] uppercase tracking-wide text-[#8E6D4D]">Acabamento</div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex justify-center"
      >
        <button
          onClick={scrollToProducts}
          className="animate-bounce flex flex-col items-center gap-2 cursor-pointer hover:opacity-100 transition-opacity"
        >
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#8E6D4D]">Scroll</span>
          <ChevronDown className="h-4 w-4 text-[#A6815C]" />
        </button>
      </motion.div>
    </section>
  );
}
