'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import Magnet from './Magnet';

const SCROLL_LENGTH_VH = 450;
const LERP = 0.08;

const BEATS = {
  introOut: 0.15,
  tiltIn: 0.22,
  tiltOut: 0.44,
  explodeIn: 0.52,
  explodeOut: 0.80,
  finalIn: 0.86,
};

function useDustParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const pointer = { x: -1, y: -1, active: false };
    let parX = 0;
    let parY = 0;
    
    const onPointerMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = (e.clientX - r.left) / (r.width || 1);
      pointer.y = (e.clientY - r.top) / (r.height || 1);
      pointer.active = true;
    };
    const onPointerLeave = () => { pointer.active = false; };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerout', onPointerLeave, { passive: true });

    const N = 60;
    const ps = Array.from({ length: N }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.8 + Math.random() * 1.8,
      vx: (Math.random() - 0.5) * 0.00015,
      vy: -0.00008 - Math.random() * 0.00015,
      a: 0.12 + Math.random() * 0.22,
      ph: Math.random() * Math.PI * 2,
    }));

    const tick = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const tpx = pointer.active ? (pointer.x - 0.5) : 0;
      const tpy = pointer.active ? (pointer.y - 0.5) : 0;
      parX += (tpx * 0.04 - parX) * 0.07;
      parY += (tpy * 0.04 - parY) * 0.07;
      
      for (const p of ps) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        if (p.x < -0.02) p.x = 1.02;
        if (p.x > 1.02) p.x = -0.02;

        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          const R = 0.18;
          if (d2 < R * R && d2 > 1e-6) {
            const d = Math.sqrt(d2);
            const f = (1 - d / R) * 0.008;
            p.x += (dx / d) * f;
            p.y += (dy / d) * f;
          }
        }
        const flicker = 0.65 + 0.35 * Math.sin(t * 0.0015 + p.ph);
        ctx.beginPath();
        ctx.arc((p.x - parX) * w, (p.y - parY) * h, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(215, 226, 234, ${p.a * flicker})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerout', onPointerLeave);
    };
  }, [canvasRef]);
}

function windowFade(p: number, inStart: number, inEnd: number, outStart: number, outEnd: number) {
  if (p <= inStart || p >= outEnd) return 0;
  if (p < inEnd) return (p - inStart) / (inEnd - inStart);
  if (p > outStart) return 1 - (p - outStart) / (outEnd - outStart);
  return 1;
}

