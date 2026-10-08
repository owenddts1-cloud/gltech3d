'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { track } from '@/lib/analytics/track';

/**
 * CTA principal: o botão que inicia o trial.
 *
 * O rótulo é composto de propósito. "Ver o que o PRO faz" sozinho promete *ver*
 * e abre um formulário — a quebra de expectativa custa mais conversão do que o
 * parêntese economiza.
 *
 * A borda usa gradiente cônico em rotação lenta (mesmo recurso que a Sidebar já
 * aplica no avatar), não `box-shadow` pulsante: o gradiente anima o `transform`
 * de um elemento próprio, sem repaint do botão a cada frame.
 */
export function TrialCta({ className = '', trialDays }: { className?: string; trialDays: number }) {
  const reduced = useReducedMotion();

  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <motion.div
        className="relative rounded-2xl p-[2px]"
        whileHover={reduced ? undefined : { scale: 1.04 }}
        whileTap={reduced ? undefined : { scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      >
        <span
          aria-hidden
          className={`absolute inset-0 rounded-2xl bg-[conic-gradient(from_0deg,#8E6D4D,#A6815C,#D9C7A8,#A6815C,#8E6D4D)] ${
            reduced ? '' : 'animate-spin-slow'
          }`}
        />
        <Link
          href="/criar-conta"
          onClick={() => track('start_trial', { origem: 'calc3d_hero' })}
          className="relative flex items-center gap-2.5 rounded-[14px] bg-[#2D241E] px-7 py-4 text-sm font-bold text-white transition-colors hover:bg-[#3E342C]"
        >
          Ver o que o PRO faz
          <span className="rounded bg-[#A6815C]/25 px-2 py-0.5 text-[10px] font-black tracking-[0.12em] text-[#D9C7A8]">
            {trialDays} DIAS GRÁTIS
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
      <span className="text-xs text-[#6B5E55]">Sem cartão. Sem cobrança automática.</span>
    </div>
  );
}
