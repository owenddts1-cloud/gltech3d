'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ShieldCheck, TrendingDown, Zap, AlertTriangle } from 'lucide-react';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import { SmoothScroll } from '@/components/marketing/cinematic/SmoothScroll';
import { TRIAL_DAYS } from '@/lib/tenants/trial';
import { HeroStage } from './_components/HeroStage';
import { TrialCta } from './_components/TrialCta';
import { CrmPreview } from './_components/CrmPreview';
import { CalculatorBlock } from './_components/CalculatorBlock';
import { PlansBlock } from './_components/PlansBlock';
import { PixCheckoutBlock } from './_components/PixCheckoutBlock';
import { FaqBlock } from './_components/FaqBlock';

/** Easing canônico do design system (docs/design-system/07-motion-language.md). */
const EASE = [0.16, 1, 0.3, 1] as const;

const PROBLEMAS = [
  {
    Icon: TrendingDown,
    titulo: 'Você chuta o preço',
    texto: 'Olha o que o concorrente cobra, arredonda e torce. O lucro vira sobra, não meta.',
  },
  {
    Icon: Zap,
    titulo: 'Energia e desgaste somem',
    texto: 'A impressora roda 8 horas e ninguém cobra por isso. A máquina envelhece de graça.',
  },
  {
    Icon: AlertTriangle,
    titulo: 'A falha é prejuízo seu',
    texto: 'Soltou do berço no fim da peça? Reimprime, gasta de novo e não repassa.',
  },
];

export function Calc3dProClient() {
  const reduced = useReducedMotion();
  const reveal = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-80px' },
      };

  return (
    <SmoothScroll>
      <main className="min-h-screen bg-[#F9F7F2] text-[#2B2622] pt-24">
        <Navbar />

        {/* Hero */}
        <section className="px-6 pb-8 pt-8 md:pt-14">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#E8E2D9] bg-white px-4 py-1.5 text-[11px] font-bold text-[#6B5E55]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#6F7F52]" />
                Calculadora grátis · {TRIAL_DAYS} dias de CRM
              </span>

              <h1 className="mt-5 font-sora text-4xl font-black leading-[1.06] tracking-tight text-[#2D241E] md:text-6xl">
                Custo real da peça — e o preço que protege o seu lucro.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-[#6B5E55]">
                Some filamento, energia, desgaste da máquina, suas horas e o risco de falha antes de
                mandar o orçamento. Depois opere a venda inteira no Calc3D PRO.
              </p>

              <div className="mt-8 flex flex-wrap items-start gap-4">
                <TrialCta />
                <a
                  href="#calculadora"
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#E8E2D9] bg-white px-6 py-4 text-sm font-bold text-[#2D241E] transition-colors hover:bg-[#E8E2D9]/60"
                >
                  Calcular meu preço agora
                </a>
              </div>

              <p className="mt-6 inline-flex items-center gap-2 text-xs text-[#6B5E55]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#A6815C]" />
                Cálculo local no navegador · fórmula transparente · nada é enviado
              </p>
            </div>

            <div className="flex justify-center lg:justify-end">
              <HeroStage />
            </div>
          </div>
        </section>

        {/* O problema */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto w-full max-w-5xl">
            <motion.h2
              {...reveal}
              transition={{ duration: 0.5, ease: EASE }}
              className="mx-auto max-w-2xl text-center font-sora text-3xl font-black tracking-tight text-[#2D241E] md:text-4xl"
            >
              O orçamento sai barato porque a conta está incompleta.
            </motion.h2>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {PROBLEMAS.map(({ Icon, titulo, texto }, i) => (
                <motion.div
                  key={titulo}
                  {...reveal}
                  transition={{ duration: 0.5, ease: EASE, delay: reduced ? 0 : i * 0.08 }}
                  className="rounded-2xl border border-[#E8E2D9] bg-white p-6"
                >
                  <Icon className="h-5 w-5 text-[#B4553F]" />
                  <h3 className="mt-3 font-sora text-lg font-black text-[#2D241E]">{titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#6B5E55]">{texto}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <CalculatorBlock />
        <CrmPreview />
        <PlansBlock />
        <PixCheckoutBlock />
        <FaqBlock />

        <section className="px-6 py-12">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 text-center">
            <p className="text-sm text-[#6B5E55]">Já tem acesso ao Calc3D PRO?</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-[#E8E2D9] bg-white px-6 py-3 text-sm font-bold text-[#2D241E] transition-colors hover:bg-[#E8E2D9]/60"
            >
              Entrar no sistema
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <Footer />
      </main>
    </SmoothScroll>
  );
}
