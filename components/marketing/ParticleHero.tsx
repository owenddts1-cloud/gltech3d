'use client';

import { useEffect, useRef } from 'react';

/**
 * Immersive, cursor-reactive Canvas 2D particle field for the landing hero.
 * Zero dependencies. A depth-layered constellation whose particles are pushed
 * away from the pointer (an "antigravity" well) while the whole field parallaxes
 * gently toward the cursor. Honors prefers-reduced-motion (renders one static
 * frame, no rAF loop), scales by devicePixelRatio, caps particle count by area,
 * and pauses when the tab is hidden.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  depth: number; // 0..1 — parallax + brightness factor
}

const ACCENT = '166, 129, 92'; // #A6815C

export function ParticleHero({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    // Non-null locals so control-flow narrowing survives into nested closures.
    const cv: HTMLCanvasElement = canvas;
    const ctx: CanvasRenderingContext2D = context;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles: Particle[] = [];
    let rafId = 0;

    // Pointer state (target + smoothed) for parallax + repulsion.
    const pointer = { x: -9999, y: -9999, active: false };
    const parallax = { x: 0, y: 0, tx: 0, ty: 0 };

    function build() {
      const rect = cv.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.floor(width * dpr);
      cv.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Density scaled by area, capped for performance.
      const count = Math.min(140, Math.floor((width * height) / 11000));
      particles = Array.from({ length: count }, () => {
        const depth = Math.random();
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          r: 0.8 + depth * 2.2,
          depth,
        };
      });
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      // Smooth the parallax toward its target.
      parallax.x += (parallax.tx - parallax.x) * 0.06;
      parallax.y += (parallax.ty - parallax.y) * 0.06;

      const linkDist = 130;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;

        if (!reduceMotion) {
          p.x += p.vx;
          p.y += p.vy;

          // Wrap around edges.
          if (p.x < -20) p.x = width + 20;
          if (p.x > width + 20) p.x = -20;
          if (p.y < -20) p.y = height + 20;
          if (p.y > height + 20) p.y = -20;

          // Pointer repulsion — the "antigravity" well.
          if (pointer.active) {
            const dx = p.x - pointer.x;
            const dy = p.y - pointer.y;
            const d2 = dx * dx + dy * dy;
            const radius = 150;
            if (d2 < radius * radius && d2 > 0.01) {
              const d = Math.sqrt(d2);
              const force = (1 - d / radius) * 1.6 * (0.4 + p.depth);
              p.x += (dx / d) * force;
              p.y += (dy / d) * force;
            }
          }
        }

        const px = p.x + parallax.x * (0.3 + p.depth);
        const py = p.y + parallax.y * (0.3 + p.depth);

        // Constellation lines to nearby particles.
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]!;
          const qx = q.x + parallax.x * (0.3 + q.depth);
          const qy = q.y + parallax.y * (0.3 + q.depth);
          const dx = px - qx;
          const dy = py - qy;
          const dist = Math.hypot(dx, dy);
          if (dist < linkDist) {
            let alpha = (1 - dist / linkDist) * 0.18;
            // Brighten links near the pointer.
            if (pointer.active) {
              const mx = (px + qx) / 2 - pointer.x;
              const my = (py + qy) / 2 - pointer.y;
              if (mx * mx + my * my < 180 * 180) alpha *= 2.4;
            }
            ctx.strokeStyle = `rgba(${ACCENT}, ${Math.min(alpha, 0.5)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(qx, qy);
            ctx.stroke();
          }
        }

        ctx.fillStyle = `rgba(${ACCENT}, ${0.35 + p.depth * 0.45})`;
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduceMotion) rafId = requestAnimationFrame(draw);
    }

    function onPointerMove(e: PointerEvent) {
      const rect = cv.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
      parallax.tx = (pointer.x / width - 0.5) * -30;
      parallax.ty = (pointer.y / height - 0.5) * -30;
    }
    function onPointerLeave() {
      pointer.active = false;
      parallax.tx = 0;
      parallax.ty = 0;
    }

    function start() {
      cancelAnimationFrame(rafId);
      if (reduceMotion) {
        draw(); // single static frame
      } else {
        rafId = requestAnimationFrame(draw);
      }
    }
    function stop() {
      cancelAnimationFrame(rafId);
    }

    function onResize() {
      build();
      if (reduceMotion) draw();
    }
    function onVisibility() {
      if (document.hidden) stop();
      else if (!reduceMotion) start();
    }

    build();
    start();

    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointerMove);
    cv.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      cv.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
