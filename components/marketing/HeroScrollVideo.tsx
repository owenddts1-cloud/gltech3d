'use client';

import { useEffect, useRef, useState } from 'react';
import { LogIn } from 'lucide-react';

const SCROLL_LENGTH_VH = 350;
const LERP = 0.09;

const BEATS = {
  textOut: 0.25,
  explodeIn: 0.30,
  explodeOut: 0.75,
  finalIn: 0.80,
};

export default function HeroScrollVideo() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [progress, setProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section) return;

    let raf = 0, target = 0, current = 0, duration = 0;
    let pendingTime: number | null = null;

    const onMeta = () => { duration = video.duration || 0; };
    if (video.readyState >= 1) onMeta();
    video.addEventListener('loadedmetadata', onMeta);

    const tick = () => {
      const rect = section.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      target = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;

      current += (target - current) * LERP;
      if (Math.abs(target - current) < 0.0005) current = target;

      if (duration > 0 && video.readyState >= 2) {
        const t = current * (duration - 0.05);
        if (!video.seeking) video.currentTime = t;
      }

      setProgress(current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener('loadedmetadata', onMeta);
    };
  }, []);

  const textOpacity = 1 - Math.min(1, progress / BEATS.textOut);
  const explodeOpacity = progress > BEATS.explodeIn && progress < BEATS.explodeOut ? 1 : 0;
  const finalOpacity = progress > BEATS.finalIn ? 1 : 0;

  return (
    <section ref={sectionRef} className="relative w-full bg-[#F4F1EB]" style={{ height: `${SCROLL_LENGTH_VH}vh` }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center">
        
        {/* Navbar Original Restaurado */}
        <div className="absolute top-6 inset-x-0 z-50 flex justify-center px-4">
          <div className="w-full max-w-5xl liquid-glass-light rounded-full px-6 py-3 flex justify-between items-center shadow-lg shadow-black/5">
            <div className="flex items-center gap-2 font-bold text-[#2D2A26] text-lg">
              <span className="w-6 h-6 rounded-md bg-[#A88060] flex items-center justify-center text-white text-xs">GL</span>
              GLTech3D
            </div>
            <div className="hidden md:flex gap-8 text-sm font-medium text-gray-600">
              <a href="#inicio" className="hover:text-[#A88060] transition-colors">Início</a>
              <a href="#categorias-e-produtos" className="hover:text-[#A88060] transition-colors">Categorias</a>
              <a href="#categorias-e-produtos" className="hover:text-[#A88060] transition-colors">Produtos</a>
              <a href="#contato" className="hover:text-[#A88060] transition-colors">Contato</a>
            </div>
            <button className="bg-[#A88060] text-white text-xs font-semibold px-5 py-2.5 rounded-full flex items-center gap-2 hover:bg-[#8F6B4F] transition-colors shadow-sm">
              <LogIn className="w-3.5 h-3.5" /> Entrar
            </button>
          </div>
        </div>

        {/* Player de Vídeo Sincronizado */}
        <div className="absolute inset-0 flex items-center justify-center z-0 mix-blend-multiply opacity-90">
          <video
            ref={videoRef}
            src={isMobile ? "/videos/gl-rocket-explode-scrub-mobile.mp4" : "/videos/gl-rocket-explode-scrub.mp4"}
            className="h-full w-full object-cover"
            muted playsInline preload="auto"
          />
        </div>

        {/* Interface de Texto Original à Esquerda */}
        <div 
          className="absolute inset-0 z-20 flex flex-col justify-center px-6 md:px-20 max-w-2xl transition-all duration-300 pointer-events-none"
          style={{ opacity: textOpacity, transform: `translateY(calc(0px - ${progress * 50}px))` }}
        >
          <div className="inline-flex items-center gap-2 bg-white/80 border border-gray-200 px-3 py-1 rounded-full w-fit mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">IMPRESSÃO 3D · FEITO NO BRASIL</span>
          </div>
          <h1 className="hero-heading-dark text-4xl sm:text-6xl md:text-7xl leading-tight uppercase font-black mb-4">
            Do arquivo 3D <br />
            <span className="font-heading italic font-normal text-[#A88060] lowercase">à realidade</span>
          </h1>
          <p className="text-gray-600 font-light text-sm sm:text-base leading-relaxed mb-8 max-w-md">
            Da peça decorativa ao nosso GL ROCKET: engenharia e impressão 3D de alta performance. Role e veja a vista explodida.
          </p>
          <div className="flex gap-4 pointer-events-auto">
            <a href="#categorias-e-produtos" className="bg-[#A88060] text-white text-xs sm:text-sm font-bold uppercase tracking-wider px-8 py-3.5 rounded-xl shadow-md hover:bg-[#8F6B4F] transition-colors text-center flex items-center justify-center">
              Ver Coleção
            </a>
            <a href="#contato" className="border border-gray-300 bg-white/40 backdrop-blur-sm text-gray-700 text-xs sm:text-sm font-bold uppercase tracking-wider px-8 py-3.5 rounded-xl hover:bg-white/80 transition-colors text-center flex items-center justify-center">
              Fale com a gente
            </a>
          </div>
        </div>

        {/* Indicador de Vista Explodida durante o Scrubbing */}
        <div 
          className="absolute bottom-20 left-6 md:left-20 z-30 max-w-sm transition-all duration-300 text-left pointer-events-none"
          style={{ opacity: explodeOpacity }}
        >
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#A88060] block mb-1">Engenharia Exclusiva</span>
          <h3 className="text-xl sm:text-2xl font-black uppercase text-gray-800 mb-2">Vista Explodida</h3>
          <p className="text-xs sm:text-sm text-gray-600 font-light">Placa de controle, servos do gimbal e bateria: todos os componentes internos visíveis e milimetricamente projetados.</p>
        </div>

        {/* CTA de fim da experiência de scroll */}
        <div className="absolute bottom-12 inset-x-0 z-30 flex justify-center transition-opacity duration-300" style={{ opacity: finalOpacity }}>
          <a href="#portfolio-marquee" className="bg-[#2D2A26] text-white text-xs font-bold uppercase tracking-widest px-8 py-3.5 rounded-full shadow-xl hover:scale-105 transition-transform">
            Explorar Catálogo ↓
          </a>
        </div>
      </div>
    </section>
  );
}
