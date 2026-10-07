'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PublicFilament } from '@/lib/filament-catalog/types';
import { FilamentCard } from './FilamentCard';

interface FilamentCarouselProps {
  filaments: PublicFilament[];
  storeWhatsapp: string;
}

export function FilamentCarousel({ filaments, storeWhatsapp }: FilamentCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Estados para drag com mouse
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollStart, setScrollStart] = useState(0);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // Margem de tolerância de 2px para subpixel rounding
    const hasLeft = el.scrollLeft > 2;
    const hasRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 2;

    setCanScrollLeft(hasLeft);
    setCanScrollRight(hasRight);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = containerRef.current;
    if (!el) return;

    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, filaments]);

  const scrollByAmount = (direction: 'left' | 'right') => {
    const el = containerRef.current;
    if (!el) return;

    const cardWidth = 320; // Aproximação de largura do card + gap
    const delta = direction === 'left' ? -cardWidth : cardWidth;

    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  // Handlers para mouse drag
  const handleMouseDown = (e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;

    setIsDragging(true);
    setStartX(e.pageX - el.offsetLeft);
    setScrollStart(el.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const el = containerRef.current;
    if (!el) return;

    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX) * 1.5; // Multiplicador de velocidade
    el.scrollLeft = scrollStart - walk;
  };

  const stopDragging = () => {
    setIsDragging(false);
  };

  return (
    <div className="relative group/carousel">
      {/* Controles de Navegação no topo / canto */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <button
          type="button"
          onClick={() => scrollByAmount('left')}
          disabled={!canScrollLeft}
          aria-label="Rolar filamentos para a esquerda"
          className={`w-10 h-10 rounded-full border border-brand-sand flex items-center justify-center transition-all duration-200 ${
            canScrollLeft
              ? 'bg-white text-brand-espresso shadow-sm hover:border-brand-bronze hover:bg-brand-bone/50 hover:scale-105 active:scale-95'
              : 'bg-white/40 text-brand-taupe/40 cursor-not-allowed border-brand-sand/50'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => scrollByAmount('right')}
          disabled={!canScrollRight}
          aria-label="Rolar filamentos para a direita"
          className={`w-10 h-10 rounded-full border border-brand-sand flex items-center justify-center transition-all duration-200 ${
            canScrollRight
              ? 'bg-white text-brand-espresso shadow-sm hover:border-brand-bronze hover:bg-brand-bone/50 hover:scale-105 active:scale-95'
              : 'bg-white/40 text-brand-taupe/40 cursor-not-allowed border-brand-sand/50'
          }`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Container de Scroll Horizontal */}
      <div
        ref={containerRef}
        onScroll={checkScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        className={`flex gap-5 overflow-x-auto pb-4 pt-1 scrollbar-none snap-x snap-mandatory ${
          isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
        }`}
        style={{ scrollBehavior: isDragging ? 'auto' : 'smooth' }}
      >
        {filaments.map((f) => (
          <div
            key={f.id}
            className="w-[280px] sm:w-[320px] shrink-0 snap-start transition-transform duration-300 hover:-translate-y-1"
          >
            <FilamentCard f={f} storeWhatsapp={storeWhatsapp} origem="home_carousel" />
          </div>
        ))}
      </div>
    </div>
  );
}
