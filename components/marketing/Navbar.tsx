'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogIn, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const LINKS = [
  { id: 'home', label: 'Início' },
  { id: 'categorias', label: 'Categorias' },
  { id: 'produtos', label: 'Produtos' },
  { id: 'contato', label: 'Contato' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = (id: string) => {
    setIsOpen(false);
    if (id === 'home') {
      if (pathname !== '/') return void router.push('/');
      return window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (pathname !== '/') return void router.push(`/#${id}`);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav
      className={`fixed z-50 transition-all duration-500 ease-in-out ${
        scrolled || isOpen
          ? 'top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-5xl rounded-[2rem] border border-[#E8E2D9] bg-[#F9F7F2]/90 backdrop-blur-xl shadow-[0_12px_40px_-10px_rgba(43,38,34,0.15)] py-3 px-6'
          : 'top-0 left-0 w-full bg-transparent py-5 px-6 md:px-12 border-b border-transparent'
      }`}
    >
      <div className="w-full flex items-center justify-between">
        <button onClick={() => go('home')} className="group flex items-center gap-2.5" aria-label="Início">
          <span className="w-8 h-8 bg-[#A6815C] rounded-lg flex items-center justify-center text-white transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg group-hover:shadow-[#A6815C]/35">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
            </svg>
          </span>
          <span className="text-xl font-black font-sora tracking-tight text-[#2D241E]">GLTech3D</span>
        </button>

        <button
          className="p-2 lg:hidden text-[#2D241E] hover:bg-[#E8E2D9]/60 rounded-xl transition-colors"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Abrir menu"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        <div className="hidden lg:flex items-center gap-2">
          {LINKS.map((l) => (
            <button
              key={l.id}
              onClick={() => go(l.id)}
              onMouseEnter={() => setHoveredId(l.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="relative px-4 py-2 text-sm font-semibold text-[#6B5E55] hover:text-[#2D241E] transition-colors"
            >
              {/* Sliding Background Pill */}
              <AnimatePresence>
                {hoveredId === l.id && (
                  <motion.span
                    layoutId="nav-hover-pill"
                    className="absolute inset-0 bg-[#A6815C]/12 rounded-full -z-10"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </AnimatePresence>
              {l.label}
            </button>
          ))}
        </div>

        <Link
          href="/login"
          className="hidden lg:flex items-center gap-2 px-5 py-2.5 bg-[#A6815C] hover:bg-[#8E6D4D] text-white rounded-xl text-sm font-bold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#A6815C]/35"
        >
          <LogIn className="h-4 w-4" />
          Entrar
        </Link>
      </div>

      {/* Mobile Menu (collapsible drawer within the capsule) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="lg:hidden overflow-hidden flex flex-col gap-1.5 mt-4 pt-4 border-t border-[#E8E2D9]"
          >
            {LINKS.map((l) => (
              <button
                key={l.id}
                onClick={() => go(l.id)}
                className="text-left py-2.5 px-4 font-semibold text-[#6B5E55] hover:text-[#A6815C] hover:bg-[#A6815C]/10 rounded-xl transition-all"
              >
                {l.label}
              </button>
            ))}
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-3 mt-3 bg-[#A6815C] hover:bg-[#8E6D4D] text-white rounded-xl font-bold transition-colors"
            >
              <LogIn className="h-4 w-4" />
              Entrar
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
