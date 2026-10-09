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
      {/* Botão Flutuante Esquerdo */}
      <button
        type="button"
        onClick={() => scrollByAmount('left')}
        disabled={!canScrollLeft}
        aria-label="Rolar filamentos para a esquerda"
        className={`absolute -left-3 sm:-left-5 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full border flex items-center justify-center transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A6815C] ${
          canScrollLeft
            ? 'border-[#E8E2D9] bg-white text-[#2B2622] shadow-[0_8px_24px_rgba(43,38,34,0.18)] hover:scale-110 hover:border-[#A6815C] hover:bg-[#FAF9F6] active:scale-95 cursor-pointer opacity-100'
            : 'border-transparent bg-transparent text-transparent opacity-0 pointer-events-none'
        }`}
      >
        <ChevronLeft className="w-6 h-6 text-[#2B2622]" />
      </button>

      {/* Botão Flutuante Direito */}
      <button
        type="button"
        onClick={() => scrollByAmount('right')}
        disabled={!canScrollRight}
        aria-label="Rolar filamentos para a direita"
        className={`absolute -right-3 sm:-right-5 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full border flex items-center justify-center transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A6815C] ${
          canScrollRight
            ? 'border-[#E8E2D9] bg-white text-[#2B2622] shadow-[0_8px_24px_rgba(43,38,34,0.18)] hover:scale-110 hover:border-[#A6815C] hover:bg-[#FAF9F6] active:scale-95 cursor-pointer opacity-100'
            : 'border-transparent bg-transparent text-transparent opacity-0 pointer-events-none'
        }`}
      >
        <ChevronRight className="w-6 h-6 text-[#2B2622]" />
      </button>

      {/* Container de Scroll Horizontal (sem barra de rolagem visível) */}
      <div
        ref={containerRef}
        onScroll={checkScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        className={`flex gap-5 overflow-x-auto pb-4 pt-1 no-scrollbar scrollbar-none snap-x snap-mandatory ${
          isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
        }`}
        style={{
          scrollBehavior: isDragging ? 'auto' : 'smooth',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
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
