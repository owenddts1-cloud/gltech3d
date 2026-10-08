'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { Lock, LockOpen, Gauge, Calculator } from 'lucide-react';
import { PRO_MODULES } from '@/lib/plan/modules';

/**
 * Amostra do CRM com os cadeados destravando conforme a página rola.
 *
 * É mockup em DOM/CSS, não vídeo nem screenshot, e a razão decisiva não é peso:
 * é que ele se constrói a partir de `PRO_MODULES` — **a mesma lista que o gate
 * do servidor usa**. Um vídeo ou uma captura mostrariam módulos que não existem
 * mais no dia em que a navegação mudar, e ninguém notaria.
 *
 * (Vídeo custaria 1-3 MB e não reage a scroll; captura com cadeados posicionados
 * por coordenada desalinha em qualquer zoom, e `images.unoptimized: true`
 * mandaria o arquivo cheio para o celular.)
 */

/** Oito linhas: o bastante para ler como menu, sem virar lista. */
const LINHAS = PRO_MODULES.slice(0, 8);

const LIVRES = [
  { label: 'Dashboard', Icon: Gauge },
  { label: 'Calculadora 3D', Icon: Calculator },
];

export function CrmPreview({ trialDays }: { trialDays: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.85', 'center 0.4'],
  });

  return (
    <section
      id="dentro-do-pro"
      ref={ref}
      className="border-y border-[#E8E2D9] bg-[#FDFCFA] px-6 py-16 md:py-24"
    >
      <div className="mx-auto w-full max-w-5xl">
        <header className="mx-auto mb-10 max-w-2xl text-center">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#A6815C]">
            Por dentro
          </span>
          <h2 className="mt-2 font-sora text-3xl font-black tracking-tight text-[#2D241E] md:text-4xl">
            É este o sistema que abre no seu login.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#6B5E55]">
            Nos {trialDays} dias de teste, tudo abaixo fica destravado. Role para ver.
          </p>
        </header>

        {/* Moldura decorativa; a lista acessível vem logo abaixo. */}
        <div
          aria-hidden
          className="mx-auto overflow-hidden rounded-2xl border border-[#E8E2D9] bg-white shadow-[0_24px_60px_-28px_rgba(43,38,34,0.4)]"
        >
          <div className="flex items-center gap-2 border-b border-[#E8E2D9] bg-[#F9F7F2] px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#D5CBBF]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#D5CBBF]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#D5CBBF]" />
            <span className="ml-3 text-[11px] font-semibold text-[#6B5E55]">
              Calc3D PRO — sua operação
            </span>
          </div>

          <div className="grid grid-cols-[minmax(170px,210px)_1fr]">
            <nav className="border-r border-[#E8E2D9] bg-[#2D241E] p-3">
              {LIVRES.map(({ label, Icon }) => (
                <div
                  key={label}
                  className="mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-[#F9F7F2]"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-[#A6815C]" />
                  <span className="truncate">{label}</span>
                  <span className="ml-auto rounded bg-[#6F7F52]/25 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#B7CC94]">
                    Grátis
                  </span>
                </div>
              ))}

              <div className="my-2 h-px bg-white/10" />

              {LINHAS.map((m, i) => (
                <PreviewRow
                  key={m.routePrefix}
                  label={m.label}
                  index={i}
                  total={LINHAS.length}
                  progress={scrollYProgress}
                  reduced={!!reduced}
                />
              ))}
            </nav>

            <div className="bg-[#F9F7F2] p-5">
              <div className="h-3 w-28 rounded-full bg-[#E8E2D9]" />
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-xl border border-[#E8E2D9] bg-white p-3">
                    <div className="h-2 w-10 rounded-full bg-[#E8E2D9]" />
                    <div className="mt-2 h-4 w-16 rounded bg-[#D5CBBF]" />
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {[72, 54, 88, 40].map((w, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-[#E8E2D9] bg-white px-3 py-2.5">
                    <div className="h-2 rounded-full bg-[#E8E2D9]" style={{ width: `${w}px` }} />
                    <div className="ml-auto h-2 w-10 rounded-full bg-[#A6815C]/40" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* O conteúdo real para leitor de tela e para quem não vê a animação. */}
        <ul className="sr-only">
          {LINHAS.map((m) => (
            <li key={m.routePrefix}>{m.label}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PreviewRow({
  label,
  index,
  total,
  progress,
  reduced,
}: {
  label: string;
  index: number;
  total: number;
  progress: ReturnType<typeof useScroll>['scrollYProgress'];
  reduced: boolean;
}) {
  // Cada linha destrava num pedaço próprio do progresso — o efeito de cascata
  // sai da divisão do intervalo, sem orquestrador nem timer.
  const inicio = (index / total) * 0.75;
  const fim = inicio + 0.2;

  const unlock = useTransform(progress, [inicio, fim], [0, 1]);
  const lockOpacity = useTransform(unlock, [0, 1], [1, 0]);
  const lockRotate = useTransform(unlock, [0, 1], [0, -12]);
  const openOpacity = useTransform(unlock, [0.55, 1], [0, 1]);
  const textOpacity = useTransform(unlock, [0, 1], [0.45, 1]);
  const barWidth = useTransform(unlock, [0, 1], ['0%', '100%']);

  // Com movimento reduzido, mostra o estado final — nunca o travado, que
  // pareceria um erro.
  const style = reduced ? {} : { opacity: textOpacity };

  return (
    <motion.div
      style={style}
      className="relative mb-1 flex items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-[12px] font-medium text-[#F9F7F2]"
    >
      <motion.span
        aria-hidden
        style={reduced ? { width: '100%' } : { width: barWidth }}
        className="absolute inset-y-0 left-0 bg-[#A6815C]/15"
      />
      <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        {!reduced && (
          <motion.span style={{ opacity: lockOpacity, rotate: lockRotate }} className="absolute">
            <Lock className="h-3.5 w-3.5 text-[#D5CBBF]" />
          </motion.span>
        )}
        <motion.span style={reduced ? { opacity: 1 } : { opacity: openOpacity }} className="absolute">
          <LockOpen className="h-3.5 w-3.5 text-[#A6815C]" />
        </motion.span>
      </span>
      <span className="relative truncate">{label}</span>
    </motion.div>
  );
}
