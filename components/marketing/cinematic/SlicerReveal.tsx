'use client';

import { useRef } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  type MotionValue,
} from 'motion/react';

/**
 * "O Fatiador Digital" — seção com scroll pinning. Um laser bronze desce por uma
 * peça abstrata revelando a transição de wireframe para sólido com infill
 * giroide. Interações: tilt 3D reativo ao cursor, malha girando, varredura do
 * laser, contagem de camadas e partículas. Tudo em transform/clip (60fps),
 * reusando motion + o Lenis já ativo. Sem dependência nova.
 */
export function SlicerReveal() {
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ['start start', 'end end'],
  });

  // Suaviza o scrub com spring para um movimento mais "líquido".
  const p = useSpring(scrollYProgress, { stiffness: 90, damping: 30, restDelta: 0.0005 });

  const laserTop = useTransform(p, [0, 1], ['4%', '96%']);
  const solidClip = useTransform(p, (v) => `inset(0% 0% ${Math.max(0, (1 - v) * 100)}% 0%)`);
  const pct = useTransform(p, (v) => `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%`);
  const layers = useTransform(p, (v) => `${Math.round(Math.min(1, Math.max(0, v)) * 240)}`);
  const laserGlow = useTransform(p, [0, 0.5, 1], [0.5, 1, 0.5]);

  // Tilt 3D reativo ao cursor sobre o painel.
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 150, damping: 18 });
  const sry = useSpring(ry, { stiffness: 150, damping: 18 });

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    ry.set(nx * 14);
    rx.set(-ny * 14);
  }
  function onPointerLeave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <section className="relative bg-[#F9F7F2]">
      <div ref={trackRef} className="relative h-[240vh]">
        <div className="sticky top-0 flex h-screen items-center overflow-hidden px-6">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
            {/* Texto */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#8E6D4D]">
                Manufatura Aditiva
              </span>
              <h2 className="mt-3 font-sora text-3xl font-black uppercase tracking-tight text-[#2B2622] md:text-5xl">
                O Fatiador Digital
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-[#6B5E55]">
                Cada peça nasce de um modelo 3D e é traduzida em milhares de camadas. O laser
                de fatiamento percorre a geometria convertendo a malha em uma estrutura sólida
                preenchida com infill giroide — leve, resistente e otimizada.
              </p>

              <div className="mt-8 flex flex-wrap gap-6 text-[11px] font-bold uppercase tracking-wider text-[#6B5E55]">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm border border-[#2B2622]/40" /> Malha (wireframe)
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-[#A6815C]" /> Infill giroide
                </span>
              </div>

              {/* Métricas ao vivo */}
              <div className="mt-8 flex items-center gap-8">
                <Metric label="Progresso" value={pct} />
                <Metric label="Camadas" value={layers} />
              </div>
            </motion.div>

            {/* Peça abstrata animada (tilt reativo) */}
            <div className="flex justify-center [perspective:1000px]">
              <motion.div
                onPointerMove={onPointerMove}
                onPointerLeave={onPointerLeave}
                style={{ rotateX: srx, rotateY: sry, transformStyle: 'preserve-3d' }}
                className="relative aspect-square w-full max-w-md overflow-hidden rounded-[2rem] border border-[#E8E2D9] bg-white shadow-[0_20px_60px_-20px_rgba(43,38,34,0.25)]"
              >
                {/* Malha base (girando lentamente) */}
                <motion.div
                  className="absolute inset-0"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
                  style={{ transformOrigin: '50% 50%' }}
                >
                  <HexWire />
                </motion.div>

                {/* Sólido (infill giroide) revelado de cima para baixo */}
                <motion.div className="absolute inset-0" style={{ clipPath: solidClip }}>
                  <HexSolid />
                </motion.div>

                {/* Partículas de filamento flutuando */}
                <Particles />

                {/* Linha laser bronze com varredura */}
                <motion.div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: laserTop }}>
                  <motion.div
                    className="h-[2px] w-full bg-[#A6815C]"
                    style={{ opacity: laserGlow, boxShadow: '0 0 14px 3px rgba(166,129,92,0.75)' }}
                  />
                  {/* Faixa de brilho da varredura */}
                  <div className="absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-[#A6815C]/25 to-transparent" />
                  <motion.span
                    className="absolute right-3 -top-5 rounded-full bg-[#2B2622] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                  >
                    Slicing
                  </motion.span>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: MotionValue<string> }) {
  return (
    <div>
      <span className="block text-[9px] font-bold uppercase tracking-[0.25em] text-[#8E6D4D]">{label}</span>
      <motion.span className="mt-1 block font-mono text-2xl font-black tabular-nums text-[#2B2622]">
        {value}
      </motion.span>
    </div>
  );
}

