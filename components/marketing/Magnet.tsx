'use client';

import { useRef, useState, useEffect } from 'react';

interface MagnetProps {
  children: React.ReactNode;
  padding?: number;
  strength?: number;
  activeTransition?: string;
  inactiveTransition?: string;
  className?: string;
}

export default function Magnet({
  children,
  padding = 150,
  strength = 3,
  activeTransition = "transform 0.3s ease-out",
  inactiveTransition = "transform 0.6s ease-in-out",
  className = ""
}: MagnetProps) {
  const transformRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ transform: 'translate3d(0px, 0px, 0px)' });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!transformRef.current) return;
      const rect = transformRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distanceX = e.clientX - centerX;
      const distanceY = e.clientY - centerY;

      if (Math.abs(distanceX) < padding && Math.abs(distanceY) < padding) {
        setStyle({
          transform: `translate3d(${distanceX / strength}px, ${distanceY / strength}px, 0px)`,
          transition: activeTransition
        });
      } else {
        setStyle({
          transform: 'translate3d(0px, 0px, 0px)',
          transition: inactiveTransition
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [padding, strength, activeTransition, inactiveTransition]);

  return (
    <div ref={transformRef} style={style} className={className}>
      {children}
    </div>
  );
}
