'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * 3D tilt-on-hover wrapper for the landing cards. Tracks the pointer inside the
 * card and tilts it toward the cursor (rotateX/rotateY via CSS vars, GPU-only),
 * plus a soft light that follows the pointer. Disabled for touch / reduced
 * motion. Zero re-renders — everything is set on the DOM node directly.
 */
export function TiltCard({
  children,
  className,
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setEnabled(!touch && !reduced);
  }, []);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = innerRef.current;
    if (!el || !enabled) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - py) * max}deg`);
    el.style.setProperty('--ry', `${(px - 0.5) * max}deg`);
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
  }

  function onLeave() {
    const el = innerRef.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }

  return (
    <div
      className={`tilt-card ${className ?? ''}`}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <div ref={innerRef} className="tilt-inner h-full">
        {children}
        <span className="tilt-glow" aria-hidden />
      </div>
    </div>
  );
}
