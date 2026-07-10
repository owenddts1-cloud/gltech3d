'use client';

import type { CSSProperties } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ParticleHero } from '@/components/marketing/ParticleHero';

/** One "camera" keyframe per story section — image + transform of the stage. */
export interface StageFrame {
  src: string;
  rotate: number;
  scale: number;
  glow: string; // accent glow color for this frame
}

export const STAGE_FRAMES: StageFrame[] = [
  { src: '/images/Luminarias/Lua Cheia/luminarialuacheia1.png', rotate: -6, scale: 1.0, glow: '#A6815C' },
  { src: '/images/Bases Carregadoras/Base Carregadora Relogio Apple Watch/BaseCApple1.png', rotate: 5, scale: 1.18, glow: '#8E6D4D' },
  { src: '/images/Action Figure/Charizard Articulavel/Charizard1.png', rotate: -3, scale: 1.06, glow: '#C08A57' },
  { src: '/images/Action Figure/Batman/Batman.png', rotate: 6, scale: 1.12, glow: '#6B5E55' },
  { src: '/images/Presentes/Pascoa/3A8A51C1-EB72-4F9B-AF5E-79E985A913F7.png', rotate: -4, scale: 1.0, glow: '#A6815C' },
];

/**
 * Fixed cinematic presentation stage. A product image sits pinned in the
 * viewport and morphs (crossfade + rotate + scale) as the active story section
 * changes, with an ambient particle field, a rotating conic glow ring, and a
 * radial vignette. The whole stage fades out once the collection section is
 * reached (`visible = false`).
 */
export function MediaStage({ activeIndex, visible }: { activeIndex: number; visible: boolean }) {
  const idx = Math.min(Math.max(activeIndex, 0), STAGE_FRAMES.length - 1);
  const frame = STAGE_FRAMES[idx]!;

  return (
    <motion.div
      aria-hidden
      className="fixed inset-0 z-[5] pointer-events-none flex items-center justify-center overflow-hidden"
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
    >
      {/* Ambient particle field */}
      <ParticleHero className="absolute inset-0 opacity-70" />

      {/* Radial vignette to focus center */}
      <div className="absolute inset-0 cine-vignette" />

      {/* Rotating conic glow ring behind the product */}
      <motion.div
        className="absolute w-[560px] h-[560px] max-w-[92vw] max-h-[92vw] rounded-full cine-ring"
        style={{ '--ring': frame.glow } as CSSProperties}
        animate={{ rotate: 360 }}
        transition={{ duration: 26, ease: 'linear', repeat: Infinity }}
      />
      <motion.div
        className="absolute w-[420px] h-[420px] max-w-[74vw] max-h-[74vw] rounded-full blur-3xl"
        animate={{ backgroundColor: frame.glow, opacity: 0.22, scale: frame.scale }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
      />

      {/* Crossfading, morphing product image */}
      <div className="relative w-[440px] h-[440px] max-w-[80vw] max-h-[62vh] flex items-center justify-center">
        <AnimatePresence mode="popLayout">
          <motion.img
            key={idx}
            src={frame.src}
            alt=""
            className="absolute inset-0 w-full h-full object-contain drop-shadow-2xl"
            initial={{ opacity: 0, scale: 0.9, rotate: frame.rotate - 8, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: frame.scale, rotate: frame.rotate, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.05, filter: 'blur(6px)' }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