function Particles() {
  const dots = [
    { left: '20%', delay: 0, dur: 5 },
    { left: '48%', delay: 1.2, dur: 6.5 },
    { left: '70%', delay: 2.1, dur: 5.5 },
    { left: '85%', delay: 0.6, dur: 7 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      {dots.map((d, i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-[#A6815C]/60"
          style={{ left: d.left, bottom: '-6px' }}
          animate={{ y: [-0, -260], opacity: [0, 0.9, 0] }}
          transition={{ duration: d.dur, repeat: Infinity, delay: d.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

/** Malha técnica (contorno + grid fino), sem preenchimento. */
function HexWire() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
      <defs>
        <pattern id="wireGrid" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M16 0H0V16" fill="none" stroke="#2B2622" strokeOpacity="0.08" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="200" height="200" fill="url(#wireGrid)" />
      <polygon points="100,24 158,58 158,142 100,176 42,142 42,58" fill="none" stroke="#2B2622" strokeOpacity="0.55" strokeWidth="1.2" />
      <polygon points="100,52 134,72 134,128 100,148 66,128 66,72" fill="none" stroke="#A6815C" strokeOpacity="0.6" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="100" y1="24" x2="100" y2="176" stroke="#2B2622" strokeOpacity="0.18" strokeWidth="0.8" />
      <line x1="42" y1="58" x2="158" y2="142" stroke="#2B2622" strokeOpacity="0.12" strokeWidth="0.8" />
      <line x1="158" y1="58" x2="42" y2="142" stroke="#2B2622" strokeOpacity="0.12" strokeWidth="0.8" />
    </svg>
  );
}

/** Mesma peça, sólida, com hachura tipo infill giroide + linhas de camada. */
function HexSolid() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
      <defs>
        <pattern id="gyroid" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 7 Q3.5 0 7 7 T14 7" fill="none" stroke="#8E6D4D" strokeOpacity="0.55" strokeWidth="1.1" />
          <path d="M0 14 Q3.5 7 7 14 T14 14" fill="none" stroke="#A6815C" strokeOpacity="0.4" strokeWidth="1.1" />
        </pattern>
        <clipPath id="hexClip">
          <polygon points="100,24 158,58 158,142 100,176 42,142 42,58" />
        </clipPath>
      </defs>
      <g clipPath="url(#hexClip)">
        <rect x="0" y="0" width="200" height="200" fill="#A6815C" fillOpacity="0.12" />
        <rect x="0" y="0" width="200" height="200" fill="url(#gyroid)" />
        {/* Linhas de camada horizontais (sensação de deposição) */}
        {Array.from({ length: 18 }).map((_, i) => (
          <line key={i} x1="42" y1={30 + i * 8} x2="158" y2={30 + i * 8} stroke="#2B2622" strokeOpacity="0.06" strokeWidth="0.6" />
        ))}
      </g>
      <polygon points="100,24 158,58 158,142 100,176 42,142 42,58" fill="none" stroke="#A6815C" strokeWidth="1.6" />
    </svg>
  );
}
