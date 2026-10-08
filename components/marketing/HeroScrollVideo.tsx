'use client';

/**
 * HeroScrollVideo — GL ROCKET
 * Scrollytelling: o progresso do vídeo (vista explodida) é dirigido pelo scroll.
 *
 * Requisitos de asset (IMPORTANTE):
 *   public/videos/gl-rocket-explode-scrub.mp4          (desktop, all-keyframes)
 *   public/videos/gl-rocket-explode-scrub-mobile.mp4   (mobile,  all-keyframes)
 * O vídeo PRECISA ser re-encodado com -g 1 (todo frame é keyframe), senão o
 * seek trava. Comando no roteiro que acompanha este arquivo.
 *
 * Uso em app/(marketing)/page.tsx:
 *   import HeroScrollVideo from '@/components/marketing/HeroScrollVideo';
 *   ...  <HeroScrollVideo />  (no lugar de <Hero />)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LandingSettings } from '@/lib/landing/types';
import {
  HAVE_CURRENT_DATA,
  HERO_VIDEO_POSTER,
  HERO_VIDEO_TIMEOUT_MS,
  heroImageCandidates,
  shouldUseFallback,
} from './hero-video-fallback';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SCROLL_LENGTH_VH = 400; // altura total da seção (4x viewport) = duração do scrub
const LERP = 0.09;            // suavização do currentTime (menor = mais "pesado")

// Momentos-chave do vídeo (0..1) para sincronizar os textos
const BEATS = {
  introOut: 0.15,   // título hero some (dá mais tempo de leitura no topo)
  tiltIn: 0.22,     // "Precisão em cada camada"
  tiltOut: 0.44,
  explodeIn: 0.52,  // "Vista explodida — aviônica & eletrônica"
  explodeOut: 0.80,
  finalIn: 0.86,    // CTA final (aparece antes do fim, alcançável)
};

// Paleta (mesma do site)
const C = {
  bg: '#ececec',
  ink: '#2B2622',
  brown: '#A6815C',
  brownDark: '#8E6D4D',
  muted: '#6B5E55',
  border: '#e2e2e2',
};

/**
 * White panel behind the hero/caption copy so the phrases read clearly over the
 * video. It carries the fade (opacity) itself, so panel and text dim together.
 */
const TEXT_PANEL =
  'rounded-3xl border border-[#E8E2D9] bg-white/90 shadow-xl backdrop-blur-md p-5 sm:p-6 md:p-8';

