'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogIn } from 'lucide-react';

/** Overlay navigation: transparent over the hero, gains a glass backdrop once
 *  the user scrolls. Center brand wordmark, right login CTA. */
export function CinematicNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        scrolled ? 'py-3 bg-[#F9F7F2]/70 backdrop-blur-md border-b border-[#E8E2D9]' : 'py-5 bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="w-8 h-8 bg-[#A6815C] rounded-lg flex items-center justify-center text-white text-sm font-bold">
            G
          </span>
          <span className="text-lg font-bold font-sora tracking-tight text-[#2D241E]">
            GLTech3D
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-[11px] font-bold tracking-[0.15em] uppercase text-[#6B5E55]">
          <button onClick={() => document.getElementById('story-0')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-[#A6815C] transition-colors">Início</button>
          <button onClick={() => document.getElementById('colecao')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-[#A6815C] transition-colors">Coleção</button>
          <button onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-[#A6815C] transition-colors">Contato</button>
        </nav>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-[#D1C7B7] text-[#2D241E] text-sm font-bold hover:border-[#A6815C] hover:text-[#A6815C] transition-all"
        >
          <LogIn className="w-4 h-4" />
          Entrar
        </Link>
      </div>
    </header>
  );
}
