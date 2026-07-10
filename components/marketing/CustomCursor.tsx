'use client';

import { useEffect, useRef } from 'react';

export function CustomCursor() {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Disable on touch devices or if reduced motion is preferred
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isTouch || prefersReduced) return;

    let mouseX = -100;
    let mouseY = -100;
    let followerX = -100;
    let followerY = -100;
    let isVisible = false;

    // Easing factor for spring-like movement
    const ease = 0.15;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isVisible) {
        isVisible = true;
        document.documentElement.setAttribute('data-cursor-visible', 'true');
      }
    };

    const handleMouseLeave = () => {
      isVisible = false;
      document.documentElement.removeAttribute('data-cursor-visible');
    };

    const handleMouseEnter = () => {
      isVisible = true;
      document.documentElement.setAttribute('data-cursor-visible', 'true');
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const cursorEl = target.closest('[data-cursor]');
      if (cursorEl) {
        const state = cursorEl.getAttribute('data-cursor') || 'default';
        const text = cursorEl.getAttribute('data-cursor-text') || '';
        document.documentElement.setAttribute('data-cursor-state', state);
        if (outerRef.current) {
          const textEl = outerRef.current.querySelector('.cursor-text');
          if (textEl) textEl.textContent = text || (state === 'view' ? 'VER' : 'EXPLORE');
        }
      } else if (
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.closest('a') ||
        target.closest('button') ||
        target.style.cursor === 'pointer'
      ) {
        document.documentElement.setAttribute('data-cursor-state', 'pointer');
      } else {
        document.documentElement.setAttribute('data-cursor-state', 'default');
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    window.addEventListener('mouseover', handleMouseOver, { passive: true });

    let animationFrameId: number;

    const updatePosition = () => {
      // Spring interpolation for follower
      followerX += (mouseX - followerX) * ease;
      followerY += (mouseY - followerY) * ease;

      // Inject CSS variables
      document.documentElement.style.setProperty('--cursor-x', `${mouseX}px`);
      document.documentElement.style.setProperty('--cursor-y', `${mouseY}px`);
      document.documentElement.style.setProperty('--cursor-follower-x', `${followerX}px`);
      document.documentElement.style.setProperty('--cursor-follower-y', `${followerY}px`);

      animationFrameId = requestAnimationFrame(updatePosition);
    };

    animationFrameId = requestAnimationFrame(updatePosition);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      window.removeEventListener('mouseover', handleMouseOver);
      cancelAnimationFrame(animationFrameId);
      document.documentElement.removeAttribute('data-cursor-visible');
      document.documentElement.removeAttribute('data-cursor-state');
    };
  }, []);

  return (
    <>
      {/* Outer Follower Ring */}
      <div
        ref={outerRef}
        className="custom-cursor-outer fixed top-0 left-0 pointer-events-none z-[9999] rounded-full flex items-center justify-center text-center select-none shadow-sm will-change-transform"
      >
        <span className="cursor-text text-[10px] font-bold text-white tracking-widest font-sora hidden" />
      </div>

      {/* Inner Pinpoint Dot */}
      <div
        ref={innerRef}
        className="custom-cursor-inner fixed top-0 left-0 pointer-events-none z-[10000] w-1.5 h-1.5 bg-[#8E6D4D] rounded-full will-change-transform"
      />
    </>
  );
}