export default function HeroScrollVideo() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useDustParticles(canvasRef);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section) return;

    let raf = 0;
    let target = 0;
    let current = 0;
    let duration = 0;
    let lastUiUpdate = -1;
    let pendingTime: number | null = null;
    let introPlaying = true;

    const onMeta = () => {
      duration = video.duration || 0;
      setReady(true);
    };
    if (video.readyState >= 1) onMeta();
    video.addEventListener('loadedmetadata', onMeta);

    const onSeeked = () => {
      if (pendingTime !== null && video.readyState >= 2) {
        video.currentTime = pendingTime;
        pendingTime = null;
      }
    };
    video.addEventListener('seeked', onSeeked);

    const computeTarget = () => {
      const rect = section.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      target = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
    };

    const tick = () => {
      computeTarget();

      if (target > 0.01) {
        introPlaying = false;
      }

      if (introPlaying) {
        if (duration > 0) {
          if (video.paused) {
            video.play().catch(() => {});
          }
          current = video.currentTime / duration;
          if (video.currentTime >= duration - 0.1) {
            introPlaying = false;
            video.pause();
          }
        }
      } else {
        if (!video.paused && !video.seeking) {
          video.pause();
        }
        current += (target - current) * LERP;
        if (Math.abs(target - current) < 0.0005) current = target;

        if (duration > 0 && video.readyState >= 2) {
          const t = current * (duration - 0.05);
          if (Math.abs(video.currentTime - t) > 0.001) {
            if (!video.seeking) {
              video.currentTime = t;
            } else {
              pendingTime = t;
            }
          }
        }
      }

      if (Math.abs(current - lastUiUpdate) > 0.005) {
        lastUiUpdate = current;
        setProgress(current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [isMobile]);

  const scrollToProducts = () => {
    document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToContact = () => {
    document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' });
  };

  const idle = progress < 0.01;
  const introOpacity = 1 - Math.min(1, progress / BEATS.introOut);
  const tiltOpacity = windowFade(progress, BEATS.tiltIn, BEATS.tiltIn + 0.06, BEATS.tiltOut - 0.06, BEATS.tiltOut);
  const explodeOpacity = windowFade(progress, BEATS.explodeIn, BEATS.explodeIn + 0.06, BEATS.explodeOut - 0.04, BEATS.explodeOut);
  const finalOpacity = progress > BEATS.finalIn ? Math.min(1, (progress - BEATS.finalIn) / 0.05) : 0;

  return (
    <section
      ref={sectionRef}
      className="relative w-full"
      style={{ height: `${SCROLL_LENGTH_VH}vh`, background: '#0C0C0C' }}
      aria-label="GL ROCKET — vista explodida interativa"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Dark Studio Background Sweep */}
        <div
          className="absolute inset-0 z-0"
          style={{ background: 'radial-gradient(120% 100% at 50% 38%, #141416 0%, #0d0d0f 55%, #0C0C0C 100%)' }}
        />

        {/* Video Scrub Player Container */}
        <div
          className="absolute inset-0 flex items-center justify-center z-0"
          style={{
            animation: idle && !reduced ? 'glFloat 6s ease-in-out infinite' : 'none',
            willChange: 'transform',
          }}
        >
          <video
            ref={videoRef}
            key={isMobile ? 'mobile' : 'desktop'}
            src={isMobile ? "/videos/gl-rocket-explode-scrub-mobile.mp4" : "/videos/gl-rocket-explode-scrub.mp4"}
            className="h-full w-full object-cover opacity-80"
            muted
            playsInline
            autoPlay
            preload="auto"
            poster="/videos/gl-rocket-poster.jpg"
          />
        </div>

        {/* Particles Overlay */}
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full z-10" />

        {/* Soft Vignette Overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background: `radial-gradient(ellipse at center, transparent 50%, #0C0C0C 100%)`,
          }}
        />

        {/* Cinematic Header/Navbar */}
        <header className="absolute top-0 left-0 w-full z-30 flex justify-between items-center px-6 md:px-12 py-6">
          <div className="text-2xl font-black tracking-tighter text-white font-heading">j.</div>
          <nav className="flex gap-6 sm:gap-8 text-[11px] uppercase tracking-widest text-[#D7E2EA]/60 font-medium">
            <a href="#about" className="hover:text-white transition-colors">About</a>
            <a href="#services" className="hover:text-white transition-colors">Services</a>
            <a href="#produtos" className="hover:text-white transition-colors">Works</a>
          </nav>
        </header>

        {/* Intro Stage (0% - 15% Scroll) */}
        <div
          className="absolute inset-0 z-20 flex flex-col justify-between px-6 md:px-12 pt-28 pb-10"
          style={{ 
            opacity: introOpacity, 
            pointerEvents: introOpacity > 0.5 ? 'auto' : 'none', 
            transition: 'opacity 150ms linear' 
          }}
        >
          {/* Centered Massive Title & Magnetic Portrait */}
          <div className="flex-grow flex items-center justify-center relative">
            <div className="relative flex flex-col items-center justify-center w-full max-w-4xl">
              <h1 className="hero-heading text-6xl sm:text-8xl md:text-9xl lg:text-[11rem] font-black uppercase tracking-tighter text-center leading-none select-none z-0">
                Hi, i&apos;m jack
              </h1>
              
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <Magnet className="pointer-events-auto" strength={4} padding={150}>
                  <div className="w-[140px] h-[190px] sm:w-[180px] sm:h-[240px] md:w-[220px] md:h-[300px] rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative group">
                    <img 
                      src="https://shrug-person-78902957.figma.site/_components/v2/d24c01ad3a56fc65e942a1f501eb73db42d7cf9a/Rectangle_40443.81459862.png" 
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 pointer-events-none" 
                      alt="Portrait portrait asset" 
                    />
                  </div>
                </Magnet>
              </div>
            </div>
          </div>

          {/* Bottom Bar info */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 w-full mt-auto">
            <p className="max-w-xs text-xs sm:text-sm uppercase tracking-wider text-[#D7E2EA]/60 leading-relaxed font-light">
              a 3d creator driven by crafting striking and unforgettable projects
            </p>
            <button 
              onClick={scrollToContact}
              className="liquid-glass text-white font-medium uppercase tracking-widest text-xs px-6 py-3 rounded-full flex items-center gap-2 hover:bg-white/10 transition-all"
            >
              Claim a Spot <ArrowUpRight className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Interactive Scrubbing Captions */}
        <Caption 
          side="right" 
          opacity={tiltOpacity} 
          eyebrow="Engenharia" 
          title="Precisão em cada camada"
          text="Estrutura impressa em PLA/PETG com tolerâncias de encaixe reais — projetada, fatiada e testada aqui." 
        />

        <Caption 
          side="left" 
          opacity={explodeOpacity} 
          eyebrow="Aviônica · Eletrônica" 
          title="Vista explodida"
          text="Placa de controle, servos do gimbal e bateria: todos os componentes internos visíveis, camada por camada." 
        />

        {/* Final CTA (appears near the bottom of scroll) */}
        <div
          className="absolute inset-x-0 bottom-16 z-20 flex justify-center"
          style={{ 
            opacity: finalOpacity, 
            transition: 'opacity 200ms linear', 
            pointerEvents: finalOpacity > 0.5 ? 'auto' : 'none' 
          }}
        >
          <button
            onClick={scrollToProducts}
            className="liquid-glass text-white border border-white/20 px-10 py-4 font-bold uppercase tracking-widest text-xs rounded-full hover:bg-white/10 transition-all"
          >
            Explorar a Coleção ↓
          </button>
        </div>

        {/* Scroll down indicator (visible only at the top) */}
        <div
          className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2"
          style={{ opacity: idle ? 0.6 : 0, transition: 'opacity 300ms' }}
        >
          <div className="flex animate-bounce flex-col items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D7E2EA]/40">
              Role para explorar
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D7E2EA" strokeWidth="2" className="opacity-55">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>

        {/* Lateral scrolling progress indicator */}
        <div className="absolute right-6 top-1/2 z-20 hidden -translate-y-1/2 md:block">
          <div className="h-40 w-[2px] rounded-full bg-white/10">
            <div
              className="w-full rounded-full bg-white"
              style={{ height: `${progress * 100}%`, transition: 'height 80ms linear' }}
            />
          </div>
        </div>

        {/* Ready metadata loading shield */}
        {!ready && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0C0C0C]">
            <span className="text-xs uppercase tracking-widest text-[#D7E2EA]/40">Carregando…</span>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes glFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.005); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
    </section>
  );
}

function Caption({
  side, opacity, eyebrow, title, text,
}: { side: 'left' | 'right'; opacity: number; eyebrow: string; title: string; text: string }) {
  return (
    <div
      className={`absolute top-1/2 z-20 max-w-sm sm:max-w-md -translate-y-1/2 px-6 md:px-16 ${side === 'left' ? 'left-0' : 'right-0 text-right'}`}
      style={{
        opacity,
        transform: `translateY(calc(-50% + ${(1 - opacity) * 30}px))`,
        transition: 'opacity 180ms linear, transform 180ms linear',
        pointerEvents: 'none',
      }}
    >
      <div className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.3em] text-[#ff6b00]">
        {eyebrow}
      </div>
      <h2 className="font-heading mt-2.5 text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight text-white uppercase">
        {title}
      </h2>
      <p className="mt-4 text-sm sm:text-base font-light leading-relaxed text-[#D7E2EA]/70">
        {text}
      </p>
    </div>
  );
}
