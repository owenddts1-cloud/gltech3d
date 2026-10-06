'use client';

import { useRef } from 'react';
import dynamic from 'next/dynamic';
import { useScroll, useMotionValueEvent } from 'motion/react';
import { useWebglCapable } from '@/hooks/useWebglCapable';

/**
 * `ssr: false` é obrigatório (`three` toca `window` no import) e mantém o pacote
 * fora do bundle de qualquer outra rota — a regra de
 * `docs/specs/modelagem-3d.md`: nenhuma dependência 3D no bundle de quem só abre
 * o Dashboard.
 */
const PrintHero = dynamic(() => import('./PrintHero'), { ssr: false });

/**
 * Fallback estático: SVG inline, zero download.
 *
 * Preferido a um WebP porque `next.config.ts` roda com `images.unoptimized:
 * true` — não haveria AVIF nem `srcset`, e o arquivo cheio iria para o celular,
 * exatamente o aparelho que cai aqui.
 */
function PrintHeroFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
      <svg viewBox="0 0 320 320" className="h-full w-full max-h-[420px] max-w-[420px]">
        <defs>
          <linearGradient id="c3dPiece" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#8E6D4D" />
            <stop offset="62%" stopColor="#A6815C" />
            <stop offset="62%" stopColor="#A6815C" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#A6815C" stopOpacity="0.16" />
          </linearGradient>
        </defs>
        <ellipse cx="160" cy="252" rx="92" ry="14" fill="#E8E2D9" />
        <path
          d="M118 248 C110 206 134 186 138 156 C142 126 120 104 126 80 L194 80 C200 104 178 126 182 156 C186 186 210 206 202 248 Z"
          fill="url(#c3dPiece)"
        />
        <path d="M126 80 L194 80" stroke="#8E6D4D" strokeWidth="2" opacity="0.5" />
        <rect x="150" y="48" width="20" height="26" rx="3" fill="#2D241E" />
      </svg>
    </div>
  );
}

/**
 * Palco do hero: decide entre a cena WebGL e o fallback, e alimenta o progresso
 * do scroll por REF.
 *
 * O progresso vai num `useRef` e não num estado: a cena lê o valor dentro do
 * próprio `requestAnimationFrame`, então um `setState` por frame de scroll só
 * geraria re-render do React sem mudar um pixel a mais.
 */
export function HeroStage() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const capable = useWebglCapable();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    // A peça termina de "imprimir" antes do fim do scroll do hero: ver a peça
    // pronta por um instante é o que fecha a narrativa.
    progress.current = Math.min(1, v * 1.6);
  });

  return (
    <div ref={sectionRef} className="relative aspect-square w-full max-w-[520px]">
      {/* Grade de blueprint atrás do canvas: 0 KB de geometria. */}
      <div className="cine-blueprint absolute inset-0 rounded-3xl" aria-hidden />
      {capable ? <PrintHero progress={progress} /> : <PrintHeroFallback />}
      <div className="cine-vignette pointer-events-none absolute inset-0" aria-hidden />
    </div>
  );
}
