'use client';

import { useRef, useState } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  type MotionValue,
} from 'motion/react';

/**
 * "Mesa de Impressão Dinâmica" — mostruário assimétrico de materiais premium.
 * Cada bloco flutua em velocidade de parallax própria (scroll) e reage ao
 * cursor com tilt 3D magnético; ao focar um card, os vizinhos recuam. Reusa
 * motion + o Lenis já ativo. Sem dependência nova.
 */

interface Material {
  nome: string;
  tag: string;
  desc: string;
  temp: string;
  swatch: string;
}

const MATERIAIS: Material[] = [
  { nome: 'PLA Silk', tag: 'Estética', desc: 'Acabamento metálico acetinado de alto brilho, ideal para colecionáveis e peças de vitrine.', temp: 'Até 55°C', swatch: 'linear-gradient(135deg,#d9c7a8,#a6815c,#6b5e55)' },
  { nome: 'PETG Carbono', tag: 'Estrutural', desc: 'Rigidez reforçada com fibra e alta resistência química para peças funcionais e suportes.', temp: 'Até 75°C', swatch: 'linear-gradient(135deg,#3a3a3a,#1f1f1f,#0d0d0d)' },
  { nome: 'TPU Flex', tag: 'Elastômero', desc: 'Flexibilidade emborrachada com absorção de impacto para gaxetas, vedações e solados.', temp: 'Até 60°C', swatch: 'linear-gradient(135deg,#b8a58a,#8a6d4d,#5a4a3a)' },
];

export function MaterialsParallax() {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });

  const ySlow = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const yMed = useTransform(scrollYProgress, [0, 1], [110, -110]);
  const yFast = useTransform(scrollYProgress, [0, 1], [20, -80]);
  const speeds = [ySlow, yMed, yFast];
  const offsets = ['lg:mt-0', 'lg:mt-20', 'lg:mt-8'];

  return (
    <section ref={ref} className="relative overflow-hidden bg-[#F9F7F2] py-28 px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div
          className="mb-16 max-w-xl"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#8E6D4D]">Biblioteca de Materiais</span>
          <h2 className="mt-3 font-sora text-3xl font-black uppercase tracking-tight text-[#2B2622] md:text-5xl">Mesa de Impressão</h2>
          <p className="mt-4 text-sm leading-relaxed text-[#6B5E55]">
            Polímeros técnicos selecionados por propriedade mecânica e térmica. Escolhemos a matriz
            certa para cada peça — do brilho decorativo à resistência industrial.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3" onMouseLeave={() => setHovered(null)}>
          {MATERIAIS.map((m, i) => (
            <MaterialCard
              key={m.nome}
              material={m}
              index={i}
              y={speeds[i]!}
              offset={offsets[i]!}
              hovered={hovered}
              onHover={setHovered}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function MaterialCard({
  material, index, y, offset, hovered, onHover,
}: {
  material: Material;
  index: number;
  y: MotionValue<number>;
  offset: string;
  hovered: number | null;
  onHover: (i: number | null) => void;
}) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 18 });
  const sry = useSpring(ry, { stiffness: 200, damping: 18 });

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - rect.left) / rect.width - 0.5) * 12);
    rx.set(-((e.clientY - rect.top) / rect.height - 0.5) * 12);
  }
  function reset() {
    rx.set(0);
    ry.set(0);
  }

  const dimmed = hovered !== null && hovered !== index;

  return (
    <motion.div
      style={{ y }}
      className={offset}
      animate={{ opacity: dimmed ? 0.55 : 1, scale: dimmed ? 0.97 : 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
    >
      <div className="[perspective:900px]">
        <motion.div
          onPointerMove={onPointerMove}
          onPointerEnter={() => onHover(index)}
          onPointerLeave={reset}
          style={{ rotateX: srx, rotateY: sry, transformStyle: 'preserve-3d' }}
          whileHover={{ y: -6 }}
          className="group rounded-[2rem] border border-[#E8E2D9] bg-white p-6 shadow-[0_12px_40px_-16px_rgba(43,38,34,0.15)] transition-shadow duration-300 hover:shadow-[0_28px_60px_-18px_rgba(43,38,34,0.32)]"
        >
          <div className="flex items-start justify-between" style={{ transform: 'translateZ(30px)' }}>
            {/* Chip de cor com shimmer no hover */}
            <span className="relative h-12 w-12 overflow-hidden rounded-2xl shadow-inner ring-1 ring-black/5" style={{ background: material.swatch }} aria-hidden>
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </span>
            <span className="rounded-full bg-[#A6815C]/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-[#8E6D4D]">
              {material.tag}
            </span>
          </div>

          <h3 className="mt-5 font-sora text-xl font-black tracking-tight text-[#2B2622]" style={{ transform: 'translateZ(20px)' }}>
            {material.nome}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-[#6B5E55]">{material.desc}</p>

          <div className="mt-5 flex items-center justify-between border-t border-[#E8E2D9] pt-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B5E55]">Resistência térmica</span>
            <span className="font-mono text-sm font-bold text-[#A6815C]">{material.temp}</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
