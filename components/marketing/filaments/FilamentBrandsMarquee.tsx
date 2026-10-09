'use client';

import { motion } from 'motion/react';
import { Layers, Disc3 } from 'lucide-react';

const BRAND_NAMES = [
  'MASTERPRINT',
  'ESUN',
  'VOOLT3D',
  '3D BROTHERS',
  'YUGMCOCE',
  'GENERIC',
  'MULTIFILA',
  '3D FILA',
  '3D LAB',
];

export function FilamentBrandsMarquee() {
  // Duplicamos a lista para criar um loop perfeito e contínuo
  const marqueeItems = [...BRAND_NAMES, ...BRAND_NAMES, ...BRAND_NAMES, ...BRAND_NAMES];

  return (
    <div className="w-full my-8">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-[#A6815C] animate-pulse" />
          <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#8E6D4D] font-sora">
            Marcas em Produção & Testadas no Laboratório
          </span>
        </div>
        <span className="text-[10px] font-bold text-[#A6815C]/80 uppercase tracking-wider font-mono hidden sm:inline">
          100% Calibradas
        </span>
      </div>

      {/* Faixa Marquee com máscara de degradê nas bordas */}
      <div className="relative overflow-hidden rounded-2xl border border-[#E8E2D9] bg-white/70 py-3.5 backdrop-blur-sm shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)]">
        {/* Máscara de gradiente nas extremidades para desvanecer suavemente */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#FAF9F6] via-[#FAF9F6]/80 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#FAF9F6] via-[#FAF9F6]/80 to-transparent z-10" />

        <motion.div
          className="flex w-max gap-4 items-center"
          animate={{ x: ['0%', '-50%'] }}
          transition={{
            ease: 'linear',
            duration: 28,
            repeat: Infinity,
          }}
          whileHover={{ animationPlayState: 'paused' }}
        >
          {marqueeItems.map((brand, i) => (
            <motion.div
              key={`${brand}-${i}`}
              whileHover={{ scale: 1.06, y: -2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="group/brand inline-flex items-center gap-2.5 rounded-full border border-[#E8E2D9] bg-white px-4 py-2 text-xs font-black tracking-wider text-[#2B2622] font-sora whitespace-nowrap cursor-default shadow-sm transition-all duration-200 hover:border-[#A6815C] hover:bg-gradient-to-r hover:from-white hover:to-[#FAF6F0] hover:shadow-md hover:shadow-[#A6815C]/15"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FAF4ED] text-[#A6815C] transition-colors group-hover/brand:bg-[#A6815C] group-hover/brand:text-white">
                {i % 2 === 0 ? <Disc3 className="h-3 w-3 animate-[spin_10s_linear_infinite]" /> : <Layers className="h-3 w-3" />}
              </span>
              <span className="transition-colors group-hover/brand:text-[#7A5C3E]">
                {brand}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