// ---------------------------------------------------------------------------
// Partículas (poeira de estúdio) — canvas leve, ~40 partículas, 60fps ok
// ---------------------------------------------------------------------------
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

    // Cursor influence: partículas repelem do ponteiro e o campo inteiro faz um
    // parallax suave em direção a ele.
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

    const N = 55;
    const ps = Array.from({ length: N }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 0.00012,
      vy: -0.00005 - Math.random() * 0.00012,
      a: 0.08 + Math.random() * 0.18,
      ph: Math.random() * Math.PI * 2,
    }));

    const tick = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      // Parallax do campo (suavizado) em direção ao ponteiro.
      const tpx = pointer.active ? (pointer.x - 0.5) : 0;
      const tpy = pointer.active ? (pointer.y - 0.5) : 0;
      parX += (tpx * 0.035 - parX) * 0.06;
      parY += (tpy * 0.035 - parY) * 0.06;
      for (const p of ps) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        if (p.x < -0.02) p.x = 1.02;
        if (p.x > 1.02) p.x = -0.02;
        // Repulsão do ponteiro.
        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          const R = 0.16;
          if (d2 < R * R && d2 > 1e-6) {
            const d = Math.sqrt(d2);
            const f = (1 - d / R) * 0.007;
            p.x += (dx / d) * f;
            p.y += (dy / d) * f;
          }
        }
        const flicker = 0.7 + 0.3 * Math.sin(t * 0.001 + p.ph);
        ctx.beginPath();
        ctx.arc((p.x - parX) * w, (p.y - parY) * h, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(140, 120, 100, ${p.a * flicker})`;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** opacidade 0→1→0 dentro de uma janela [inA..inB visível..outA→outB] */
function windowFade(p: number, inStart: number, inEnd: number, outStart: number, outEnd: number) {
  if (p <= inStart || p >= outEnd) return 0;
  if (p < inEnd) return (p - inStart) / (inEnd - inStart);
  if (p > outStart) return 1 - (p - outStart) / (outEnd - outStart);
  return 1;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
/**
 * `settings` vem do Landing Edit. Os textos abaixo são o padrão do site — o
 * editor só sobrescreve o que você preencher, então campo vazio = texto atual.
 */
export default function HeroScrollVideo({ settings }: { settings?: LandingSettings }) {
  const copy = settings?.sections?.hero;
  const banner = copy?.image;
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // progress só é usado para UI (textos); o scrub do vídeo roda fora do React
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // The video never became playable (timeout / error / stall): show a still.
  const [videoFailed, setVideoFailed] = useState(false);
  // Index into `imageCandidates`; advanced by <img onError>.
  const [imageIdx, setImageIdx] = useState(0);

  // Static mode = a banner from the Landing Edit, or the video failed. The
  // scroll captions keep working off scroll progress; nothing is seeked.
  const isStatic = Boolean(banner?.trim()) || videoFailed;
  const imageCandidates = useMemo(() => heroImageCandidates(banner), [banner]);
  const staticSrc = imageCandidates[imageIdx] ?? null;

  useEffect(() => {
    setImageIdx(0);
  }, [banner]);

  useDustParticles(canvasRef);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fallback watchdog: if the video is not paintable within the grace period,
  // or it errors/stalls before that, switch to the static image for good (no
  // flip-flopping back to the video if it shows up late).
  useEffect(() => {
    if (isStatic) return;
    const video = videoRef.current;
    if (!video) return;

    const startedAt = performance.now();
    let errored = video.error !== null;
    const evaluate = () => {
      if (shouldUseFallback(video.readyState, performance.now() - startedAt, errored)) {
        setVideoFailed(true);
      }
    };
    const onError = () => {
      errored = true;
      evaluate();
    };
    const onStalled = () => {
      if (video.readyState < HAVE_CURRENT_DATA) onError();
    };

    video.addEventListener('error', onError);
    video.addEventListener('stalled', onStalled);
    const timer = window.setTimeout(evaluate, HERO_VIDEO_TIMEOUT_MS);
    if (errored) evaluate();

    return () => {
      window.clearTimeout(timer);
      video.removeEventListener('error', onError);
      video.removeEventListener('stalled', onStalled);
    };
  }, [isStatic, isMobile]);

  // Loop de scrub: scroll → progress alvo → lerp → video.currentTime (com seek-throttling).
  // Em modo estático o mesmo loop só alimenta `progress` (legendas), sem vídeo.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const video = isStatic ? null : videoRef.current;
    if (!isStatic && !video) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let target = 0;
    let current = 0;
    let duration = 0;
    let lastUiUpdate = -1;
    let pendingTime: number | null = null;
    // Intro autoplay only with a video and when the user did not ask for less motion.
    let introPlaying = video !== null && !reducedMotion;

    const onMeta = () => {
      if (!video) return;
      duration = video.duration || 0;
      setReady(true);
    };

    // Seek throttling listener
    const onSeeked = () => {
      if (video && pendingTime !== null && video.readyState >= HAVE_CURRENT_DATA) {
        video.currentTime = pendingTime;
        pendingTime = null;
      }
    };

    if (video) {
      if (video.readyState >= 1) onMeta();
      video.addEventListener('loadedmetadata', onMeta);
      video.addEventListener('seeked', onSeeked);
    }

    const computeTarget = () => {
      const rect = section.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      target = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
    };

    const tick = () => {
      computeTarget();

      // se o usuário rolar a tela, cancela a intro e assume o controle manual
      if (target > 0.01) {
        introPlaying = false;
      }

      if (!video) {
        // Static mode: captions follow the scroll; reduced motion skips the easing.
        current = reducedMotion ? target : current + (target - current) * LERP;
        if (Math.abs(target - current) < 0.0005) current = target;
      } else if (introPlaying) {
        if (duration > 0) {
          if (video.paused) {
            // Autoplay can be refused (power saver, policy). Not an error: the
            // intro stops on the current frame and the scroll takes over.
            video.play().catch(() => {
              introPlaying = false;
            });
          }
          current = video.currentTime / duration;
          // para a intro ligeiramente antes do fim do arquivo para não congelar
          if (video.currentTime >= duration - 0.1) {
            introPlaying = false;
            video.pause();
          }
        }
      } else {
        // garante que o vídeo pare de rodar nativamente ao interagir com o scroll
        if (!video.paused && !video.seeking) {
          video.pause();
        }
        // interpolação (lerp) — elimina solavancos do scroll discreto
        current += (target - current) * LERP;
        if (Math.abs(target - current) < 0.0005) current = target;

        if (duration > 0 && video.readyState >= HAVE_CURRENT_DATA) {
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

      // atualiza React no máx. a cada ~1% para não re-renderizar a 60fps
      if (Math.abs(current - lastUiUpdate) > 0.01) {
        lastUiUpdate = current;
        setProgress(current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      if (video) {
        video.removeEventListener('loadedmetadata', onMeta);
        video.removeEventListener('seeked', onSeeked);
      }
    };
  }, [isMobile, isStatic]);

  const scrollToProducts = () => {
    document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' });
  };

  const idle = progress < 0.01; // ainda no topo → animação de flutuação
  const introOpacity = 1 - Math.min(1, progress / BEATS.introOut);
  const tiltOpacity = windowFade(progress, BEATS.tiltIn, BEATS.tiltIn + 0.06, BEATS.tiltOut - 0.06, BEATS.tiltOut);
  const explodeOpacity = windowFade(progress, BEATS.explodeIn, BEATS.explodeIn + 0.06, BEATS.explodeOut - 0.04, BEATS.explodeOut);
  const finalOpacity = progress > BEATS.finalIn ? Math.min(1, (progress - BEATS.finalIn) / 0.05) : 0;

  return (
    <section
      ref={sectionRef}
      className="relative"
      style={{ height: `${SCROLL_LENGTH_VH}vh`, background: C.bg }}
      aria-label="GL ROCKET — vista explodida interativa"
    >
      {/* Palco fixo (sticky) */}
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Fundo estúdio full-bleed: cobre a página de ponta a ponta e as barras
            do object-contain (para mostrar o foguete inteiro) somem nele. */}
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(120% 100% at 50% 38%, #dbd9d5 0%, #e7e5e1 55%, #ececec 100%)' }}
        />
        {/* Vídeo scrubbed — full-bleed object-cover encostando nas laterais */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            animation: idle && !reduced ? 'glFloat 6s ease-in-out infinite' : 'none',
            willChange: 'transform',
          }}
        >
          {/* Banner do Landing Edit vence o vídeo. Se o vídeo não carregar em
              ~2.5s (404, rede travada, data saver) entra a imagem estática:
              banner → poster → só o gradiente de fundo. */}
          {isStatic ? (
            staticSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={staticSrc}
                src={staticSrc}
                alt=""
                className="h-full w-full object-cover"
                // O topo é o LCP da página: carregar cedo e com prioridade.
                fetchPriority="high"
                decoding="async"
                onError={() => setImageIdx((i) => i + 1)}
              />
            ) : null
          ) : (
            <video
              ref={videoRef}
              key={isMobile ? 'mobile' : 'desktop'}
              src={isMobile ? "/videos/gl-rocket-explode-scrub-mobile.mp4" : "/videos/gl-rocket-explode-scrub.mp4"}
              className="h-full w-full object-cover transition-transform"
              muted
              playsInline
              autoPlay
              preload="auto"
              poster={HERO_VIDEO_POSTER}
            />
          )}
        </div>

        {/* Partículas de poeira por cima do vídeo */}
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

        {/* Vinheta suave para fundir vídeo com a página */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center, transparent 55%, ${C.bg} 100%)`,
          }}
        />

        {/* ------ Camada de texto sincronizada ------ */}

        {/* 0%: título hero (idêntico ao layout atual) */}
        {/* The padding of this column is the margin from the screen edge; the white
            panel inside it carries the text. Opacity lives on the panel itself (not on
            an ancestor) so its backdrop blur keeps working while it fades: an ancestor
            with opacity < 1 becomes the backdrop root and the blur would switch off. */}
        <div
          className="absolute inset-0 z-10 flex items-center"
          style={{ pointerEvents: introOpacity > 0.5 ? 'auto' : 'none' }}
        >
          <div className="w-full max-w-xl px-4 sm:px-6 md:max-w-[40rem] md:px-16">
            <div
              className={TEXT_PANEL}
              style={{ opacity: introOpacity, transition: 'opacity 120ms linear' }}
            >
              <span
                className="mb-6 inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-widest"
                style={{ borderColor: C.border, background: '#E8E2D9', color: '#7A5C3E' }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {copy?.eyebrow ?? 'Impressão 3D • Feito no Brasil'}
              </span>
              <h1 className="font-sora text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1]" style={{ color: C.ink }}>
                {copy?.title ?? 'Do arquivo 3D'} <br />
                <em className="font-serif font-normal italic" style={{ color: C.brownDark }}>
                  {copy?.subtitle ?? 'à realidade'}
                </em>
              </h1>
              <p className="mt-6 max-w-lg text-base sm:text-lg md:text-xl font-medium leading-relaxed" style={{ color: '#4E443C' }}>
                Da peça decorativa ao nosso GL ROCKET: engenharia e impressão 3D de alta performance.
                Role e veja a vista explodida.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <button
                  onClick={scrollToProducts}
                  className="rounded-2xl px-8 py-4 font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5"
                  style={{ background: C.brown, boxShadow: `0 10px 30px -10px ${C.brown}66` }}
                >
                  Ver Coleção
                </button>
                <a
                  href="#contato"
                  className="rounded-2xl border-2 px-8 py-4 text-center font-bold transition-colors hover:bg-[#F4F1EC]"
                  style={{ borderColor: '#E8E2D9', color: C.muted }}
                >
                  Fale com a gente
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ~20%: engenharia */}
        <Caption side="right" opacity={tiltOpacity} reduced={reduced} eyebrow="Engenharia" title="Precisão em cada camada"
          text="Estrutura impressa em PLA/PETG com tolerâncias de encaixe reais — projetada, fatiada e testada aqui." />

        {/* ~55%: vista explodida */}
        <Caption side="left" opacity={explodeOpacity} reduced={reduced} eyebrow="Impressão Premium" title="Fusão de Precisão"
          text="Resolução milimétrica com filamentos importados. Modelos impressos camada por camada para alta resistência e acabamento liso impecável." />

        {/* ~95%: CTA final */}
        <div
          className="absolute inset-x-0 bottom-16 z-10 flex justify-center"
          style={{ opacity: finalOpacity, transition: 'opacity 200ms linear', pointerEvents: finalOpacity > 0.5 ? 'auto' : 'none' }}
        >
          <button
            onClick={scrollToProducts}
            className="rounded-2xl px-10 py-4 font-bold text-white"
            style={{ background: C.brownDark }}
          >
            Explorar a Coleção ↓
          </button>
        </div>

        {/* Indicador de scroll (some ao rolar) */}
        <div
          className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
          style={{ opacity: idle ? 0.6 : 0, transition: 'opacity 300ms' }}
        >
          <div className="flex animate-bounce flex-col items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: C.brownDark }}>
              Role para explorar
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.brown} strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>

        {/* Barra de progresso lateral */}
        <div className="absolute right-6 top-1/2 z-10 hidden -translate-y-1/2 md:block">
          <div className="h-40 w-[3px] rounded-full" style={{ background: `${C.border}88` }}>
            <div
              className="w-full rounded-full"
              style={{ height: `${progress * 100}%`, background: C.brown, transition: 'height 80ms linear' }}
            />
          </div>
        </div>

        {/* Loading discreto enquanto o vídeo não tem metadata. Nunca em modo
            estático; o watchdog acima limita isto a ~2.5s. */}
        {!isStatic && !ready && (
          <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: C.bg }}>
            <span className="text-xs uppercase tracking-widest" style={{ color: C.muted }}>Carregando…</span>
          </div>
        )}
      </div>

      {/* keyframes locais */}
      <style jsx>{`
        @keyframes glFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-6px) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
    </section>
  );
}

// ---------------------------------------------------------------------------
function Caption({
  side, opacity, reduced, eyebrow, title, text,
}: { side: 'left' | 'right'; opacity: number; reduced: boolean; eyebrow: string; title: string; text: string }) {
  // Outer box: vertical centering + margin from the screen edge (md:px-16 keeps
  // right captions clear of the progress bar at right-6). Max widths grew by the
  // panel padding so the text column keeps its previous measure.
  // Panel: fade + slide live here (see the note on the intro block about blur).
  return (
    <div
      className={`absolute top-1/2 z-10 w-full max-w-md -translate-y-1/2 px-4 sm:max-w-lg sm:px-6 md:max-w-[36rem] md:px-16 ${side === 'left' ? 'left-0' : 'right-0 text-right'}`}
      style={{ pointerEvents: 'none' }}
    >
      <div
        className={TEXT_PANEL}
        style={{
          opacity,
          // Reduced motion: fade only, no slide.
          transform: reduced ? 'none' : `translateY(${(1 - opacity) * 24}px)`,
          transition: reduced ? 'opacity 150ms linear' : 'opacity 150ms linear, transform 150ms linear',
        }}
      >
        <div className="text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.3em]" style={{ color: '#7A5C3E' }}>
          {eyebrow}
        </div>
        <h2 className="font-sora mt-2.5 text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight" style={{ color: '#2B2622' }}>
          {title}
        </h2>
        <p className="mt-4 text-base sm:text-lg font-medium leading-relaxed" style={{ color: '#4E443C' }}>
          {text}
        </p>
      </div>
    </div>
  );
}
