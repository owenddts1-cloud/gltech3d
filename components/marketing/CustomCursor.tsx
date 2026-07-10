'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react';

export function CustomCursor() {
  const [cursorState, setCursorState] = useState<'default' | 'pointer' | 'view' | 'explore'>('default');
  const [hoverText, setHoverText] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const reducedMotion = useReducedMotion();

  // Position of mouse
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  // Smooth springs for the cursor follower ring
  const springConfig = { damping: 30, stiffness: 220, mass: 0.6 };
  const cursorX = useSpring(mouseX, springConfig);
  const cursorY = useSpring(mouseY, springConfig);

  useEffect(() => {
    // Disable on touch devices or if reduced motion is preferred
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch || reducedMotion) return;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Check if target or any parent has data-cursor attribute
      const cursorEl = target.closest('[data-cursor]');
      if (cursorEl) {
        const state = cursorEl.getAttribute('data-cursor') || 'default';
        const text = cursorEl.getAttribute('data-cursor-text') || '';
        setCursorState(state as 'default' | 'pointer' | 'view' | 'explore');
        setHoverText(text);
      } else if (
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.closest('a') ||
        target.closest('button') ||
        target.style.cursor === 'pointer'
      ) {
        setCursorState('pointer');
        setHoverText('');
      } else {
        setCursorState('default');
        setHoverText('');
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    window.addEventListener('mouseover', handleMouseOver, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, [mouseX, mouseY, isVisible, reducedMotion]);

  if (reducedMotion || !isVisible) return null;

  // Determine styles and sizes based on state
  let width = 20;
  let height = 20;
  let border = '2px solid #8E6D4D';
  let background = 'transparent';
  let mixBlendMode = 'normal';
  let innerDotOpacity = 1;

  if (cursorState === 'pointer') {
    width = 44;
    height = 44;
    border = 'none';
    background = '#ffffff';
    mixBlendMode = 'difference';
    innerDotOpacity = 0;
  } else if (cursorState === 'view') {
    width = 80;
    height = 80;
    border = 'none';
    background = '#2B2622'; // Graphite slate
    innerDotOpacity = 0;
  } else if (cursorState === 'explore') {
    width = 72;
    height = 72;
    border = 'none';
    background = '#A6815C'; // Tan gold
    innerDotOpacity = 0;
  }

  return (
    <>
      {/* Outer Follower Ring */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999] rounded-full flex items-center justify-center text-center select-none shadow-sm"
        style={{
          width,
          height,
          x: cursorX,
          y: cursorY,
          translateX: '-50%',
          translateY: '-50%',
          border,
          background,
          mixBlendMode: mixBlendMode as React.CSSProperties['mixBlendMode'],
          willChange: 'transform, width, height',
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        {(cursorState === 'view' || cursorState === 'explore') && (
          <span className="text-[10px] font-bold text-white tracking-widest font-sora">
            {hoverText || (cursorState === 'view' ? 'VER' : 'EXPLORE')}
          </span>
        )}
      </motion.div>

      {/* Inner Pinpoint Dot */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[10000] w-1.5 h-1.5 bg-[#8E6D4D] rounded-full"
        style={{
          x: mouseX,
          y: mouseY,
          translateX: '-50%',
          translateY: '-50%',
          opacity: innerDotOpacity,
          willChange: 'transform, opacity',
        }}
      />
    </>
  );
}
