'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { SmoothScroll } from './SmoothScroll';
import { CinematicNav } from './CinematicNav';
import { RocketVideoScrub } from './RocketVideoScrub';
import { StorySection, Reveal } from './SectionPanel';
import { ProgressRail } from './ProgressRail';
import Categories from '@/components/marketing/Categories';
import ProductGrid from '@/components/marketing/ProductGrid';
import LeadForm from '@/components/marketing/LeadForm';
import NewsletterBar from '@/components/marketing/NewsletterBar';
import Footer from '@/components/marketing/Footer';

const KICKER = 'text-[11px] font-bold tracking-[0.25em] uppercase text-[#8E6D4D]';
const STORY_COUNT = 5;

export function CinematicLanding() {
  const [active, setActive] = useState(0);
  const [mediaVisible, setMediaVisible] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');

  const activate = (i: number) => {
    setActive(i);
    setMediaVisible(true);
  };

  return (
    <SmoothScroll>
      <div className="relative w-full">
        <CinematicNav />
        <RocketVideoScrub visible={mediaVisible} />
        <ProgressRail count={STORY_COUNT} active={active} visible={mediaVisible} />

        {/* ── Story 0 — Hero ─────────────────────────────────────────── */}
        <StorySection id="story-0" index={0} onActivate={activate} side="left">
          <Reveal>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8E2D9] border border-[#D1C7B7] text-[10px] font-bold tracking-widest uppercase text-[#8E6D4D] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Impressão 3D • Feito no Brasil
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="text-5xl md:text-7xl font-black font-sora leading-[0.95] tracking-tight text-[#2D241E]">
              Do arquivo 3D
              <span className="block font-serif italic font-normal text-[#A6815C]">à realidade</span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-[#6B5E55] text-base md:text-lg max-w-sm leading-relaxed">
              Da peça decorativa ao nosso GL ROCKET: engenharia e impressão 3D de alta performance. Role e veja a vista explodida.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                onClick={() => document.getElementById('colecao')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-4 bg-[#A6815C] hover:bg-[#8E6D4D] hover:-translate-y-0.5 transition-all text-white rounded-2xl font-bold shadow-lg shadow-[#A6815C]/20"
              >
                Ver Coleção
              </button>
              <button
                onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-4 border-2 border-[#D1C7B7] text-[#6B5E55] hover:border-[#A6815C] hover:text-[#A6815C] transition-all rounded-2xl font-bold"
              >
                Fale com a gente
              </button>
            </div>
          </Reveal>
          <motion.div
            className="absolute bottom-10 left-8 md:left-20 flex items-center gap-2 text-[#8E6D4D]"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            <ChevronDown className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Role para explorar</span>
          </motion.div>
        </StorySection>

        {/* ── Story 1 — Precisão ─────────────────────────────────────── */}
        <StorySection id="story-1" index={1} onActivate={activate} side="right">
          <Reveal><span className={KICKER}>Ogiva · Aerodinâmica</span></Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-2 text-5xl md:text-6xl font-black font-sora leading-[0.95] text-[#2D241E]">
              Alta
              <span className="block font-serif italic font-normal text-[#A6815C]">Precisão</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6">
              <div className="text-[11px] uppercase tracking-widest text-[#8E6D4D]">Camada</div>
              <div className="text-4xl font-black font-sora text-[#2D241E]">0,1<span className="text-2xl">mm</span></div>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-4 text-[#6B5E55] text-sm leading-relaxed">
              Calibração fina e fatiamento otimizado para detalhes nítidos, encaixes perfeitos e superfícies limpas.
            </p>
          </Reveal>
        </StorySection>

        {/* ── Story 2 — Materiais ────────────────────────────────────── */}
        <StorySection id="story-2" index={2} onActivate={activate} side="left">
          <Reveal><span className={KICKER}>Aviônica · Eletrônica</span></Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-2 text-5xl md:text-6xl font-black font-sora leading-[0.95] text-[#2D241E]">
              Materiais
              <span className="block font-serif italic font-normal text-[#A6815C]">Premium</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 flex flex-wrap gap-2">
              {['PLA', 'PETG', 'PLA Silk'].map((m) => (
                <span key={m} className="px-3 py-1.5 rounded-lg bg-white border border-[#E8E2D9] text-sm font-semibold text-[#2D241E]">{m}</span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-4 text-[#6B5E55] text-sm leading-relaxed">
              Filamentos selecionados por resistência e cor. Do fosco elegante ao brilho sedoso do Silk multicolor.
            </p>
          </Reveal>
        </StorySection>

        {/* ── Story 3 — Acabamento ───────────────────────────────────── */}
        <StorySection id="story-3" index={3} onActivate={activate} side="right">
          <Reveal><span className={KICKER}>Estrutura · Acabamento</span></Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-2 text-5xl md:text-6xl font-black font-sora leading-[0.95] text-[#2D241E]">
              Acabamento
              <span className="block font-serif italic font-normal text-[#A6815C]">Impecável</span>
            </h2>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-6 text-[#6B5E55] text-sm leading-relaxed">
              Pós-processamento cuidadoso: lixamento, pintura realista e revisão peça a peça antes de ir pra sua mão.
            </p>
          </Reveal>
        </StorySection>

        {/* ── Story 4 — Sob Demanda ──────────────────────────────────── */}
        <StorySection id="story-4" index={4} onActivate={activate} side="left">
          <Reveal><span className={KICKER}>Propulsão · Sob medida</span></Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-2 text-5xl md:text-6xl font-black font-sora leading-[0.95] text-[#2D241E]">
              Sob
              <span className="block font-serif italic font-normal text-[#A6815C]">Demanda</span>
            </h2>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-6 text-[#6B5E55] text-sm leading-relaxed">
              Cor, tamanho e logo do seu jeito. Do action figure ao brinde corporativo, a gente imprime a sua ideia.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <button
              onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })}
              className="mt-6 px-8 py-4 bg-[#A6815C] hover:bg-[#8E6D4D] hover:-translate-y-0.5 transition-all text-white rounded-2xl font-bold shadow-lg shadow-[#A6815C]/20"
            >
              Peça o seu
            </button>
          </Reveal>
        </StorySection>

        {/* ── Coleção (opaque — MediaStage fades out) ────────────────── */}
        <section
          id="colecao"
          className="relative z-30 bg-[#F9F7F2] pt-24 pb-8"
          onMouseEnter={() => setMediaVisible(false)}
        >
          <motion.div
            onViewportEnter={() => setMediaVisible(false)}
            viewport={{ amount: 0.2 }}
          >
            <div className="text-center mb-6 px-6">
              <span className={KICKER}>Nossa loja</span>
              <h2 className="mt-2 text-4xl md:text-5xl font-black font-sora text-[#2D241E]">A Coleção</h2>
            </div>
            <Categories selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
            <ProductGrid selectedCategory={selectedCategory} />
          </motion.div>
        </section>

        {/* ── Conversion + footer (reused, already wired to backend) ── */}
        <div className="relative z-30 bg-[#F9F7F2]">
          <LeadForm />
          <NewsletterBar />
          <Footer />
        </div>
      </div>
    </SmoothScroll>
  );
}
